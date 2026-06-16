## ADDED Requirements

### Requirement: 工具基类契约
工具包 SHALL 定义 `BaseAgentTool` 抽象基类，所有内置工具 SHALL 继承该基类。基类 SHALL 规定每个工具必须提供：唯一的 `name`、`description`、Zod 定义的参数 schema、以及异步 `execute(args)` 方法。工具 SHALL 通过基类统一转换为 LangChain 可识别的工具定义。

#### Scenario: 工具实现规范
- **WHEN** 开发者新增一个工具
- **THEN** 该工具 SHALL 继承 `BaseAgentTool`，实现 `name`、`description`、`schema`（Zod）和 `execute()`，无需关心 LangChain 适配细节

#### Scenario: 工具名唯一性
- **WHEN** 两个工具声明了相同的 `name`
- **THEN** 注册中心在注册时 SHALL 抛出错误"工具名冲突：<name>"，避免运行时歧义

### Requirement: 工具注册中心
工具包 SHALL 提供 `tool-registry.ts` 注册中心，聚合所有内置工具实例并导出 `getAgentTools()`。agent.service SHALL 仅依赖 `getAgentTools()` 获取工具列表，不直接 import 具体工具实现。新增工具 SHALL 只需新建工具文件并在 registry 中注册一行。

#### Scenario: 获取工具列表
- **WHEN** agent.service 调用 `getAgentTools()`
- **THEN** 返回所有已注册工具的实例数组，数组中每个工具满足 `BaseAgentTool` 契约

#### Scenario: 新增工具的扩展流程
- **WHEN** 开发者希望新增一个"查询项目文件数"的工具
- **THEN** 扩展步骤 SHALL 为：①在 `tools/project/` 下新建 `count-files.tool.ts` 继承基类 ②在 `tool-registry.ts` 的注册列表中添加该工具实例。agent.service、API 层、前端均无需改动

#### Scenario: 转换为 LangChain 工具
- **WHEN** agent.service 需要将工具绑定到 LLM
- **THEN** registry 或基类 SHALL 提供将 `BaseAgentTool[]` 转换为 LangChain `StructuredTool` / `bindTools` 所需格式的方法（含 name、description、schema）

### Requirement: 内置工具 — list_projects
工具包 SHALL 提供 `list_projects` 工具，供 Agent 查询项目列表。工具 SHALL 复用现有 `project.repository` 的 `findList` 方法，不直接访问 Drizzle。

#### Scenario: 查询项目列表
- **WHEN** Agent 调用 `list_projects({ status?: "active" | "archived", limit?: number, offset?: number })`
- **THEN** 工具通过 `project.repository.findList` 查询，返回 `{ items: Project[], total, limit, offset }`

#### Scenario: 默认参数
- **WHEN** Agent 调用 `list_projects({})` 不传任何参数
- **THEN** 工具 SHALL 使用默认值（limit 20、offset 0、不按 status 过滤）查询

### Requirement: 内置工具 — get_project
工具包 SHALL 提供 `get_project` 工具，按 ID 查询单个项目详情。工具 SHALL 复用 `project.repository.findById`。

#### Scenario: 查询存在的项目
- **WHEN** Agent 调用 `get_project({ id: 1 })` 且项目存在
- **THEN** 工具返回该项目的完整信息（id、name、description、status、createdAt 等）

#### Scenario: 查询不存在的项目
- **WHEN** Agent 调用 `get_project({ id: 9999 })` 且项目不存在
- **THEN** 工具 SHALL 返回 `null` 或明确的"未找到"结构，便于 Agent 据此回应用户；不抛出异常中断编排

### Requirement: 内置工具 — list_files
工具包 SHALL 提供 `list_files` 工具，列出指定项目下的文件。工具 SHALL 复用 `file.repository`（或 directory 相关 repository）的查询方法。

#### Scenario: 列出项目文件
- **WHEN** Agent 调用 `list_files({ projectId: 1 })`
- **THEN** 工具返回该项目下的文件列表（每项含 id、name、type、directoryId 等），不返回文件内容（内容读取用 read_file）

### Requirement: 内置工具 — read_file
工具包 SHALL 提供 `read_file` 工具，读取指定文件的内容。工具 SHALL 复用 `file.repository` 的读取方法。

#### Scenario: 读取文件内容
- **WHEN** Agent 调用 `read_file({ projectId: 1, fileId: 10 })`
- **THEN** 工具返回 `{ id, name, type, content }`，content 为文件文本内容

#### Scenario: 文件过大保护
- **WHEN** 文件内容超过 50000 字符
- **THEN** 工具 SHALL 截断内容并在返回结构中标注 `truncated: true` 和原始长度，避免上下文超限

### Requirement: 内置工具 — list_dbt_versions
工具包 SHALL 提供 `list_dbt_versions` 工具，查询 dbt 版本列表。工具 SHALL 复用 `version.repository` 的查询方法。

#### Scenario: 查询版本列表
- **WHEN** Agent 调用 `list_dbt_versions({})`
- **THEN** 工具返回所有 dbt 版本记录（id、version、isActive、createdAt 等）

### Requirement: 工具仅限查询
首版工具包 SHALL 只包含查询类工具，不包含任何写操作（创建、更新、删除）工具。

#### Scenario: 无写工具暴露
- **WHEN** 检查 `getAgentTools()` 返回的工具列表
- **THEN** 所有工具的 `execute()` 均为只读操作，不存在能够修改数据库状态的工具
