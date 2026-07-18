## ADDED Requirements

### Requirement: Agent 接口强制鉴权
所有 `/api/agent/*` 接口 SHALL 强制登录，复用现有 JWT + `dp_auth` Cookie 认证体系。接口 SHALL 通过 `requireAuth()` 辅助函数（读取 Cookie → 调用 `auth.service.getCurrentUser`）获取当前用户；未登录或会话过期 SHALL 返回 401。获取到的 `userId` SHALL 贯穿 service 与 repository 层用于数据隔离。

#### Scenario: 已登录用户访问
- **WHEN** 已登录用户（携带有效 `dp_auth` Cookie）请求任意 `/api/agent/*` 接口
- **THEN** 系统 `requireAuth()` 解析出当前用户，请求继续处理，`userId` 传入后续 service/repository

#### Scenario: 未登录访问
- **WHEN** 未携带或携带无效/过期 Cookie 的请求访问任意 `/api/agent/*` 接口
- **THEN** 系统 SHALL 返回 401（错误信息"未登录"），不执行任何业务逻辑

#### Scenario: 访问他人会话
- **WHEN** 已登录用户 A 请求访问属于用户 B 的会话（如 GET `/api/agent/conversations/:id`，该会话 `userId` 为 B）
- **THEN** 系统 SHALL 返回 404（会话不存在），不泄露该会话存在与否

### Requirement: 流式对话接口
系统 SHALL 提供 `POST /api/agent/chat` 接口，接收 `{ conversationId: number, message: string }`，返回 `text/event-stream` 流式响应。接口 SHALL 调用 LangChain Agent 进行编排，并通过 SSE 事件逐阶段下发进度。

#### Scenario: 发起流式对话
- **WHEN** 客户端 POST `/api/agent/chat`，body 为 `{ "conversationId": 1, "message": "列出所有活跃项目" }`
- **THEN** 系统返回 200，Content-Type 为 `text/event-stream`，开始下发 SSE 事件流；接口 SHALL 先持久化 user 消息，再驱动 Agent 编排

#### Scenario: 校验请求
- **WHEN** 客户端 POST `/api/agent/chat`，body 缺少 `conversationId` 或 `message` 为空
- **THEN** 系统返回 400，错误信息指明缺失字段

#### Scenario: 会话不存在
- **WHEN** 客户端 POST `/api/agent/chat`，`conversationId` 对应的会话不存在或已删除
- **THEN** 系统返回 404，错误信息为"会话不存在"

### Requirement: SSE 事件协议
流式接口 SHALL 以 SSE 格式下发事件，每条事件为 `data: <JSON>\n\n`。事件 JSON SHALL 包含 `type` 字段，取值为 `token`、`tool_start`、`tool_end`、`message_end`、`error` 之一。

#### Scenario: token 事件
- **WHEN** Agent 的 LLM 产出一个文本 token
- **THEN** 系统下发 `{ "type": "token", "value": "<token 文本>" }`

#### Scenario: tool_start 事件
- **WHEN** Agent 决定调用一个工具
- **THEN** 系统下发 `{ "type": "tool_start", "tool": "<工具名>", "input": <入参对象> }`

#### Scenario: tool_end 事件
- **WHEN** 工具执行完成
- **THEN** 系统下发 `{ "type": "tool_end", "tool": "<工具名>", "output": <返回结果，已序列化为可 JSON 化结构> }`

#### Scenario: message_end 事件
- **WHEN** Agent 完成一轮回复（产出最终文本并停止）
- **THEN** 系统下发 `{ "type": "message_end", "messageId": <持久化后的 assistant 消息 ID> }`，随后关闭流

#### Scenario: error 事件
- **WHEN** Agent 编排过程中抛出异常（如 LLM 调用失败、工具执行异常）
- **THEN** 系统下发 `{ "type": "error", "message": "<错误描述>" }`，随后关闭流；接口 SHALL 不抛出未捕获异常导致连接非正常断开

### Requirement: Agent 编排
agent.service SHALL 使用 LangChain 的 tool-calling 能力编排 Agent。编排流程 SHALL 为：加载会话历史消息 → 转换为 LangChain 消息序列 → 绑定工具 → 驱动 LLM → 若 LLM 请求工具则执行工具并把结果作为 ToolMessage 喂回 → 重复直到 LLM 产出最终文本。编排过程中的每个阶段 SHALL emit 对应的 SSE 事件。

#### Scenario: 无需工具的直接回复
- **WHEN** 用户发送"你好"，LLM 无需调用工具即可回复
- **THEN** 编排仅 emit `token` 事件（逐 token）和最终的 `message_end` 事件，不 emit 任何 `tool_*` 事件

#### Scenario: 单次工具调用
- **WHEN** 用户发送"列出所有活跃项目"，LLM 决定调用 `list_projects` 工具
- **THEN** 编排依次 emit：`tool_start(list_projects)` → `tool_end(list_projects)` → `token`(最终回复) → `message_end`

#### Scenario: 多次工具调用
- **WHEN** LLM 在一轮回复中连续调用两个工具
- **THEN** 编排按调用顺序 emit 多对 `tool_start`/`tool_end` 事件，最后 emit `token` 和 `message_end`

#### Scenario: 工具执行异常
- **WHEN** 某个工具执行抛出异常
- **THEN** 编排 SHALL emit `error` 事件并停止，错误信息包含工具名和异常摘要；不持久化该轮 assistant 消息

### Requirement: LLM 接入工厂
系统 SHALL 提供 `createLLM()` 工厂函数，根据环境变量 `LLM_PROVIDER`（默认 `openai`）返回对应的 LangChain ChatModel 实例。首版 SHALL 支持 `openai` provider（兼容任意 OpenAI 协议服务）。

#### Scenario: 默认 OpenAI provider
- **WHEN** 环境变量 `LLM_PROVIDER` 未设置或为 `openai`
- **THEN** `createLLM()` 返回 `ChatOpenAI` 实例，使用 `OPENAI_API_KEY`、`OPENAI_BASE_URL`（可选）、`OPENAI_MODEL`（默认 `gpt-4o-mini`）配置

#### Scenario: 自定义 base URL
- **WHEN** 环境变量 `OPENAI_BASE_URL` 设置为兼容服务地址（如 DeepSeek）
- **THEN** `ChatOpenAI` 实例 SHALL 使用该 base URL，允许接入兼容 OpenAI 协议的第三方服务

#### Scenario: 缺少 API Key
- **WHEN** 调用 `createLLM()` 时对应的 API Key 环境变量未设置
- **THEN** `createLLM()` SHALL 抛出明确错误"LLM API Key 未配置（环境变量 <VAR_NAME>）"，便于排查

### Requirement: 消息持久化与历史重建
流式对话接口 SHALL 在编排前持久化 user 消息，在 `message_end` 前持久化 assistant 消息（含 tool_calls）。加载历史时 SHALL 从数据库重建完整的 LangChain 消息序列（HumanMessage / AIMessage / ToolMessage）。

#### Scenario: 持久化 user 消息
- **WHEN** 接口收到一条对话请求
- **THEN** 系统 SHALL 在驱动 Agent 前将 user 消息写入 `agent_messages`（role 为 `user`）

#### Scenario: 持久化 assistant 消息
- **WHEN** Agent 完成一轮回复并准备 emit `message_end`
- **THEN** 系统 SHALL 将 assistant 消息写入 `agent_messages`（role 为 `assistant`，content 为最终文本，tool_calls 为该轮的工具调用数组），用返回的 messageId 填充 `message_end` 事件

#### Scenario: 重建历史上下文
- **WHEN** 编排加载会话历史
- **THEN** 系统按时间顺序读取 `agent_messages`，将 role 为 `user` 的转为 HumanMessage、`assistant` 的转为 AIMessage（含 tool_calls）、`tool` 的转为 ToolMessage，组成完整上下文传给 LLM
