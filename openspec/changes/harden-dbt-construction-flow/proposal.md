## Why

dbt 工程建设流程已具备项目/目录/文件管理、运行环境、构建执行、AI 辅助建设四条链路，分层整体清晰。但深入审视发现三类问题：(1) 现有 `db.transaction` 调用全部漏接 `tx` 参数，repository 又硬绑定全局 `db`，导致**所有多步写操作（级联重命名/移动/删除、导入、项目删除）实际并未在事务中执行**，存在中途失败留下孤儿数据的系统性风险；(2) 部分路由直接访问 repository（违反 NON-NEGOTIABLE 规则），且唯一性校验在 route/service 重复执行；(3) 若干设计层面不一致（`target` 死字段、导入跳过 `dbt_project.yml` 造成配置丢失、AI 写入无内容校验）。现在修复是因为事务问题属数据一致性隐患，分层违规是架构红线，越往后积累成本越高。

## What Changes

**P0 — 数据一致性与架构合规（必做）**

- **BREAKING（内部）**：修复事务基础设施——repository 写方法增加可选 `tx` 参数（默认回退全局 `db`），service 的 `db.transaction` 回调接收并透传 `tx`，使事务真正生效。
- `deleteProject` 级联软删（files → directories → project）纳入事务。
- 修正现有 `directory.service`（rename/move/delete）、`import-export.service` 事务调用漏传 `tx` 的问题。
- 项目/任务创建的唯一性校验**下沉到 service**，路由不再直接调用 repository；消除 `tasks/route.ts` 中与 `task.service.ts` 的重复校验。
- 抽取 `environment.service` 与 `task.service` 中重复的 `validateAdapterCompatibility` 到共享模块。

**P1 — 设计一致性（决策落地）**

- 明确 `dbt_tasks.target` 字段语义：第一阶段隐藏前端输入、schema 标注保留，将 R14 决策固化为 spec（不做多 target）。
- 统一 `dbt_project.yml` 来源：导入流程放行 `dbt_project.yml`（带 profile 名一致性校验），运行物化优先使用项目内文件，仅缺失时回退自动生成。
- 将散落在 service 头部注释、引用已丢失 `design.md` 的决策（R14/D8/O3/C2 等）迁入 openspec specs。

**P2 — 建设体验增强**

- 新增 `dbt parse` 预检环节：任务运行前可选执行秒级 parse，把语法/引用错误前置。
- AI 经 `DbProjectBackend` 写文件前增加结构化校验（`.yml` 用 Zod 校验 dbt schema、`.sql` 基础检查），失败回执给 Agent 自我修正。

## Capabilities

### New Capabilities
- `dbt-transaction-integrity`: 跨层数据一致性保障能力——repository 事务参数透传契约、service 真事务执行、级联多步写的原子性保证。
- `dbt-construction-validation`: 工程建设的预检与内容校验——运行前 `dbt parse` 预检、AI 生成内容的结构化校验。

### Modified Capabilities
- `dbt-project-crud`: 项目创建唯一性校验由 service 统一负责（route 不再访问 repo）；级联软删必须事务原子。
- `dbt-task-management`: 任务创建唯一性校验下沉 service；明确 `target` 字段为第一阶段保留字段（不参与命令构建）。
- `dbt-task-execution`: 物化工作区优先使用项目内 `dbt_project.yml`；运行前可选 parse 预检。
- `dbt-project-import-export`: 导入放行 `dbt_project.yml`（含 profile 名一致性安全校验）。
- `dbt-file-management`: AI 经虚拟文件系统写文件前需通过结构化内容校验。

## Impact

**代码**：
- `src/app/db/index.ts`：导出 `Database` 类型（已存在）供 `tx` 参数标注。
- `src/app/server/repositories/dbt/*`：project/directory/file/task 等参与多步写的方法增加 `tx?` 参数。
- `src/app/server/services/dbt/`：project（`deleteProject` 加事务、`createProject` 加唯一性校验）、task（去重）、directory、import-export（修正 tx 透传）、environment（抽取共享校验）、task-execution（target 语义、物化优先级、parse 预检）、task-workspace（dbt_project.yml 处理）。
- `src/app/api/dbt/projects/route.ts`、`tasks/route.ts`：移除直接 repository 调用。
- 新增 `src/app/server/services/dbt/shared/adapter-compatibility.ts`、`src/app/server/services/dbt/task-parse.service.ts`、`src/app/server/agent/validation/dbt-content-validator.ts`。

**API**：无对外契约变更（行为更严格，错误码语义更准确）；`target` 前端不再展示输入。

**依赖**：无新增运行时依赖（parse 复用已有 venv 与 dbt CLI）。

**风险**：事务修复属基础性变更，需回归 directory 级联、import-export、项目删除三条路径；分阶段实施，P0 独立先合。
