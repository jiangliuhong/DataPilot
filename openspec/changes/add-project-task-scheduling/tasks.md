# Implementation Tasks

依赖顺序（自底向上）：数据库 schema → repository → service → route → api-client → 前端 → 入口接入 → 端到端验证。每个任务应可独立完成与验证。

## 1. 数据库 Schema 与迁移

- [x] 1.1 在 `src/app/db/schema/sqlite/dbt-task.ts` 定义 `dbt_tasks` 表（snake_case 列、自增 `id`、`createdAt`/`updatedAt`/`deletedAt`、FK → `dbt_projects` 与 `dbt_runtime_environments` 均 cascade、唯一索引 `(project_id, name)`）。字段：`name`、`command`、`select`、`exclude`、`fullRefresh`、`vars`、`target`、`description`、`scheduleCron`（可空）、`scheduleStatus`（默认 `disabled`）。导出 `NewDbtTask` / `DbtTask` 类型。
- [x] 1.2 在 `src/app/db/schema/sqlite/dbt-task-run.ts` 定义 `dbt_task_runs` 表（FK → `dbt_tasks` cascade；字段：`taskId`、`status`、`exitCode`、`errorMessage`、`startedAt`、`finishedAt`；**不**含 `workspacePath`）。导出 `NewDbtTaskRun` / `DbtTaskRun` 类型。
- [x] 1.3 在 `src/app/db/schema/mysql/` 下新增对应的两张 MySQL 表（列类型与现有 MySQL 表对齐，如 `datetime`、`longtext`）。
- [x] 1.4 在 `src/app/db/schema/sqlite/index.ts` 与 `src/app/db/schema/mysql/index.ts` 中导出两张新表。
- [x] 1.5 在 `src/app/db/schema/index.ts` facade 中加入 `dbtTasks` / `dbtTaskRuns` 常量导出与类型 re-export（遵循现有模式）。
- [x] 1.6 在 `src/app/db/relations/sqlite.ts` 与 `relations/mysql.ts` 中补充：`dbt_tasks` → project / environment、`dbt_task_runs` → task 的关联；并补充反向关联（project.tasks、environment.tasks、task.runs）。
- [x] 1.7 运行 `DB_DRIVER=sqlite drizzle-kit generate` 与 `DB_DRIVER=mysql drizzle-kit generate` 生成两套迁移；本地执行 `DB_DRIVER=sqlite drizzle-kit migrate` 验证可应用。

## 2. Repository 层

- [x] 2.1 新建 `src/app/server/repositories/dbt/task.repository.ts`：`createTask`、`findById`、`findByNameInProject(projectId, name)`、`findList({ limit, offset, projectId?, environmentId?, command? })`（分页 + count + 软删除过滤）、`updateById`、`softDeleteById`、`existsById`。遵循现有 `project.repository.ts` 模式（`insertReturningId` + 重新 `findById`）。
- [x] 2.2 新建 `src/app/server/repositories/dbt/task-run.repository.ts`：`createRun`、`findRunById`、`updateRun(runId, partial)`、`findRunsByTask({ taskId, limit, offset, status? })`、`findActiveRunOfTask(taskId)`（返回 `queued`/`running` 的运行，用于并发检测）、`findStaleRunning(threshold)`（用于僵尸修正，O3）。
- [x] 2.3 （可选小工具）在 repository 或 `lib/` 中增加判断 `environmentId` 是否绑定到 `projectId` 的查询函数（查 `dbt_project_environments`，复用现有 project-environment repository 若已存在；否则在 task.repository 内）。

## 3. Zod Schema 层

- [x] 3.1 新建 `src/app/server/schemas/dbt/task.schema.ts`：`createTaskSchema`（`name` 必填 1-255、`projectId`、`environmentId`、`command` 枚举全集、`select?`、`exclude?`、`fullRefresh?`、`vars?` 用 `refine` 校验合法 JSON 对象、`target?`、`description?`）、`updateTaskSchema`（全 optional）、`taskIdSchema`、`listTasksQuerySchema`（含 `projectId`/`environmentId`/`command` 过滤 + `limit`/`offset`）、`listTaskRunsQuerySchema`（含 `status` 过滤）、`taskRunIdSchema`。遵循现有 `project.schema.ts` 的 `z.coerce.number()` 模式。

## 4. Service 层

- [x] 4.1 新建 `src/app/server/services/dbt/task.service.ts`（薄编排，<200 行）：`createTask`（校验环境已绑定项目 + 项目内 name 唯一 + **适配器兼容性校验**：`task.environment.connection.databaseType ∈ task.environment.version.adapterPackages[*].supportedDatabases`，复用 `validateAdapterCompatibility`）、`getTask`、`updateTask`（变更 environmentId 时重校验绑定与兼容性、变更 name 时重校验唯一）、`deleteTask`（软删除）、`listTasks`、`listTaskRuns`（内部调用 `reconcileStaleRuns`，见 4.4）、`getRun`。错误用 `Error` + `.code = "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST"`（沿用 environment-init 的错误约定）。
- [x] 4.2 新建 `src/app/server/services/dbt/task-workspace.service.ts`：`materializeWorkspace({ projectId, runId, environment, connection, projectName })` —— 从 `dbt_directories` + `dbt_files` 导出文件到 `<workspaceRoot>/<projectId>/<runId>/`，调用 `generateProfilesYml`（见 4.7）与 `generateDbtProjectYml`（见 4.8）生成配置；返回 workspace 路径。`cleanupWorkspace(workspaceDir)` —— `fs.rm(..., { recursive: true, force: true })`。在 `configs/dbt/constants.ts` 加 `getTaskWorkspaceRoot()` 常量。**连接来源**：从传入的 `environment.connectionId` 解析 connection（不在 service 内部再加项目级连接绑定，见 D8）。
- [x] 4.3 新建 `src/app/server/services/dbt/task-execution.service.ts`：模块级 `Set<number> runningTaskIds`（单 task 单实例锁，D2）；`runTask(taskId)` —— 校验前置（任务未软删、环境 active 且 initialized、连接存在）→ 插入 `queued` 运行 → `runningTaskIds.add` → 置 running + publish `status` → `setImmediate(() => runExecution(runId, taskId).catch(...))` → 立即返回 `{ runId, status: "queued" }`；`runExecution(runId, taskId)` —— 拉取 task + environment + connection + project → materialize workspace（把 connection、projectName 传进去）→ 调 `buildDbtCommand` → `spawnStreaming(cmd, args, { cwd, env, onLine })` → 终态落库（succeeded/failed）+ publish `done` → `finally` 清理 workspace + `runningTaskIds.delete`。
- [x] 4.4 在 `task.service.ts`（或 `task-execution.service.ts`）实现 `reconcileStaleRuns(thresholdMs = 24h)`：查 `findStaleRunning` → 批量 update 为 `failed`（errorMessage="进程中断（运行超时未完成）"）。在 `listTaskRuns` 入口处惰性调用（O3）。
- [x] 4.5 抽出纯函数 `buildDbtCommand(task, env)`（D4）—— 返回 `{ command, args }`，命令路径解析自 `env.venvPath`（参考 `resolvePythonBin`），参数按 D4 规则拼装。**注意**：D3.1 决定 profile 是单 target `default`，故任务 `--target` 参数第一阶段忽略（不拼进 args），避免指向不存在的 target。便于单测。
- [x] 4.6 为 `buildDbtCommand`、`generateProfilesYml`、`slugifyProfileName` 与 `vars` JSON 校验补充单元测试（可选，若项目已有 test runner）。
- [x] 4.7 新建 `generateProfilesYml({ projectName, connection })`（建议放 `task-workspace.service.ts` 或 `lib/dbt/profile.ts`）：按 D3.1 规则生成单 target `default` 的 YAML 字符串。profile 名 = `slugifyProfileName(projectName)`；`outputs.default.type` 取自 `DB_TYPE_ADAPTER_MAP[connection.databaseType]`；`host`/`port`/`user`/`password`(解密)/`dbname`/`schema`(`schemaName ?? adapter 默认`) 来自 connection；`connection.extraConfig` 的键值展开为顶层字段。
- [x] 4.8 新建 `generateDbtProjectYml({ projectName })`：生成最小化 `dbt_project.yml`，`profile:` 字段写入 `slugifyProfileName(projectName)`（与 profiles.yml 的 key 一致），其余字段给合理默认（`name`/`version`/`model-paths`）。若项目中已显式管理 `dbt_project.yml`（在 `dbt_files` 中存在），则跳过生成。
- [x] 4.9 新建 `slugifyProfileName(name)` 纯函数：小写化、非 `[a-z0-9_-]` 字符替换为 `-`、去首尾 `-`、为空回退 `datapilot`。供 4.7 与 4.8 复用。

## 5. API 路由（全部瘦，≤50 行）

- [x] 5.1 新建 `src/app/api/dbt/tasks/route.ts`：`GET`（列表，支持过滤与分页）、`POST`（新建，校验 name 唯一冲突时返回 409）。
- [x] 5.2 新建 `src/app/api/dbt/tasks/[id]/route.ts`：`GET` / `PUT` / `DELETE`。
- [x] 5.3 新建 `src/app/api/dbt/tasks/[id]/run/route.ts`：`POST`，调用 `runTask`，立即返回 `{ runId, status: "queued" }`。识别 service 抛出的 `CONFLICT` → 返回 409。
- [x] 5.4 新建 `src/app/api/dbt/tasks/[id]/runs/route.ts`：`GET`，分页查询运行记录，支持 `status` 过滤。
- [x] 5.5 新建 `src/app/api/dbt/task-runs/[runId]/route.ts`：`GET` 单条运行详情。
- [x] 5.6 路由统一复用错误助手（`requireAuth`、`handleValidationError`、`apiError`、`notFound`、`conflict`、`badRequest`）与 `error.code` 识别模式。

## 6. api-client 层

- [x] 6.1 在 `src/web/types/dbt.ts` 补充类型：`Task`、`CreateTaskInput`、`UpdateTaskInput`、`TaskRun`、`TaskRunStatus`、`TaskCommand`（枚举全集）。
- [x] 6.2 新建 `src/web/api-client/task.ts`，导出 `taskApi`：`list(params)`、`get(id)`、`create(data)`、`update(id, data)`、`delete(id)`、`run(id)`（返回 `{ runId, status }`）、`listRuns(taskId, params)`、`getRun(runId)`。遵循现有 `environment.ts` 的 `request<T>` + `buildQuery` 模式。
- [x] 6.3 在 `src/web/api-client/index.ts` 中 re-export `taskApi`。

## 7. 前端 feature 模块

- [x] 7.1 新建 `src/web/features/dbt-task/hooks/use-tasks.ts`：`useTasks(projectId)` 提供 list / create / update / delete（基于 React state，参考 `use-projects.ts`）。
- [x] 7.2 新建 `src/web/features/dbt-task/hooks/use-task-run.ts`：`useTaskRun()` —— `start(taskId)` 调用 `taskApi.run` 拿 runId 后切到 `getWsClient().subscribe(\`task:\${runId}:run\`, handler)`，复用 `use-env-init.ts` 的 `logs.slice(-500)` + `logIdRef` 累积逻辑，处理 `status`/`log`/`done` 三类事件。
- [x] 7.3 新建 `src/web/features/dbt-task/components/task-list.tsx`（HeroUI Table，列：名称、环境、命令、最近运行状态、操作）。操作区含：编辑、删除、运行、查看日志。≤150 行。
- [x] 7.4 新建 `src/web/features/dbt-task/components/task-form-modal.tsx`（HeroUI Modal + Form）：name、environment（Select 从项目已绑定环境拉取，复用 `projectEnvironmentApi`）、command（Select **锁定为 run**，`isDisabled` 或仅展示）、select、exclude、fullRefresh（Switch）、vars（Textarea，placeholder 提示 JSON）、target、description。提交时 POST 体携带 `command: "run"`。
- [x] 7.5 新建 `src/web/features/dbt-task/components/task-run-log-panel.tsx`：使用 `useTaskRun` 渲染运行状态徽标 + 滚动日志面板（stdout/stderr 分色）；订阅 `task:<runId>:run`。
- [x] 7.6 拆分大组件：若 task-list 或 form 超过 150 行，抽出 `task-columns.tsx` / `task-form-fields.tsx` 等子组件。

## 8. 页面与入口接入

- [x] 8.1 新建 `src/app/projects/[id]/tasks/page.tsx`（或放在既有 dbt project 路由树下与现有约定一致的位置）：读取 `params.id`，渲染 `useTasks(id)` + `task-list` + `task-form-modal` + `task-run-log-panel`。≤100 行，仅组合组件。
- [x] 8.2 在 `src/web/features/project/components/project-list.tsx` 的每行操作区新增"任务调度"按钮（如 lucide `CalendarClock` 图标），点击用 `next/link` 或 `useRouter().push` 跳转到 `/projects/[id]/tasks`。
- [x] 8.3 确认 `task-form-modal` 的环境 Select 能正确拉取"该项目已绑定的环境"（通过 `projectEnvironmentApi.list(projectId)`），空态时给提示"请先在项目里绑定运行环境"。

## 9. 端到端验证

- [ ] 9.1 准备一个已有项目（含若干 sql 文件）+ 一个 initialized 的运行环境 + 该环境已绑定到该项目。
- [ ] 9.2 在任务调度页新建任务（name=test，command=run，select 选一个 model，环境选已绑定那个）→ 列表出现该任务。
- [ ] 9.3 点击"运行" → 立即返回 runId，前端订阅 WS 收到 `status: running` → `log`（dbt 编译/执行日志按行到达）→ `done`（succeeded/failed）。运行记录状态正确落库。
- [ ] 9.4 同一任务在运行中再次点击"运行" → 后端返回 409 冲突，前端给出提示，不重复执行。
- [ ] 9.5 手动制造僵尸记录（DB 里把某 run 的 status 改 running 且 startedAt 改到 25h 前）→ 调用 `GET /tasks/:id/runs` → 该记录被自动修正为 failed（errorMessage 标注进程中断）。
- [ ] 9.6 软删除任务 → 列表不再出现，且无法再 run（返回 not-found）。
- [ ] 9.7 运行结束后检查 `<workspaceRoot>` 下对应 run 目录已被清理（不存在）。
- [ ] 9.8 **profile 生成验证**：运行前在 `runExecution` 的 materialize 后、spawn 前临时打印（或运行中断点）检查 `<workspace>/profiles.yml` —— 顶层 key 为项目名 slug 化、只含 `default` 一个 target、`outputs.default` 字段来自 `task.environment.connection`（含解密后的明文密码）；`<workspace>/dbt_project.yml` 的 `profile:` 字段与 profiles.yml 的顶层 key 一致。验证通过后移除断点。
- [ ] 9.9 **适配器兼容性校验**：把环境的连接换成 databaseType 不被该环境版本 adapterPackages 支持的类型 → 新建任务时返回 400（BAD_REQUEST），错误信息提示"该版本的适配器包不支持 X 数据库类型"。
- [x] 9.10 运行 `openspec validate add-project-task-scheduling --strict` 通过；准备归档（后续 `openspec-archive-change` 流程）。
