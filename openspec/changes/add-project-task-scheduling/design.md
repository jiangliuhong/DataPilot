## Context

DataPilot 当前能管理 dbt 项目的代码（`dbt_projects` + `dbt_directories` + `dbt_files` 存在 DB 里）、版本（`dbt_versions`）、数据库连接（`dbt_database_connections`）和运行环境（`dbt_runtime_environments`，每个环境是一个独立的 Python venv）。**但 dbt 命令从未被平台执行过**——venv 初始化（`python -m venv` + `pip install`）是当前唯一的子进程用例。

本次变更新增"任务调度"能力：把一组 dbt 命令参数和一个运行环境固化成**可复用的任务**，用户在任务调度页面一键触发，在目标 venv 中执行 dbt 并实时查看运行日志。

复用的现成基础设施：
- `src/app/server/lib/process.ts` 的 `spawnStreaming(command, args, { cwd, env, onLine })`：按行流式输出 stdout/stderr，返回退出码。
- `src/app/server/realtime/event-bus.ts` 的 `publish(topic, event, data)` + WebSocket 服务器（挂载在 `globalThis` 上的单例 EventEmitter，前端通过 `getWsClient().subscribe(topic, handler)` 订阅）。
- `environment-init.service.ts` 的异步执行样板：模块级 `Set<number>` 锁 + `setImmediate(() => worker().catch(...))` 脱钩 + 终态落库。
- 双方言 schema（`schema/{sqlite,mysql}/` + `schema/index.ts` facade）+ Drizzle 迁移。
- HeroUI 组件、Zod 校验、`requireAuth` 中间件、`apiError/notFound/conflict` 错误助手。

约束（来自 `AGENTS.md`）：UI → api-client → route（瘦） → service → repository → Drizzle。事务只能在 service 层。组件 < 150 行、路由 < 50 行、service < 200 行。

## Goals / Non-Goals

**Goals:**

1. 引入持久化的"任务"实体，归属项目、绑定一个项目已绑定的运行环境，保存 dbt 命令 + 参数（`--select`、`--exclude`、`--full-refresh`、`--vars`、`--target` 等）。
2. 引入"任务运行记录"实体，记录每次手动触发的执行（状态、退出码、起止时间、错误信息）。
3. 实现可在目标 venv 中执行 dbt 命令的执行引擎，stdout/stderr 实时推送给前端。
4. 提供任务调度页面：列表 + 新建/编辑/删除 + 运行 + 实时日志面板。**新建表单第一阶段只暴露 `dbt run`**（命令选择器锁定），但参数字段完整。
5. 数据模型**预留** `scheduleCron`、`scheduleStatus` 字段，但**不**实现定时调度引擎（避免破坏性迁移）。

**Non-Goals:**

- 定时调度（cron 引擎、调度器进程、错过补偿）。仅留 schema 字段，第一阶段全手动触发。
- 跨任务 DAG 编排、任务依赖关系、重试策略。
- 运行历史超过软删除外的归档/清理策略。
- 前端开放 run 以外的 dbt 命令（如 build/test/compile）。后端 schema 已支持，前端锁定在 `run`。
- 在任务运行时进行参数模板化（如 Jinja、变量模板引擎）。`--vars` 只校验是合法 JSON，不做模板渲染。

## Decisions

### D1. 数据模型：两张新表，双方言

新增 `dbt_tasks`（任务定义）与 `dbt_task_runs`（运行记录），同时在 `schema/sqlite/` 与 `schema/mysql/` 下定义，在 `schema/index.ts` 导出，在 `relations/{sqlite,mysql}.ts` 中补充关联。**字段命名与现有表对齐**：snake_case 列名、`id` 自增主键、`createdAt`/`updatedAt`/`deletedAt` 软删除。

`dbt_tasks` 关键字段：
- `projectId`（FK → `dbt_projects.id`，cascade delete）
- `environmentId`（FK → `dbt_runtime_environments.id`，cascade delete）—— **直接绑定运行环境**，而不是绑定 `project_environment` 绑定记录，简化模型。service 层校验：`environmentId` 必须存在于该项目的 `dbt_project_environments` 中（防止跨项目绑定）。
- `name`（唯一约束在 `projectId + name` 范围内，即同一项目下任务名唯一）
- `command`（`text not null`，枚举值 `run | build | test | compile | seed | snapshot`——后端支持全集，**前端表单只生成 `run`**）
- `select`、`exclude`（`text`，可空——dbt 的 `--select` / `--exclude` 选择器，自由文本如 `my_model+ tag:nightly`）
- `fullRefresh`（`boolean default false`）
- `vars`（`text`，可空——JSON 字符串，service 层用 Zod 校验为合法 JSON 对象）
- `target`（`text`，可空——dbt `--target` profile 名）
- `description`（`text`，可空）
- `scheduleCron`（`text`，可空，**预留**，第一阶段恒为 null）
- `scheduleStatus`（`text`，枚举 `disabled | enabled`，**预留**，默认 `disabled`）

`dbt_task_runs` 关键字段：
- `taskId`（FK → `dbt_tasks.id`，cascade delete）
- `status`（`text not null`，枚举 `queued | running | succeeded | failed | canceled`）
- `exitCode`（`integer`，可空，运行结束时填）
- `errorMessage`（`text`，可空）
- `startedAt`、`finishedAt`（`timestamp`，可空）

**Alternatives considered:**
- *把命令+参数整体存成 JSON 列*：被否决。SQL 查询/校验不便，违反 AGENTS.md 的"显式优于抽象"原则。拆成独立列后，未来按命令类型筛选、按环境筛选都更直接。
- *用 polymorphic 关系支持未来非 dbt 任务*：过度设计，YAGNI。

### D2. 执行引擎：复用 spawnStreaming + event-bus + 模块级锁

新建 `task-execution.service.ts`，**严格复刻 `environment-init.service.ts` 的执行模式**：

```text
runTask(taskId)
 ├─ 1. 校验：任务存在、未软删除、归属项目、环境已绑定、环境 status=initialized
 ├─ 2. 查重：runningTaskRunIds.has(taskId) → throw CONFLICT
 ├─ 3. 插入 dbt_task_runs 一条 status=queued 的记录，拿到 runId
 ├─ 4. runningTaskRunIds.add(taskId)；置 run status=running；publish(topic,"status",{status:"running"})
 ├─ 5. setImmediate(() => runExecution(runId, taskId).catch(...))
 └─ 6. 立即 return { runId, status: "queued" }

runExecution(runId, taskId)  // 异步 worker
 ├─ 1. 拉任务 + 环境 + 连接 + 版本
 ├─ 2. 实例化工作目录（见 D3）
 ├─ 3. 拼 dbt 命令（见 D4）：<venvBin>/dbt <command> --select ... --vars ...
 ├─ 4. spawnStreaming(cmd, args, { cwd: workspaceDir, env: {...}, onLine: (s,l) => publish(t,"log",{stream:s,line:l}) })
 ├─ 5. 成功 → updateRun(runId, {status:"succeeded", exitCode, finishedAt}) + publish(t,"done",{status:"succeeded"})
 │     失败 → updateRun(runId, {status:"failed", exitCode, errorMessage, finishedAt}) + publish(t,"done",{status:"failed",error})
 └─ finally: runningTaskRunIds.delete(taskId); 清理工作目录（见 D3）
```

- **Topic 命名**：`task:<runId>:run`（按 runId 而非 taskId，方便前端按具体某次运行订阅日志，多次运行互不串扰）。
- **事件**：`status`（运行中阶段切换）、`log`（按行 stdout/stderr）、`done`（终态，携带 status 与可选 error）。
- **并发模型**：与 venv 初始化相同——同一 task 同时只能有一个运行实例（`Set<number>` 锁）。不同 task 可并行（受 Node 进程与系统资源限制，第一阶段不加全局并发上限）。
- **进程隔离**：每次运行是独立的 `child_process.spawn`，进程崩溃不影响 Next.js 主进程；进程被 `spawnStreaming` 的 timeoutMs 杀掉时（第一阶段不设超时，预留参数）会落库 `failed`。

**Alternatives considered:**
- *用 Bull/BullMQ 等队列*：需要引入 Redis 与新依赖，超出本次范围；当前 venv 初始化已用同一模式验证可行。
- *把执行逻辑放 service 之外的独立 worker 进程*：本仓库只有 Next.js + 自定义 `server.ts`（承载 WS 服务），没有独立 worker；保持单进程内 `setImmediate` 异步。

### D3. 项目工作区实例化：每次运行生成临时目录

**这是本次变更最需要决策的点**。当前 dbt 项目的文件存在数据库（`dbt_files.content`）中，但 dbt CLI 需要磁盘上的真实文件系统（`dbt_project.yml`、`profiles.yml`、`models/*.sql` 等）。

**决策**：每次运行时在 `<workspaceRoot>/<projectId>/<runId>/` 下实例化一个临时工作目录：
1. 递归创建 `dbt_directories` 中该项目的所有目录。
2. 写出 `dbt_files` 中所有非软删除文件（保留相对 `path`）。
3. 生成 `profiles.yml`：按 D3.1 的规则，用任务绑定环境（`task.environmentId`）的 `connectionId` 对应的 `dbt_database_connections`（解密 `encryptedPassword`）填充。
4. 生成最小化 `dbt_project.yml`（若项目中未显式管理）：`name`/`version`/`profile`（写入 D3.1 的 profile 名）/`model-paths` 等。

**D3.1. `profiles.yml` 生成规则（profile 来源决策）**

```yaml
<profileName>:              # ← 项目名 slug 化（见下）
  target: default           # ← 固定单 target
  outputs:
    default:                # ← 单 target，结构如下
      type: <adapterName>   # ← DB_TYPE_ADAPTER_MAP[connection.databaseType] 映射后的 dbt adapter 名
      host: <connection.host>
      port: <connection.port>
      user: <connection.username>
      password: <解密自 connection.encryptedPassword>
      dbname: <connection.databaseName>
      schema: <connection.schemaName ?? 默认值>   # schemaName 可空，空时按 adapter 给合理默认
      # connection.extraConfig 中的键值原样展开为顶层字段（用于 ssl、threads 等）
```

- **profile 名**：取 `dbt_projects.name`，做 slug 化（小写、非 `[a-z0-9_-]` 字符替换为 `-`、去首尾 `-`、为空时回退到 `datapilot`）。同一项目的 `dbt_project.yml` 的 `profile:` 字段必须与此一致。
- **单 target**：始终只生成 `default` 一个 target，`target: default`。任务的 `--target` 参数（若用户传了）第一阶段**忽略**（或强制覆盖为 `default`），因为只生成了这一个 target。多 target 不在本次范围。
- **连接来源**：`task.environmentId → dbt_runtime_environments.connectionId → dbt_database_connections`。**不**新增项目级连接绑定，**不**改动 `dbt_tasks` 增加 `connectionId`，**不**在任务表单加连接选择器（详见 D8）。当 `connection.schemaName` 为空时按 adapter 类型给合理默认（postgres → `public`，mysql → 与 `databaseName` 同）。
- **adapter 名映射**：复用 `src/app/server/configs/dbt/constants.ts` 中已有的 `DB_TYPE_ADAPTER_MAP`（含 `adapterPackage` 信息）。`type` 字段取 dbt 期望的 adapter type 字符串（如 `postgres`、`mysql`、`starrocks`）。
5. 把 `<venvPath>/bin` 注入 `PATH`（让 `dbt` 命令直接找到对应环境的二进制）。
6. 运行结束后（终态）**立即清理**目录（`fs.rm(workspaceDir, { recursive: true, force: true })`，在 `finally` 中执行）。`dbt_task_runs` **不持久化** `workspacePath` 字段——工作区仅服务于本次运行，运行结束即销毁。

`<workspaceRoot>` 来自一个新增的常量（如 `getTaskWorkspaceRoot()`，参考现有 `getVenvRoot()` 的实现位置 `src/app/server/configs/dbt/constants.ts`）。

**Alternatives considered:**
- *长期挂载项目目录 + 文件变更时实时同步*：需要在文件 CRUD 的 repository/service 中加入"写库同时写盘"的双向同步逻辑，改动面大、有一致性风险。第一阶段不做。
- *用 dbt 的 `--project-dir` 指向一个固定目录*：多任务并发会冲突，需要按 run 隔离，等价于本方案。

### D4. dbt 命令拼装

在 `task-execution.service.ts` 内提供纯函数 `buildDbtCommand(task, env, conn)` 返回 `{ command, args }`，便于单测：

- `command = <venvPath>/bin/dbt`（Unix）或 `<venvPath>/Scripts/dbt`（Windows，第一阶段不重点支持，参考 `resolvePythonBin()` 的现有处理）。
- `args = [task.command]`（如 `run`）。
- 追加：`task.select ? ["--select", task.select] : []`、`task.exclude ? ["--exclude", task.exclude] : []`、`task.fullRefresh ? ["--full-refresh"] : []`、`task.vars ? ["--vars", task.vars] : []`、`task.target ? ["--target", task.target] : []`。
- 固定追加：`--profiles-dir <workspaceDir>`、`--project-dir <workspaceDir>`、`--no-use-colors`（避免 ANSI 转义污染日志）。

**不做参数白名单转义**：参数值是用户在 UI 输入的，通过 `spawn` 数组形式传给子进程（不经 shell），天然避免 shell 注入。但仍需在 Zod schema 中限制长度（见 D5）。

### D5. 校验：Zod schema 复用

新建 `schemas/dbt/task.schema.ts`，遵循现有 `project.schema.ts` 模式，四件套：
- `createTaskSchema`：`name`（必填，1-255）、`projectId`、`environmentId`、`command`（枚举全集）、`description?`、`select?`、`exclude?`、`fullRefresh?`、`vars?`（用 `z.string().refine(s => { try { JSON.parse(s); return true } catch { return false } }, "...")`）、`target?`。
- `updateTaskSchema`：所有字段 `.optional()`。
- `taskIdSchema`、`listTasksQuerySchema`（`limit/offset/projectId?/environmentId?/command?`）。
- 运行记录侧：`listTaskRunsQuerySchema`（`taskId?`、`limit/offset`、`status?`）、`taskRunIdSchema`。

**前端命令锁定**：前端 `task-form-modal.tsx` 的"命令"字段使用 HeroUI 的 `<Select>` 且 `isDisabled` 或仅展示 `run`，但 POST 体仍带 `command: "run"`。后端 schema 不做"仅 run"的限制（D1 已支持全集），保证后续开放无需后端改动。

### D6. 前端结构与命令锁定

新建 `web/features/dbt-task/`：
- `components/task-list.tsx`（HeroUI Table，列：名称、环境、命令、最近运行状态、操作）
- `components/task-form-modal.tsx`（HeroUI Modal + Form：name、environment（Select 从项目已绑定环境拉取）、command 锁定 run、select、exclude、fullRefresh、vars、target）
- `components/task-run-log-panel.tsx`（订阅 `task:<runId>:run`，复用 `use-env-init.ts` 的日志累积逻辑：`logs.slice(-500)`、`logIdRef`）
- `hooks/use-tasks.ts`（list/create/update/delete）
- `hooks/use-task-run.ts`（触发 run + 订阅 WS）

页面路由（**O2 决策**）：新增独立路由 `/projects/[id]/tasks`（项目作用域下的任务列表页）。入口在**项目列表 `project-list.tsx` 的每行操作区加一个跳转按钮**（如"任务调度"按钮，跳转到 `/projects/[id]/tasks`）。**不**新增顶级菜单项——任务强属于项目，从项目列表进入语义最清晰。

api-client 新增 `web/api-client/task.ts`，导出 `taskApi`（`list/get/create/update/delete/run/listRuns/getRun`），在 `index.ts` 中 re-export。

### D7. API 路由（全部瘦）

全部位于 `src/app/api/dbt/`：
- `tasks/route.ts`：`GET`（列表，支持 `projectId` 过滤）、`POST`（新建）
- `tasks/[id]/route.ts`：`GET`/`PUT`/`DELETE`
- `tasks/[id]/run/route.ts`：`POST`（触发运行，立即返回 `{ runId, status: "queued" }`）
- `tasks/[id]/runs/route.ts`：`GET`（分页查询某任务的运行记录）
- `task-runs/[runId]/route.ts`：`GET`（单条运行详情）

每条路由 ≤ 50 行：`requireAuth` → `schema.parse` → 调 service → `Response.json`。错误映射沿用 `environment-init` 路由的 try/catch + `error.code === "CONFLICT"` 检测模式（service 抛 `Error` 带 `.code`，路由识别后调 `conflict`/`notFound`/`badRequest`）。

### D8. 连接来源：复用"环境 → 连接"链路（不新增项目级连接绑定）

经核实，每个 `dbt_runtime_environments` 已通过 `connectionId` 1:1 绑定一个 `dbt_database_connections`（创建环境时固定，含 host/port/database/schema/加密密码）。任务通过 `environmentId` 选运行环境时，**已隐含选择了连接**——无需再为项目/任务单独绑定连接。

**本次不做的改动**（明确排除，避免 scope creep）：
- ❌ 不新增 `dbt_project_connections` 表
- ❌ 不为 `dbt_tasks` 增加 `connectionId` 字段
- ❌ 不在任务表单或项目详情加"连接选择器"
- ❌ 不改动 `environmentAlias` 的语义（仍仅用于显示）

**任务执行时的连接解析链路**：
```
task.environmentId
  → dbt_runtime_environments.connectionId
    → dbt_database_connections（取 host/port/databaseName/schemaName/username/encryptedPassword/extraConfig）
      → profiles.yml outputs.default（详见 D3.1）
```

**适配器兼容性校验**：在任务创建/更新时，**额外**校验 `task.environment.connection.databaseType` 必须被 `task.environment.version.adapterPackages[*].supportedDatabases` 包含（复用现有 `validateAdapterCompatibility` 函数）。此校验在环境创建时已做过一次，但任务层面再做一次可防御"环境后来换了连接"的边角情况。该校验失败时拒绝任务创建，返回 400。

**为什么不在项目级再加一层连接绑定**：会与"环境→连接"链路产生语义冲突（同一个运行到底用哪个连接？），徒增复杂度。现有架构已足够支撑"项目通过绑定不同环境来切换不同数据库"的多库场景。

## Risks / Trade-offs

- **[工作目录磁盘膨胀]** 每次运行实例化整个项目目录，长跑项目会产生大量临时文件。→ **决策（O1）**：运行结束时在 `finally` 中立即 `fs.rm(workspaceDir, { recursive: true, force: true })`；`dbt_task_runs` 不持久化 `workspacePath`，工作区仅服务于本次运行。
- **[数据库→磁盘一致性]** 用户编辑文件后立即触发运行，DB 中最新内容会正确实例化（每次运行都从 DB 重写）。但如果 dbt 进程在运行中修改文件（如 `dbt seed` 写 `target/`），这些变更不会回写 DB。→ 可接受：dbt 的 `target/` 是构建产物，不是源码；第一阶段不回写。
- **[无并发上限]** 不同 task 可并行 spawn，理论上可能耗尽系统资源（CPU/内存/数据库连接）。→ 缓解：单 task 单实例锁（D2）已防止最常见的"重复点击"；后续可加全局信号量。文档化此限制。
- **[长日志内存占用]** 前端 `logs.slice(-500)` 截断，但后端 `publish("log", ...)` 在订阅者存在时同步触发；若运行几小时，事件总线会发出大量 log 事件。→ 缓解：前端已截断 500 行；后端可选地把日志同时写盘（`workspaceDir/run.log`）便于事后查看。
- **[进程崩溃后状态卡死]** 若 Next.js 进程在 dbt 运行中重启，运行记录会永久停在 `running`。→ 缓解：启动时（或查询时）扫描 `status=running` 但 `startedAt` 早于某阈值的记录，标记为 `failed`（"进程中断"）。第一阶段可加一个简单的 `reconcileStaleRuns()` 在 service 启动时调用，或在 `listTaskRuns` 查询时惰性修正。**列入 Open Questions，第一阶段可只加文档化警告。**
- **[明文密码落盘]** `profiles.yml` 含数据库明文密码，写在临时目录。→ 缓解：目录权限 0700；运行结束即清理（D3 决策）；不写入日志（`spawnStreaming` 的 `onLine` 只转发 dbt 自身输出，不转发 `profiles.yml` 内容）。

## Migration Plan

1. **Schema 优先**：先在 `schema/{sqlite,mysql}/` 加两张表 → 在 `schema/index.ts` 导出 → 在 `relations/{sqlite,mysql}.ts` 加关联 → 运行 `DB_DRIVER=sqlite drizzle-kit generate` 与 `DB_DRIVER=mysql drizzle-kit generate` 生成两套迁移 → `drizzle-kit migrate` 应用（开发环境 sqlite 优先验证）。
2. **Repository → Service → Route**：按依赖顺序自底向上实现（repository 先于 service，service 先于 route）。每层完成后用 curl 验证。
3. **api-client + 前端**：api-client 先于 hook 先于组件。最后接入菜单/路由。
4. **回滚**：若需回滚，反向删除新增文件 + 执行 down 迁移（`drizzle-kit` 不自动生成 down，需手写 drop table；因本次仅新增表，无数据迁移风险）。

## Resolved Questions（已确认）

- **O1 运行结束后工作目录处理**：**立即清理**（`finally` 中 `fs.rm`），不持久化 `workspacePath`。
- **O2 任务调度入口位置**：在**项目列表行内加跳转按钮**，跳转到独立的 `/projects/[id]/tasks` 路由（项目作用域下的任务列表页）。不新增顶级菜单项。
- **O3 僵尸 `running` 记录**：**第一阶段实现** `reconcileStaleRuns()`——在 `listTaskRuns` 查询时惰性修正超过阈值（默认 24h）仍为 `running` 的记录为 `failed`（errorMessage 标注"进程中断"）。已在 `dbt-task-execution` spec 中固化为需求。
- **O4 文件落盘策略**：**每次运行从 DB 全量导出到隔离的临时工作目录**（`<workspaceRoot>/<projectId>/<runId>/`），运行结束即清理。现有文件 CRUD（DB-only）**保持不变**，不引入"双写"或长期磁盘同步。理由：始终反映 DB 最新内容、并发运行天然隔离、实现最简单且与现有架构一致。
