## Context

dbt 工程建设流程已完成四条链路（项目文件管理 / 运行环境 / 构建执行 / AI 辅助建设），分层遵循 `UI → api-client → route → service → repository → Drizzle`。但代码审计发现根因性问题：

**事务基础设施失效。** Drizzle 的事务语义要求 `db.transaction(async (tx) => {...})` 回调内使用传入的 `tx` 客户端执行 SQL，否则每条语句以各自连接自动提交，不构成事务。本项目所有 repository 硬绑定全局 `db` 单例（`db/index.ts:34`），而现有 `db.transaction` 调用（`directory.service.ts:97/156/192`、`import-export.service.ts:56`、以及 `project.service.ts` 漏写的 `deleteProject`）的回调都**没有接收 `tx`**，repository 也无从透传。因此现有所有"事务"都是假事务——这是数据一致性的系统性隐患，优先级最高。

此外存在分层违规（route 直接调 repo）、唯一性校验重复（route + service 各一次）、`validateAdapterCompatibility` 双份定义、`target` 死字段、`dbt_project.yml` 来源不一致、AI 写入无内容校验等。

约束：
- 双驱动（MySQL/SQLite），类型以 MySQL 为准，repository 代码必须驱动无关。
- `db.transaction` 回调签名跨驱动一致（都返回 `tx`，类型即 `Database`）。
- 不引入新运行时依赖。

## Goals / Non-Goals

**Goals:**
- 修复事务基础设施，使 repository 写操作可在真实事务中执行，并在 `deleteProject`、directory 级联、import-export 上落地。
- 消除 route 层 repository 访问与重复校验，回归 NON-NEGOTIABLE 分层规则。
- 统一重复的适配器校验逻辑。
- 固化 `target` 字段语义、统一 `dbt_project.yml` 来源（含安全校验）。
- 引入运行前 `dbt parse` 预检与 AI 写入内容校验，前置错误。
- 把散落的 `design.md` 决策迁入 openspec specs。

**Non-Goals:**
- 不做 dbt model/source 的领域化建模（保持文件驱动，仅在出现血缘需求时另立项）。
- 不引入分布式 checkpointer / 分布式锁（视部署形态另立项，本 change 仅记录约束）。
- 不实现多 target profile（`target` 字段仅隐藏 + 标注保留，不启用）。
- 不改对外 API 契约（行为更严格，错误码更准确，无新增/删除端点）。

## Decisions

### D1 — repository 通过可选 `tx` 参数参与事务，默认回退全局 `db`

**决策**：为需要参与多步事务的 repository 写方法增加末位可选参数 `tx?: Database`，方法内 `const client = tx ?? db;`。service 在 `db.transaction(async (tx) => {...})` 中把 `tx` 透传给参与同一事务的 repository 调用。

**理由**：
- 符合 Drizzle 事务语义（回调内必须用 `tx`）。
- `tx?` 可选 + 默认回退，保证现有非事务调用路径零改动（向后兼容），可渐进迁移。
- repository 仍是数据访问唯一入口（符合架构规则），只是多了一个执行上下文参数。

**备选**：
- *A. 全局线程局部变量（AsyncLocalStorage）隐式传 tx*：调用方无感知，但引入隐式依赖、调试困难、与 Drizzle 官方范式相悖，reject。
- *B. 给每个 repository 方法生成 tx/非 tx 两套*：代码翻倍，reject。
- *C. 让 repository 全部接收 tx 必填*：破坏所有现有单次调用，改动面巨大，reject。

**类型契约**：在 `db/index.ts` 导出 `export type Database = typeof db;`（已存在，直接复用），repository 方法签名 `tx?: Database`。

**范围**：只改参与多步写的方法（project 的 softDelete*、directory 的 softDelete*/updateById、file 的 softDelete*/updateById、task 的 createTask/updateById 等）。纯单次读查询不改（无一致性收益）。`insertReturningId` 也加 `tx?` 参数以支持事务内插入返回 id。

### D2 — `deleteProject` 级联软删纳入事务

**决策**：`project.service.ts` 的 `deleteProject` 用 `db.transaction(async (tx) => { fileRepo.softDeleteByProjectId(id, tx); directoryRepo.softDeleteByProjectId(id, tx); projectRepo.softDeleteById(id, tx); })`。

**理由**：三次软删原子化，避免 files 已删但 project 未删的孤儿状态。directory.service 的级联删除已是同样模式（修正 tx 后对齐）。

### D3 — 唯一性校验下沉 service，route 回归 thin

**决策**：
- `project.service.createProject` 由"直接透传 repo"改为带唯一性校验的函数：先 `findByName`，存在则 `throw new Error("Project name already exists")`。
- `projects/route.ts` POST 删除直接调 `projectRepo.findByName`，改用 `safeExecute(() => projectService.createProject(data))`，靠 `safeExecute` 的 "already exists" → 409 映射。
- `tasks/route.ts` POST 删除直接调 `taskRepo.findByNameInProject`；`task.service.createTask` 已有唯一性校验并抛 "任务名称在项目内已存在"，route catch 已能映射 409，去重完成。

**理由**：消除 2 处 route→repo 违规 + 1 处 route/service 重复；错误语义不变（仍是 409）。

**备选**：*完全依赖 DB 唯一约束捕获*——更彻底但有缺陷：DB 抛的是底层错误码（MySQL 1062 / SQLite SQLITE_CONSTRAINT），要再映射成友好中文消息反而更绕，且无法做"项目内 name 唯一"这种带条件的唯一性。保留 service 层显式校验，DB 唯一索引作为最终兜底。

### D4 — 抽取共享适配器校验

**决策**：新建 `src/app/server/services/dbt/shared/adapter-compatibility.ts`，导出 `validateAdapterCompatibility(adapterPackages, databaseType)`。`environment.service.ts` 和 `task.service.ts` 改为 import。顺带抽取 task.service 内 createTask/updateTask 重复的 "查 version+connection 并校验" 逻辑为内部 `resolveAndValidateAdapter(envId)` helper。

**理由**：消除完全相同的双份逻辑，符合"不创建重复功能"规则。

### D5 — `target` 字段语义固化为"第一阶段保留字段"

**决策**：
- 前端任务表单移除 `target` 输入控件（不展示）。
- `task.schema.ts` 的 `target` 标 `.optional()` 并加注释「Phase-1 reserved, not used in command construction」。
- 数据库字段保留不动（前向兼容）。
- 在 `dbt-task-execution` spec 的 "dbt command construction" requirement 中固化"phase-1 不传 --target"（原 spec 已有此约束，本 change 显式确认并保留）。

**理由**：消除"用户可填但无效"的误导。不做多 target，因为当前 profiles.yml 是单 default target（见 D6），无对应实现。

**备选**：*真正实现多 target*——需 profiles.yml 支持多 output、前端 target 选择、dbt_project.yml 多环境，工作量大且无明确需求，reject（留作未来 change）。

### D6 — `dbt_project.yml` 来源统一为"项目内文件优先，缺失才自动生成"

**决策**：
- `import-export.service.ts` 的 `SKIP_IMPORT_FILES` 移除 `dbt_project.yml`（保留 `packages.yml` 跳过，因其依赖安装是另一回事）。
- `task-workspace.service.ts` 的 `materializeWorkspace` 逻辑不变（已是"无则生成"），天然兼容。
- **安全校验**：物化时若使用项目内 `dbt_project.yml`，校验其 `profile:` 字段必须等于由项目名 slugify 生成的 profile 名（即与生成的 `profiles.yml` 顶层 key 一致），不一致则报错中止运行——防止导入的 `dbt_project.yml` 指向外部 profile 名导致连错库。

**理由**：导入的真实项目丢失 `dbt_project.yml` 配置（model-paths/profile 等）是当前 bug；放行后用户能带配置导入，运行物化自动优先用之。

**备选**：*继续跳过并强制用最小化生成*——丢失用户配置，reject。

**风险**：导入的 `dbt_project.yml` 可能含 `profile:` 指向其他名字 → 由 D6 安全校验拦截（报错并提示用户修正 profile 名）。

### D7 — 运行前 `dbt parse` 预检（可选触发）

**决策**：新增 `task-parse.service.ts`，暴露 `parseProject(projectId, environmentId): Promise<{ ok: boolean; error?: string }>`。复用 `task-workspace.service` 物化工作区 + 现有 venv，执行 `dbt parse`（秒级），捕获结果。

**触发点（保守）**：
- 不在每次文件保存自动触发（防骚扰、防性能损耗）。
- 在 `runTask`（task-execution.service）真正 spawn dbt 命令**之前**调用 parse；parse 失败则 run 直接置 failed 并返回 parse 错误（不浪费完整 run 的资源）。
- 可选暴露一个独立 `POST /api/dbt/projects/:id/parse` 端点供前端"检查"按钮调用（本 change 范围内只做 service + runTask 集成，端点作为后续可选）。

**理由**：把 SQL/YAML/ref 语法错误从"运行时"前置到"运行前"，与 AI 辅助建设结合时还能把错误反馈给 Agent 自我修正。

### D8 — AI 写入内容结构化校验

**决策**：新增 `src/app/server/agent/validation/dbt-content-validator.ts`，在 `DbProjectBackend.write/edit`（`db-project-backend.ts:152,183`）落库前调用：
- `.yml/.yaml`：用 Zod 定义 dbt schema 文件结构（models/sources 列表的 name、columns 等必填），parse 失败抛结构化错误。
- `.sql`：基础检查（Jinja `{{ }}` 闭合、是否误用裸表名而非 ref()/source() 的简单启发式）。
- 校验失败**不落库**，抛错回给 deepagents，Agent 收到错误后自我修正重写（比人工 HITL reject 更高效）。

**理由**：HITL 只审"是否允许写"，不审"内容对不对"；内容校验前置能在 AI 生成阶段拦截低级错误。

**备选**：*校验失败直接拒绝并等人工*——丧失 AI 自我修正的闭环优势，reject。

### D9 — 决策文档迁移

**决策**：把 service 头部注释引用的已丢失 `design.md` 决策（R14 单 target、D8 适配器校验、O3 reconcileStaleRuns、C2 僵尸阈值等）迁入本 change 对应的 specs（主要落在 `dbt-task-execution` 的 MODIFIED/ADDED requirement）。service 注释改为引用 openspec spec 路径。

## Risks / Trade-offs

- **[风险] D1 事务修复涉及面广，回归成本高** → 分阶段：P0-D1/D2/D3/D4 独立成第一批 commit，先合；directory 级联、import-export、项目删除三条路径重点回归。`tx?` 可选回退保证非事务路径零改动，降低爆破面。
- **[风险] D6 放行 `dbt_project.yml` 导入可能引入恶意/错误配置** → 由 profile 名一致性校验（D6 安全校验）兜底，指向不一致即报错中止。
- **[风险] D7 parse 预检增加每次 run 的延迟** → `dbt parse` 通常秒级，且在真正 run 前，避免的是整轮失败 run 的更大浪费；接受该 trade-off。物化工作区已存在，复用无额外 IO。
- **[风险] D8 内容校验误判导致 AI 反复重写死循环** → 校验只覆盖明确错误（YAML 语法、必填缺失），不做主观质量判断；deepagents 本身有最大迭代次数保护。
- **[Trade-off] D1 选择显式 `tx` 参数而非 AsyncLocalStorage** → 调用方需显式透传，略繁琐，但显式优于隐式（符合 AGENTS.md "Prefer explicit code over abstraction"），且调试友好。
- **[Trade-off] D5 不实现多 target** → 短期隐藏字段，未来要多 target 时需另开 change（profiles 多 output + 前端选择），但当前无需求，避免过度设计。
