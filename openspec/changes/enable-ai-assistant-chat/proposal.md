## Why

AI 助手页面的代码骨架已在 `add-ai-agent-chat` 变更中落地（schema、repository、service、SSE 路由、api-client、hooks、组件全部就位），但实测**点击"新建"完全无反应、输入框无法输入文本**。根因不是后端不可用，而是前端的一个结构性缺陷：

**三个 hooks 都把错误写进 `error` state，但没有一个组件渲染它。**

- `use-conversations.ts:60` 在 `create()` 失败时 `setError("创建会话失败")`，但 `ConversationList` 只渲染 loading / empty / list 三态（`conversation-list.tsx:50-58`），从不显示 `error`。
- `use-agent-chat.ts:87,176` 在对话出错时 `setError(msg)`，错误气泡虽有内容但失败后历史不刷新、`generating` 复位后错误信息也无持久提示。
- `use-conversation-messages.ts:32` 同理。

后果：任何一次失败（鉴权 401、网络错、LLM key 缺失、SSE 中断）都表现为**静默无反应**——`selectedId` 没设上、`ChatInput` 一直 `disabled={!selectedId || generating}`（`agent-chat-layout.tsx:97`），于是"点新建无反应 + 无法输入"。错误被吞掉了。

叠加的次要问题：`POST /api/agent/chat` 在 `.env` 的 `OPENAI_API_KEY=` 为空时返回 `{"type":"error","message":"LLM API Key 未配置…"}`（已实测复现，该消息本身已是可读中文，错误可见性修复后会直接展示在 UI 中，无需额外翻译）；标题自动生成在 LLM 调用前执行（`agent.service.ts:56-62`），即使报错也会落库，产生脏会话。

本变更修复这些可观测性与健壮性缺陷，让页面真正可用，并补齐遗留的手动端到端验证（`add-ai-agent-chat` 的 tasks 14.1–14.5 从未执行）。

## What Changes

- **修复"错误不可见"**：在会话列表、消息区、输入框周边渲染 hook 暴露的 `error`，并提供可关闭/可重试的错误条；任何失败都不再静默。
- **健壮化新建会话**：`create()` 失败时明确反馈（而非仅 `setError` 后无渲染），保证"点新建"在任何情况下都有可见结果（成功→选中并进入对话；失败→可见错误）。
- **修复对话错误路径一致性**：SSE `error` 事件触发历史刷新（避免脏气泡与脏会话标题残留），并让错误可重试。
- **补齐 abort 入口**：`use-agent-chat` 的 `AbortController` 当前在 fetch 之后才创建且无停止按钮，首版接出"停止生成"，避免卡死与幽灵流。
- **Markdown 渲染**：`agent-chat-ui` spec 本就要求 assistant 消息支持 Markdown，当前 `message-bubble.tsx` 仅纯文本，补齐以匹配既有 spec。
- **运行时端到端验证**：在 SQLite 驱动 + 已登录态下走通"新建会话 → 多轮对话（含工具调用）→ 错误处理 → 鉴权隔离"，完成遗留的 14.1–14.5。

不在本变更范围（延续首版非目标）：token 级流式改造、多租户、RAG、写操作工具、新增 provider（Anthropic 等）。

## Capabilities

### New Capabilities

（无新增能力。AI 助手相关能力已在 `add-ai-agent-chat` 变更中定义，尚未归档至 `openspec/specs/`。）

### Modified Capabilities

> 注：`openspec/specs/` 当前为空（`add-ai-agent-chat` 尚未归档），下方 capability 名取自该变更的 `specs/`。本变更为这两个既有 capability **新增 requirement（delta spec，非修改既有 requirement）**，不引入新 capability。

- `agent-chat-ui`: 新增"错误可见 + 可重试""对话错误终态刷新历史与列表""停止生成""Markdown 渲染"等行为要求。
- `agent-chat-api`: 新增"标题生成与会话内容一致"（报错时不落脏标题）的行为要求。

## Impact

- **前端**（主要改动面）：
  - `src/web/features/agent/components/conversation-list.tsx`（渲染 error、新建失败反馈）
  - `src/web/features/agent/components/message-list.tsx` / `message-bubble.tsx`（错误气泡持久化、Markdown 渲染）
  - `src/web/features/agent/components/chat-input.tsx`（停止生成按钮）
  - `src/web/features/agent/components/agent-chat-layout.tsx`（串联错误展示与重试）
  - `src/web/features/agent/hooks/use-agent-chat.ts`（abort 时机、错误路径刷新历史）
  - 新增一个可复用的错误条/错误状态组件（HeroUI Alert）
- **后端**（小改动）：
  - `src/app/server/agent/agent.service.ts`（标题生成时机后移到 LLM 成功后，避免错误路径落脏标题）
- **依赖**：新增 Markdown 渲染库（评估 `react-markdown` + `remark-gfm`，确认与 React 19 / Next 16 兼容）。
- **配置/环境**：明确 `.env` 中 `OPENAI_API_KEY` 必填（`.env.example` 已含，需文档强调缺失会导致对话失败）。
- **无数据库 schema 变更、无新路由、无新能力**：本变更只完善既有功能的可观测性与健壮性。
