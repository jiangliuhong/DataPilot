# Implementation Tasks

按 design 的优先级分阶段，P0 为事务基础设施与架构合规（必须先合），P1 为设计一致性，P2 为建设体验增强。任务按依赖排序：先建事务契约，再在其上落地各业务修复。

## 1. P0 — 事务基础设施修复（先行，独立提交）

- [x] 1.1 确认 `src/app/db/index.ts` 已导出 `Database` 类型；若未导出则补 `export type Database = typeof db;`，供 repository 的 `tx` 参数标注
- [x] 1.2 给 `insertReturningId`（`src/app/db/index.ts`）增加可选 `tx?: Database` 参数，内部 `const client = tx ?? db;` 并改用 `client` 执行
- [x] 1.3 为参与多步写的 repository 方法增加可选 `tx?: Database` 参数（末位），内部回退全局 `db`：`project.repository.ts`（softDeleteById、softDeleteByProjectId）、`directory.repository.ts`（softDeleteById、softDeleteByPathPrefix、updateById）、`file.repository.ts`（softDeleteByProjectId、softDeleteByPathPrefix、updateById、upsertByPath、updateByPath）
- [x] 1.4 修正 `directory.service.ts` 三处 `db.transaction(async () => {...})` 为接收 `tx` 并透传给内部 repo 调用（rename、move、delete）
- [x] 1.5 修正 `import-export.service.ts` 的导入事务回调，接收并透传 `tx`
- [x] 1.6 回归验证：directory 级联重命名/移动/删除、ZIP 导入在中途失败时确实回滚（手动造错或 review 代码路径）

## 2. P0 — `deleteProject` 事务化

- [x] 2.1 改写 `project.service.ts` 的 `deleteProject`，用 `db.transaction(async (tx) => {...})` 包裹 fileRepo/directoryRepo/projectRepo 三次软删并透传 `tx`
- [x] 2.2 验证：删除项目后其文件/目录均软删；模拟中途失败时整体回滚（无孤儿状态）

## 3. P0 — Route 层去 repository 化 + 校验去重

- [x] 3.1 改 `project.service.ts`：`createProject` 由透传 repo 改为带 `findByName` 唯一性校验（存在则抛 "Project name already exists"）
- [x] 3.2 改 `src/app/api/dbt/projects/route.ts` POST：移除直接调用 `projectRepo.findByName`，改用 `safeExecute(() => projectService.createProject(data))`
- [x] 3.3 改 `src/app/api/dbt/tasks/route.ts` POST：移除直接调用 `taskRepo.findByNameInProject`（service 内 `createTask` 已有该校验）
- [x] 3.4 确认 route 删除后 `import * as projectRepo` / `import * as taskRepo` 已不再被引用，移除死 import
- [x] 3.5 验证：创建重名项目/任务仍返回 409，语义文案不变

## 4. P0 — 抽取共享适配器校验

- [x] 4.1 新建 `src/app/server/services/dbt/shared/adapter-compatibility.ts`，导出 `validateAdapterCompatibility(adapterPackages, databaseType)`
- [x] 4.2 `environment.service.ts` 与 `task.service.ts` 改为 import 共享实现，删除各自的本地重复定义
- [x] 4.3 抽取 `task.service.ts` 中 createTask/updateTask 重复的「查 version+connection 并校验」逻辑为内部 `resolveAndValidateAdapter(environmentId)` helper
- [x] 4.4 验证：创建/更新环境与任务的适配器校验行为不变（不兼容时抛同样错误）

## 5. P1 — `target` 字段语义固化

- [x] 5.1 `src/app/server/schemas/dbt/task.schema.ts`：`target` 标 `.optional()` 并加注释「Phase-1 reserved, not used in command construction」
- [x] 5.2 前端任务表单（`src/web/features/dbt-task/` 下相关 form-modal）移除 `target` 输入控件，确保请求体不发送 target
- [x] 5.3 确认 `buildDbtCommand`（task-execution.service.ts）确实不拼 `--target`（已是现状，补注释引用 spec R14 已迁入）
- [x] 5.4 验证：任务表单无 target 输入；已有 target 值的任务运行时命令不含 `--target`

## 6. P1 — `dbt_project.yml` 来源统一

- [x] 6.1 `import-export.service.ts` 的 `SKIP_IMPORT_FILES` 移除 `dbt_project.yml`（保留 `packages.yml`）
- [x] 6.2 在 `task-workspace.service.ts` 物化逻辑中加入：当使用项目内 `dbt_project.yml` 时，校验其 `profile:` 字段 == 项目名 slugify 值；不一致则抛错中止运行
- [x] 6.3 确认 `materializeWorkspace` 在项目内无 `dbt_project.yml` 时仍自动生成最小化版本（现状逻辑，不改）
- [x] 6.4 验证：导入含 `dbt_project.yml` 的项目后该文件入库；运行时用项目内文件；profile 名不匹配时报错中止

## 7. P1 — 决策文档迁移

- [x] 7.1 把 `task-execution.service.ts` / `environment-init.service.ts` / `task-workspace.service.ts` / `task.service.ts` 头部注释中引用 `design.md` 的决策编号（R14/D8/O3/C2 等）改为引用本 change 对应 spec 路径
- [x] 7.2 核对迁移的决策内容与 specs 中 ADDED/MODIFIED requirement 一致（R14→dbt-task-execution target handling；O3/C2→Stale run reconciliation）

## 8. P2 — dbt parse 预检

- [x] 8.1 新建 `src/app/server/services/dbt/task-parse.service.ts`，实现 `parseProject(workspaceDir, venvPath): Promise<{ ok, exitCode, error? }>`（spawn `dbt parse --project-dir --profiles-dir`）
- [x] 8.2 在 `task-execution.service.ts` 的 `runExecution` 中，物化工作区后、spawn 实际命令前调用 parse；parse 失败则直接置 run 为 failed 并 publish done（携带 parse 错误），不 spawn 实际命令
- [x] 8.3 验证：含语法错误的工程运行时 run 快速 failed 且错误信息来自 parse；正确工程 parse 通过后正常 run

## 9. P2 — AI 写入内容校验

- [x] 9.1 新建 `src/app/server/agent/validation/dbt-content-validator.ts`：YAML 用 Zod 定义 dbt schema 结构（models/sources 的 name 必填）；SQL 做 Jinja 闭合 + 裸表名启发式检查；导出 `validateDbtContent(path, content): { ok, error? }`
- [x] 9.2 在 `DbProjectBackend.write/edit`（`backend/db-project-backend.ts`）落库前调用校验；失败抛结构化错误（不落库，交由 agent 自我修正）
- [x] 9.3 验证：AI 写入非法 YAML/SQL 时被拒并返回结构化错误；合法内容正常进入 HITL 流程
