## 1. 依赖安装与环境配置

- [ ] 1.1 安装 LangChain 依赖：`@langchain/core`、`@langchain/openai`、`langchain`（确认与 Next.js 16 / React 19 兼容性）
- [ ] 1.2 更新 `.env.example`，新增 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 变量及说明

## 2. 数据库 Schema 与 Migration

- [ ] 2.1 创建 `src/app/db/schema/mysql/agent-conversation.ts`，定义 `agentConversations` 表（id、title、createdAt、updatedAt、deletedAt）
- [ ] 2.2 创建 `src/app/db/schema/sqlite/agent-conversation.ts`，定义 SQLite 版本的 `agentConversations` 表（字段一致，类型映射 SQLite）
- [ ] 2.3 创建 `src/app/db/schema/mysql/agent-message.ts`，定义 `agentMessages` 表（id、conversationId、role enum、content、toolCalls json、toolCallId、createdAt，外键关联 agent_conversations.id）
- [ ] 2.4 创建 `src/app/db/schema/sqlite/agent-message.ts`，定义 SQLite 版本的 `agentMessages` 表（toolCalls 用 text 存储，repository 层做 JSON 序列化）
- [ ] 2.5 在 `src/app/db/schema/mysql/index.ts` 和 `sqlite/index.ts` 中导出两张新表及类型
- [ ] 2.6 在 `src/app/db/schema/index.ts` facade 中新增 `agentConversations`、`agentMessages` 导出及对应的 `New*` / `*` 类型 re-export
- [ ] 2.7 在 `src/app/db/relations/` 中新增会话-消息的 relations 定义
- [ ] 2.8 运行 `drizzle-kit generate` 生成 MySQL 和 SQLite 两套 migration（切换 `DB_DRIVER` 各跑一次），检查生成结果不手动编辑
- [ ] 2.9 运行 `drizzle-kit migrate`（或 `db:sqlite:migrate`）应用 migration，验证表创建成功

## 3. Repository 层（持久化）

- [ ] 3.1 创建 `src/app/server/repositories/agent/conversation.repository.ts`，实现 `create`、`findById`、`findList`（分页 + 排除软删除 + 倒序）、`updateTitle`、`softDelete`
- [ ] 3.2 创建 `src/app/server/repositories/agent/message.repository.ts`，实现 `create`（单条，含 role/content/toolCalls 序列化/toolCallId）、`findByConversationId`（正序）、`createBatch`（可选，批量插入）
- [ ] 3.3 确认两个 repository 复用 `db` 单例和 `insertReturningId`，不重复实例化数据库，遵循软删除与命名约定

## 4. Schema 校验层

- [ ] 4.1 创建 `src/app/server/schemas/agent/conversation.schema.ts`，定义 Zod schema：`createConversationSchema`（title 可选）、`listConversationsQuerySchema`（limit/offset）、`conversationIdSchema`
- [ ] 4.2 创建 `src/app/server/schemas/agent/chat.schema.ts`，定义 `sendChatSchema`（conversationId 必填、message 非空字符串）

## 5. LLM 接入工厂

- [ ] 5.1 创建 `src/app/server/agent/llm/providers/openai.ts`，封装 `ChatOpenAI` 实例化逻辑（读取 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，缺 key 时抛明确错误）
- [ ] 5.2 创建 `src/app/server/agent/llm/index.ts`，实现 `createLLM()` 工厂，按 `LLM_PROVIDER`（默认 `openai`）分发到对应 provider

## 6. 工具包模块（agent-tools）

- [ ] 6.1 创建 `src/app/server/agent/tools/base-tool.ts`，定义 `BaseAgentTool` 抽象基类（name、description、zod schema、execute；提供 `toLangChainTool()` 或等价转换方法）
- [ ] 6.2 创建 `src/app/server/agent/tools/project/list-projects.tool.ts`，继承基类，复用 `project.repository.findList`
- [ ] 6.3 创建 `src/app/server/agent/tools/project/get-project.tool.ts`，继承基类，复用 `project.repository.findById`
- [ ] 6.4 创建 `src/app/server/agent/tools/project/list-files.tool.ts`，继承基类，复用 `file.repository`（确认现有查询方法，按需扩展 repository 而非在工具里写查询）
- [ ] 6.5 创建 `src/app/server/agent/tools/project/read-file.tool.ts`，继承基类，复用 `file.repository`，实现超 50000 字符截断 + `truncated` 标记
- [ ] 6.6 创建 `src/app/server/agent/tools/dbt/list-dbt-versions.tool.ts`，继承基类，复用 `version.repository`
- [ ] 6.7 创建 `src/app/server/agent/tools/tool-registry.ts`，实例化所有工具，做 name 唯一性校验，导出 `getAgentTools()`
- [ ] 6.8 创建 `src/app/server/agent/tools/index.ts`，统一对外出口（re-export `getAgentTools`、`BaseAgentTool`）

## 7. Agent 编排 Service

- [ ] 7.1 创建 `src/app/server/agent/types.ts`，定义 `ChatStreamEvent` 联合类型（token / tool_start / tool_end / message_end / error）
- [ ] 7.2 创建 `src/app/server/agent/message-mapper.ts`，实现 DB 消息记录 ↔ LangChain 消息（HumanMessage / AIMessage / ToolMessage）的双向转换，正确处理 toolCalls 和 toolCallId
- [ ] 7.3 创建 `src/app/server/agent/agent.service.ts`，实现 `streamChat(conversationId, message, emit)`：
  - 持久化 user 消息 + 首条消息生成标题（仅当标题为"新对话"）
  - 加载历史 → 转换为 LangChain 消息序列
  - `createLLM().bindTools(getAgentTools())` 驱动 Agent 循环
  - 循环内 emit `tool_start` / `tool_end` / `token` 事件
  - 完成后持久化 assistant 消息（含 toolCalls），emit `message_end`（带 messageId）
  - 异常时 emit `error` 并停止，不持久化该轮 assistant 消息

## 8. 会话 CRUD Service 与 API 路由

- [ ] 8.1 创建 `src/app/server/services/agent/conversation.service.ts`，封装会话 CRUD 业务（调用 conversation.repository，含"首条消息生成标题"逻辑的触发点）
- [ ] 8.2 创建 `src/app/api/agent/conversations/route.ts`，实现 GET（列表）和 POST（创建），保持 thin（校验 → service → 响应）
- [ ] 8.3 创建 `src/app/api/agent/conversations/[id]/route.ts`，实现 GET（详情）和 DELETE（软删除）
- [ ] 8.4 创建 `src/app/api/agent/conversations/[id]/messages/route.ts`，实现 GET（会话消息列表，校验会话存在）
- [ ] 8.5 创建 `src/app/api/agent/chat/route.ts`，实现 POST 流式接口：校验 → 持久化 user 消息 → 调用 `agent.service.streamChat` → 以 `text/event-stream` 下发 SSE 事件 → 正确关闭流

## 9. API Client 层

- [ ] 9.1 创建 `src/web/api-client/agent.ts`，实现 `conversationApi`（list / get / create / delete / getMessages）和 `chatApi.streamChat`（返回 `ReadableStream` 或 `Response` 供前端解析 SSE）
- [ ] 9.2 在 `src/web/api-client/index.ts` 中导出 `conversationApi` 和 `chatApi`
- [ ] 9.3 创建 `src/web/types/agent.ts`，定义 `AgentConversation`、`AgentMessage`、`ChatStreamEvent` 等前端类型

## 10. 前端 Hooks

- [ ] 10.1 创建 `src/web/features/agent/hooks/use-conversations.ts`，管理会话列表状态（加载、新建、删除、刷新），参考现有 `use-projects.ts` 模式
- [ ] 10.2 创建 `src/web/features/agent/hooks/use-conversation-messages.ts`，管理单会话历史消息加载
- [ ] 10.3 创建 `src/web/features/agent/hooks/use-agent-chat.ts`，管理流式对话：发送消息、解析 SSE 事件、追加 token、维护工具调用卡片状态、生成中指示器、错误处理

## 11. 前端组件

- [ ] 11.1 创建 `src/web/features/agent/components/agent-chat-layout.tsx`，左右二级布局（左会话列表 + 右对话区），组合子组件
- [ ] 11.2 创建 `src/web/features/agent/components/conversation-list.tsx`，会话列表面板（新建按钮、会话项、删除按钮、选中高亮）
- [ ] 11.3 创建 `src/web/features/agent/components/message-list.tsx`，消息流渲染（user 右对齐 / assistant 左对齐 / Markdown 渲染 / 自动滚到底部）
- [ ] 11.4 创建 `src/web/features/agent/components/message-bubble.tsx`，单条消息气泡（区分 user/assistant 样式，assistant 支持 Markdown）
- [ ] 11.5 创建 `src/web/features/agent/components/tool-call-card.tsx`，工具调用步骤卡片（工具名、入参折叠、进行中/完成状态、结果摘要展开）
- [ ] 11.6 创建 `src/web/features/agent/components/chat-input.tsx`，消息输入框（多行、Enter 发送、Shift+Enter 换行、空消息禁用、生成中禁用）
- [ ] 11.7 创建 `src/web/features/agent/components/typing-indicator.tsx`，"正在输入"动画指示器
- [ ] 11.8 创建 `src/web/features/agent/components/empty-state.tsx`，对话区空状态（无选中会话 / 无消息两种提示）

## 12. 主站导航集成

- [ ] 12.1 在 `src/web/constants/menu-config.ts` 新增 `agent-chat` 菜单项（key、label"AI 助手"、icon）
- [ ] 12.2 在 `src/web/components/layout/content-panel.tsx` 的 `contentMap` 中注册 `agent-chat` 视图，渲染 `AgentChatLayout`

## 13. 联调与验证

- [ ] 13.1 端到端验证：新建会话 → 发送"列出所有活跃项目" → 观察工具调用卡片 → 观察流式 token → 验证消息持久化（刷新页面后历史仍在）
- [ ] 13.2 验证多轮工具调用场景（如"列出项目，然后读取第一个项目的 schema.yml"）
- [ ] 13.3 验证错误处理：断开 LLM 配置或制造工具异常，确认前端显示错误提示且不崩溃
- [ ] 13.4 验证双驱动：在 SQLite 和 MySQL（若可用）下各跑一次会话 CRUD 与对话，确认 JSON 字段行为一致
- [ ] 13.5 运行 `npm run lint` 确认无 lint 错误，检查文件行数符合项目规范（组件 < 150 行、route < 50 行、service < 200 行）
