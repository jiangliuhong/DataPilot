## Why

DataPilot 目前能管理 dbt 项目的代码、版本和运行环境（venv），但**无法执行任何 dbt 命令**——用户在编辑器里改完模型后，必须切到本地终端手动 `dbt run`。这割裂了"编辑 → 执行 → 看日志"的闭环。本次变更为项目管理引入"任务调度"能力：把一组 dbt 命令参数（`--select`、`--full-refresh` 等）和目标运行环境固化成一个**可复用的任务**，用户在任务调度页面一键触发，即可在已初始化的 venv 中执行 dbt 并实时查看运行日志，从而把 dbt 的执行纳入平台内闭环。

## What Changes

- 新增**任务（task）**实体：属于某个 `dbt_project`，绑定一个 `dbt_runtime_environment`，并持久化 dbt 命令与参数（如 `command=run`、`--select`、`--exclude`、`--full-refresh`、`--vars`、`--target` 等）。任务可被命名、编辑、软删除、反复执行。
- 新增**任务运行记录（task run）**实体：每次手动触发一次任务，生成一条运行记录，记录状态（`queued | running | succeeded | failed | canceled`）、退出码、起止时间、错误信息。
- 新增 **dbt 命令执行引擎**：复用现有 `spawnStreaming` + `event-bus` + WebSocket 客户端，在目标环境的 venv 中执行 dbt 命令，按行流式推送 stdout/stderr，执行结束后写回运行记录。
- 新增**任务调度页面**（`/projects/[id]/tasks` 或同等路由）：列出项目下所有任务，支持新建/编辑/删除任务；**新建任务表单仅暴露 `dbt run` 命令**（命令选择器锁定为 `run`，但参数字段如 `--select`、`--exclude`、`--full-refresh`、`--vars` 完整可用），并要求选择已绑定到该项目的环境。
- 新增任务执行入口（页面"运行"按钮 / API `POST /tasks/[id]/run`），运行后跳转或内嵌运行详情面板，实时展示日志。
- 新增导航菜单项"任务调度"。
- 数据模型**预留** `scheduleCron`、`scheduleStatus` 字段（默认空/禁用），第一阶段不启用定时调度引擎，但避免后续破坏性迁移。

> 注意：**后端执行引擎与命令/参数 schema 按 dbt 核心命令集设计**（run / build / test / compile / seed / snapshot），但**前端任务表单第一阶段只暴露 `dbt run`**。前端锁定不等于后端限制——后续可在不破坏数据模型的前提下开放更多命令。

## Capabilities

### New Capabilities

- `dbt-task-management`：任务的领域模型与生命周期管理——任务归属项目、绑定环境、命令与参数定义、CRUD 与校验规则、运行记录的读取与列表分页。
- `dbt-task-execution`：dbt 命令执行引擎——在指定运行环境的 venv 中触发 dbt 命令、流式输出日志、生命周期状态机（queued→running→succeeded/failed）、并发与中断约束、运行结果落库。

### Modified Capabilities

（无——当前 `openspec/specs/` 为空，本次变更是首批能力引入，不修改既有 spec。）

## Impact

- **数据库**：新增 2 张表（`dbt_tasks`、`dbt_task_runs`），遵循现有双方言模式（`schema/sqlite/` + `schema/mysql/`），在 `schema/index.ts` 导出，在 `relations/{sqlite,mysql}.ts` 补充与 `dbt_projects`、`dbt_runtime_environments`、`dbt_project_environments` 的关联；通过 `drizzle-kit generate/migrate` 生成迁移，**不手改迁移文件**。
- **后端分层**：
  - `repositories/`：新增 `dbt/task.repository.ts`、`dbt/task-run.repository.ts`（遵循 Repository First Rule，默认排除软删除记录）。
  - `services/`：新增 `dbt/task.service.ts`（CRUD + 校验环境已绑定到项目、环境处于 `initialized` 状态）、`dbt/task-execution.service.ts`（编排执行：校验 → 写 queued 运行记录 → `setImmediate` 异步 spawnStreaming → 流式 `publish("task:<runId>:run", ...)` → 写回终态；复用 `environment-init.service.ts` 的 module-level 锁模式做单任务单实例并发控制）。
  - `schemas/`：新增 `dbt/task.schema.ts`（Zod，覆盖命令枚举、参数结构、分页参数），供路由与前端复用。
- **API 路由**（`app/api/dbt/`）：
  - `tasks/route.ts`（`GET` 列表 / `POST` 新建）
  - `tasks/[id]/route.ts`（`GET` / `PUT` / `DELETE`）
  - `tasks/[id]/run/route.ts`（`POST`，触发执行，返回 `runId`）
  - `tasks/[id]/runs/route.ts`（`GET`，分页查询运行记录）
  - `task-runs/[runId]/route.ts`（`GET` 单条运行详情）
  - 所有路由保持瘦：Zod 校验 → 调 service → 返回 JSON。
- **前端**：
  - `web/api-client/task.ts`：新增 `taskApi`（`list/create/update/delete/run/listRuns/getRun`），从 `index.ts` 导出。
  - `web/features/dbt-task/`：`components/task-list.tsx`、`components/task-form-modal.tsx`（表单的"命令"字段锁定为 `run`，参数字段完整）、`components/task-run-log-panel.tsx`（复用 `use-env-init.ts` 的 WS 订阅模式，订阅 `task:<runId>:run`）。
  - `web/features/dbt-task/hooks/`：`use-tasks.ts`、`use-task-run.ts`。
  - 在 `src/app/page.tsx` 的 `menuItems` 与项目详情页中加入"任务调度"入口与对应 App Router 页面。
- **复用现有基础设施**：`spawnStreaming`、`event-bus`（`publish/subscribe`）、`ws-server` + `ws-client`、`requireAuth` 中间件、`apiError`/`safeExecute`、HeroUI 组件。
- **不动**：现有 dbt 项目/文件/环境/连接/版本能力；认证；agent。不引入新的状态管理库（用 React State + 现有 WS 客户端）。
- **依赖**：不新增第三方依赖（node-cron 等**不**引入，第一阶段纯手动触发）。
