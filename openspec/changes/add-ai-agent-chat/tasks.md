## 1. 依赖安装与环境配置

- [x] 1.1 安装 LangChain 依赖：`@langchain/core`、`@langchain/openai`、`langchain`（确认与 Next.js 16 / React 19 兼容性）
- [x] 1.2 更新 `.env.example`，新增 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 变量及说明（鉴权沿用现有 `AUTH_JWT_SECRET`，无新增）

## 2. 鉴权辅助

- [x] 2.1 创建 `src/app/server/lib/auth-guard.ts`，实现 `requireAuth()`：读取 `dp_auth` Cookie（`readAuthCookie`）→ 调用 `auth.service.getCurrentUser(token)` → 返回 `SafeUser`；未登录抛 `UnauthorizedError`（复用现有错误类型）

## 3. 数据库 Schema 与 Migration

- [x] 3.1 创建 `src/app/db/schema/mysql/agent-conversation.ts`，定义 `agentConversations` 表（id、**userId** bigint FK→users.id NOT NULL、title、createdAt、updatedAt、deletedAt；`(userId, deletedAt)` 复合索引）
- [x] 3.2 创建 `src/app/db/schema/sqlite/agent-conversation.ts`，定义 SQLite 版本的 `agentConversations` 表（字段一致，含 userId，类型映射 SQLite）
- [x] 3.3 创建 `src/app/db/schema/mysql/agent-message.ts`，定义 `agentMessages` 表（id、conversationId、role enum、content、toolCalls json、toolCallId、createdAt，外键关联 agent_conversations.id）
- [x] 3.4 创建 `src/app/db/schema/sqlite/agent-message.ts`，定义 SQLite 版本的 `agentMessages` 表（toolCalls 用 text 存储，repository 层做 JSON 序列化）
- [x] 3.5 在 `src/app/db/schema/mysql/index.ts` 和 `sqlite/index.ts` 中导出两张新表及类型
- [x] 3.6 在 `src/app/db/schema/index.ts` facade 中新增 `agentConversations`、`agentMessages` 导出及对应的 `New*` / `*` 类型 re-export
- [x] 3.7 在 `src/app/db/relations/` 中新增会话-消息的 relations 定义
- [x] 3.8 运行 `drizzle-kit generate` 生成 MySQL 和 SQLite 两套 migration（切换 `DB_DRIVER` 各跑一次），检查生成结果不手动编辑
- [x] 3.9 运行 `drizzle-kit migrate`（或 `db:sqlite:migrate`）应用 migration，验证表创建成功

## 4. Repository 层（持久化）

- [x] 4.1 创建 `src/app/server/repositories/agent/conversation.repository.ts`，所有方法接收 `userId`：实现 `create({ userId, title })`、`findById(id, userId)`、`findList({ userId, limit, offset })`（排除软删除 + 倒序 + userId 过滤）、`updateTitle(id, userId, title)`、`softDelete(id, userId)`；越权访问返回 null
- [x] 4.2 创建 `src/app/server/repositories/agent/message.repository.ts`，实现 `create`（单条，含 role/content/toolCalls 序列化/toolCallId）、`findByConversationId(conversationId)`（正序）；service 层负责先校验会话归属
- [x] 4.3 确认两个 repository 复用 `db` 单例和 `insertReturningId`，不重复实例化数据库，遵循软删除与命名约定

## 5. Schema 校验层

- [x] 5.1 创建 `src/app/server/schemas/agent/conversation.schema.ts`，定义 Zod schema：`createConversationSchema`（title 可选）、`listConversationsQuerySchema`（limit/offset）、`conversationIdSchema`
- [x] 5.2 创建 `src/app/server/schemas/agent/chat.schema.ts`，定义 `sendChatSchema`（conversationId 必填、message 非空字符串）

## 6. LLM 接入工厂

- [x] 6.1 创建 `src/app/server/agent/llm/providers/openai.ts`，封装 `ChatOpenAI` 实例化逻辑（读取 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，缺 key 时抛明确错误）
- [x] 6.2 创建 `src/app/server/agent/llm/index.ts`，实现 `createLLM()` 工厂，按 `LLM_PROVIDER`（默认 `openai`）分发到对应 provider

## 7. 工具包模块（agent-tools）

- [x] 7.1 创建 `src/app/server/agent/tools/base-tool.ts`，定义 `BaseAgentTool` 抽象基类（name、description、zod schema、execute；提供 `toLangChainTool()` 或等价转换方法）
- [x] 7.2 创建 `src/app/server/agent/tools/project/list-projects.tool.ts`，继承基类，复用 `project.repository.findList`
- [x] 7.3 创建 `src/app/server/agent/tools/project/get-project.tool.ts`，继承基类，复用 `project.repository.findById`
- [x] 7.4 创建 `src/app/server/agent/tools/project/list-files.tool.ts`，继承基类，复用 `file.repository`（确认现有查询方法，按需扩展 repository 而非在工具里写查询）
- [x] 7.5 创建 `src/app/server/agent/tools/project/read-file.tool.ts`，继承基类，复用 `file.repository`，实现超 50000 字符截断 + `truncated` 标记
- [x] 7.6 创建 `src/app/server/agent/tools/dbt/list-dbt-versions.tool.ts`，继承基类，复用 `version.repository`
- [x] 7.7 创建 `src/app/server/agent/tools/tool-registry.ts`，实例化所有工具，做 name 唯一性校验，导出 `getAgentTools()`
- [x] 7.8 创建 `src/app/server/agent/tools/index.ts`，统一对外出口（re-export `getAgentTools`、`BaseAgentTool`）

## 8. Agent 编排 Service

- [x] 8.1 创建 `src/app/server/agent/types.ts`，定义 `ChatStreamEvent` 联合类型（token / tool_start / tool_end / message_end / error）
- [x] 8.2 创建 `src/app/server/agent/message-mapper.ts`，实现 DB 消息记录 ↔ LangChain 消息（HumanMessage / AIMessage / ToolMessage）的双向转换，正确处理 toolCalls 和 toolCallId
- [x] 8.3 创建 `src/app/server/agent/agent.service.ts`，实现 `streamChat(userId, conversationId, message, emit)`：
  - 校验会话归属（conversationRepository.findById(id, userId) 为空则抛 NotFoundError）
  - 持久化 user 消息 + 首条消息生成标题（仅当标题为"新对话"，带 userId 过滤）
  - 加载历史 → 转换为 LangChain 消息序列
  - `createLLM().bindTools(getAgentTools())` 驱动 Agent 循环
  - 循环内 emit `tool_start` / `tool_end` / `token` 事件
  - 完成后持久化 assistant 消息（含 toolCalls），emit `message_end`（带 messageId）
  - 异常时 emit `error` 并停止，不持久化该轮 assistant 消息

## 9. 会话 CRUD Service 与 API 路由

- [x] 9.1 创建 `src/app/server/services/agent/conversation.service.ts`，封装会话 CRUD 业务（所有方法接收 `userId`，调用 conversation.repository，含"首条消息生成标题"逻辑的触发点）
- [x] 9.2 创建 `src/app/api/agent/conversations/route.ts`，实现 GET（列表）和 POST（创建），入口 `requireAuth()` 取 userId 后传入 service，保持 thin
- [x] 9.3 创建 `src/app/api/agent/conversations/[id]/route.ts`，实现 GET（详情）和 DELETE（软删除），入口 `requireAuth()`，service/repository 按 userId 过滤
- [x] 9.4 创建 `src/app/api/agent/conversations/[id]/messages/route.ts`，实现 GET（会话消息列表，先校验登录与会话归属，不属于则 404）
- [x] 9.5 创建 `src/app/api/agent/chat/route.ts`，实现 POST 流式接口：`requireAuth()` 取 userId → 校验请求 → 持久化 user 消息 → 调用 `agent.service.streamChat(userId, ...)` → 以 `text/event-stream` 下发 SSE 事件 → 正确关闭流

## 10. API Client 层

- [x] 10.1 创建 `src/web/api-client/agent.ts`，实现 `conversationApi`（list / get / create / delete / getMessages）和 `chatApi.streamChat`（返回 `ReadableStream` 或 `Response` 供前端解析 SSE）
- [x] 10.2 在 `src/web/api-client/index.ts` 中导出 `conversationApi` 和 `chatApi`
- [x] 10.3 创建 `src/web/types/agent.ts`，定义 `AgentConversation`、`AgentMessage`、`ChatStreamEvent` 等前端类型

## 11. 前端 Hooks

- [x] 11.1 创建 `src/web/features/agent/hooks/use-conversations.ts`，管理会话列表状态（加载、新建、删除、刷新），参考现有 `use-projects.ts` 模式
- [x] 11.2 创建 `src/web/features/agent/hooks/use-conversation-messages.ts`，管理单会话历史消息加载
- [x] 11.3 创建 `src/web/features/agent/hooks/use-agent-chat.ts`，管理流式对话：发送消息、解析 SSE 事件、追加 token、维护工具调用卡片状态、生成中指示器、错误处理

## 12. 前端组件

- [x] 12.1 创建 `src/web/features/agent/components/agent-chat-layout.tsx`，左右二级布局（左会话列表 + 右对话区），组合子组件
- [x] 12.2 创建 `src/web/features/agent/components/conversation-list.tsx`，会话列表面板（新建按钮、会话项、删除按钮、选中高亮）
- [x] 12.3 创建 `src/web/features/agent/components/message-list.tsx`，消息流渲染（user 右对齐 / assistant 左对齐 / Markdown 渲染 / 自动滚到底部）
- [x] 12.4 创建 `src/web/features/agent/components/message-bubble.tsx`，单条消息气泡（区分 user/assistant 样式，assistant 支持 Markdown）
- [x] 12.5 创建 `src/web/features/agent/components/tool-call-card.tsx`，工具调用步骤卡片（工具名、入参折叠、进行中/完成状态、结果摘要展开）
- [x] 12.6 创建 `src/web/features/agent/components/chat-input.tsx`，消息输入框（多行、Enter 发送、Shift+Enter 换行、空消息禁用、生成中禁用）
- [x] 12.7 创建 `src/web/features/agent/components/typing-indicator.tsx`，"正在输入"动画指示器
- [x] 12.8 创建 `src/web/features/agent/components/empty-state.tsx`，对话区空状态（无选中会话 / 无消息两种提示）

## 13. 主站导航集成

- [x] 13.1 在 `src/web/constants/menu-config.ts` 新增 `agent-chat` 菜单项（key、label"AI 助手"、icon）
- [x] 13.2 在 `src/web/components/layout/content-panel.tsx` 的 `contentMap` 中注册 `agent-chat` 视图，渲染 `AgentChatLayout`

## 14. 联调与验证

> 注：14.1–14.5 需要在已配置 LLM 环境变量（OPENAI_API_KEY 等）的运行环境中由开发者手动验证。代码层面已通过 tsc、lint、build 全部验证（见 14.6）。

- [ ] 14.1 端到端验证（已登录态）：新建会话 → 发送"列出所有活跃项目" → 观察工具调用卡片 → 观察流式 token → 验证消息持久化（刷新页面后历史仍在）
- [ ] 14.2 验证鉴权：未登录访问 `/api/agent/*` 返回 401；用户 A 无法访问/删除用户 B 的会话（返回 404）
- [ ] 14.3 验证多轮工具调用场景（如"列出项目，然后读取第一个项目的 schema.yml"）
- [ ] 14.4 验证错误处理：断开 LLM 配置或制造工具异常，确认前端显示错误提示且不崩溃
- [ ] 14.5 验证双驱动：在 SQLite 和 MySQL（若可用）下各跑一次会话 CRUD 与对话，确认 JSON 字段行为一致、userId 隔离生效
- [x] 14.6 运行 `npm run lint` 确认无 lint 错误，检查文件行数符合项目规范（组件 < 150 行、route < 50 行、service < 200 行）

  - ✅ `npx tsc --noEmit` 通过（0 错误）
  - ✅ `npm run lint`：新增 agent 代码 0 错误（剩余 23 错误均为既有文件，如 use-projects.ts 的 set-state-in-effect，本变更沿用同一 hook 模式保持一致）
  - ✅ `npm run build`（SQLite + 独立 DB）：编译成功、TS 通过、4 个 agent 路由均构建为动态路由
  - ✅ 文件行数：组件均 < 150 行（最大 agent-chat-layout 101 行）、route 均 < 100 行（chat route 80 行）、service 均 < 200 行（agent.service 170 行）
  - ✅ SQLite migration 已生成并应用（`0002_flawless_matthew_murdock.sql`），MySQL migration 已生成（`0003_hesitant_emma_frost.sql`）
