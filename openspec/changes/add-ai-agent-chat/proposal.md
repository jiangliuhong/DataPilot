## Why

DataPilot 已具备完整的项目、文件、版本、连接和环境管理能力，但用户操作数据资产仍需在多个列表页之间手动跳转、查找和拼接信息。引入 AI Agent 对话页，可以让用户用自然语言直接查询和操作数据资产（"列出活跃项目"、"读取某项目的 schema.yml"），大幅降低使用门槛。LangChain 的工具（tool）是 Agent 能力的核心扩展点，需要在一个高内聚、低耦合的模块里统一维护，以便后续按域持续扩展。

## What Changes

- 新增 AI Agent 对话页（左侧会话列表 + 右侧对话区），作为主站侧边栏的一级菜单入口
- 新增对话区组件：消息流（区分 user/assistant/tool 消息）、输入框、流式渲染、工具调用步骤可视化（显示"正在调用 list_projects..."、工具入参、工具返回摘要）
- 新增后端 SSE 流式接口 `POST /api/agent/chat`，基于 LangChain 实现 Agent，逐 token 下发内容并在工具调用阶段下发结构化事件
- 新增 LLM 接入层：`createLLM()` 工厂函数，按环境变量 `LLM_PROVIDER`（默认 `openai`）分发到 `ChatOpenAI`（兼容 OpenAI 协议的任意服务）/ 后续可扩展 Anthropic 等
- 新增独立工具包模块 `src/app/server/agent/tools/`：定义 `BaseAgentTool` 基类 + `tool-registry.ts` 注册中心 + 内置首版工具（list_projects、get_project、list_files、read_file、list_dbt_versions）。每个工具一个文件，通过 registry 聚合，新增工具只需新建文件并在 registry 注册
- 新增数据库表 `agent_conversations` 和 `agent_messages`，支持多会话管理、历史记录持久化、软删除
- 新增完整的 repository / service / schema / api-client / hooks 层，严格遵循项目分层架构

## Capabilities

### New Capabilities
- `agent-chat-ui`: AI Agent 对话页前端，包括会话列表、消息流、输入框、流式渲染、工具调用步骤可视化、会话切换与新建
- `agent-chat-api`: AI Agent 后端流式对话接口、LangChain Agent 编排、LLM 工厂、SSE 事件协议
- `agent-tools`: 独立工具包模块，定义工具基类、注册中心、内置数据资产查询工具，支持按域扩展
- `agent-conversation-persistence`: 对话会话与消息的持久化（schema、migration、repository、service）

### Modified Capabilities
<!-- 当前 openspec/specs/ 为空（无已归档 spec），本变更为全新功能，不修改既有 spec 的 requirement。 -->

## Impact

- **前端**: 新增 `src/web/features/agent/` 特性模块（组件、hooks），新增 `src/web/api-client/agent.ts`，修改 `menu-config.ts` 增加菜单项，修改 `content-panel.tsx` 注册新视图
- **后端 API**: 新增 `src/app/api/agent/` 路由（SSE 流式 + 会话 CRUD）
- **后端服务**: 新增 `src/app/server/agent/` 模块（agent.service / llm 工厂 / tools 工具包 / 工具注册中心）
- **后端持久化**: 新增 `src/app/server/repositories/agent/`、`src/app/server/schemas/agent/`，新增 `src/app/db/schema/{mysql,sqlite}/agent-conversation.ts`、`agent-message.ts`，新增对应 relations 与 migration
- **依赖**: 需引入 `@langchain/core`、`@langchain/openai`、`@langchain/langgraph`（或 `langchain` 主包的 agent 能力）以及 `zod`（已有）。需确认与 Next.js 16 的兼容性
- **环境变量**: 新增 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`（或对应 provider 的密钥），更新 `.env.example`
- **类型**: 新增 `AgentConversation`、`AgentMessage`、`ChatStreamEvent` 等类型定义
