## Context

`add-ai-agent-chat` 变更已落地 AI 助手的完整代码骨架（schema → repository → service → SSE 路由 → api-client → hooks → 组件），且实测后端链路**完全可用**（SQLite 驱动 + 智谱 GLM-4.7：`POST /api/agent/conversations` 返回 201、`POST /api/agent/chat` 正常下发 token 与 message_end）。

但用户实测**点击"新建"完全无反应、输入框无法输入文本**。经端到端排查，根因是前端的一个**结构性可观测性缺陷**：

- `use-conversations` / `use-agent-chat` / `use-conversation-messages` 三个 hook 都在失败时 `setError(...)`，但 `ConversationList`、`MessageList`、`ChatInput` 与 `agent-chat-layout` **从不读取或渲染这些 error state**。
- 任何一次失败（鉴权 401、网络错、LLM key 缺失、SSE 中断）都被静默吞掉，`selectedId` 不更新，`ChatInput` 持续 `disabled={!selectedId || generating}`，于是表现为"无反应 + 无法输入"。
- 叠加问题：SSE `error` 事件不触发历史刷新（`onComplete` 仅在 `message_end` 调用），错误气泡残留、脏会话标题（`agent.service.ts` 在 LLM 调用前就更新标题）落库；`use-agent-chat` 的 `AbortController` 在 fetch 之后才创建且无停止入口；assistant 消息仅纯文本渲染（原 spec 要求 Markdown）。

约束：遵循项目分层架构（Route → Service → Repository），复用 HeroUI，组件 < 150 行，无新数据库 schema、无新路由、无新能力。

## Goals / Non-Goals

**Goals:**

- 让"任何一次失败都不再静默"：会话列表、消息区、输入框周边可见地渲染 error，且可重试。
- 健壮化"新建会话"路径：成功→选中并进入对话（输入框可用）；失败→可见错误，而非无反应。
- 错误路径状态一致：SSE `error` 后刷新历史/会话列表，清理临时气泡，避免脏数据残留。
- 补"停止生成"入口：生成中可中止，卸载时中断，避免幽灵流。
- assistant 消息支持 Markdown 渲染。
- 完成遗留端到端验证（`add-ai-agent-chat` tasks 14.1–14.5）。

**Non-Goals:**

- token 级流式改造（首版沿用"整段文本作为单个 token 事件"，非逐 token）。
- 多租户、RAG、写操作工具、新增 LLM provider（如 Anthropic）。
- 重写既有对话/持久化架构或数据库 schema。
- 全局错误边界 / toast 体系（仅在 AI 助手页范围内）。

## Decisions

### Decision 1: 错误展示用 HeroUI Alert，非全局 toast

**选择**：在 AI 助手页范围内用 HeroUI `<Alert>` 渲染各 hook 的 error，就近放置（会话列表顶部、消息区底部、输入框上方），并提供"重试"按钮。

**理由**：项目规范要求优先用 HeroUI；AI 助手是独立视图，错误上下文与具体操作强相关（新建失败、对话出错、加载失败），就近展示比全局 toast 更可追溯、可重试。Toast 体系未在项目中建立，引入它超出本变更范围。

**替代方案**：全局 toast（context provider）——需引入新基础设施，范围过大，且错误无法直接绑定到"重试某个具体操作"。

### Decision 2: 错误重试通过 hook 暴露 `retry`，而非组件内部重算

**选择**：`use-conversations` 暴露 `create` 已可重入；新增 `use-agent-chat` 的 `retry`（重发上一条）与 `use-conversation-messages` 的失败重载复用现有 `load`。组件层只调用 hook 方法，不持有"上一次请求"细节。

**理由**：符合项目"业务逻辑在 service/hook、组件保持薄"的分层；重试即重入已有方法，无需新协议。

**替代方案**：组件层保存 lastPayload 自行重发——会让组件变厚、与 hook 状态脱节。

### Decision 3: SSE `error` 与网络中断走统一收尾

**选择**：在 `use-agent-chat.sendMessage` 的 `finally` 中，若当前流式消息处于 `error` 态，触发一次历史刷新（等价于 `onComplete` 的副作用），并保证 `generating` 复位。`onComplete` 语义从"仅 message_end"扩展为"终态（message_end 或 error）后刷新"。

**理由**：避免错误后历史与会话列表不同步（脏标题、残留临时气泡）。后端 `agent.service` 在错误路径不持久化 assistant 消息（已符合 spec），但**标题在 LLM 调用前已更新**——见 Decision 4。

**替代方案**：只在 `message_end` 刷新——会导致错误后列表标题与实际内容不一致。

### Decision 4: 标题生成移到 LLM 成功后（后端小改）

**选择**：将 `agent.service.ts` 中"首条消息生成标题"逻辑从"LLM 调用前"移到"LLM 成功产出最终文本后、持久化 assistant 消息时"。报错路径不落标题，保持"新对话"原标题。

**理由**：当前实现即使对话报错也会把标题改成用户输入前 30 字，产生"标题已生成但无回复"的脏会话，干扰用户判断。移到成功后保证标题与会话内容一致。

**替代方案**：保留前端兜底清理（错误后刷新列表把标题改回）——但后端已落库脏标题，刷新会再次读到脏值，治标不治本。

**注意**：此为唯一后端逻辑变更，影响 `agent.service.ts` 一处，无 schema/接口变化。

### Decision 5: Markdown 渲染用 react-markdown + remark-gfm

**选择**：`message-bubble.tsx` 用 `react-markdown`（+ `remark-gfm` 支持 GFM）渲染 assistant 内容，保留 `whitespace-pre-wrap` 兜底；代码块用基础样式，不做语法高亮（非目标）。

**理由**：`react-markdown` 与 React 19 兼容，体积可控；GFM 覆盖 spec 要求的标题/列表/代码块/表格。

**替代方案**：自写极简 Markdown 解析器——重复造轮子、易出 XSS（react-markdown 默认不执行 HTML，更安全）。

**安全**：react-markdown 默认不渲染原始 HTML，避免 assistant 内容注入。需确认与 Next 16 / React 19 兼容（安装时验证）。

### Decision 6: 停止生成 = AbortController 前置 + 停止按钮

**选择**：`use-agent-chat` 在发起 fetch **前**创建 `AbortController`，`signal` 传入 `parseSSEStream`（已支持）与 `chatApi.streamChat`（需透传）。`ChatInput` 在 `generating` 时显示"停止"按钮，点击调用 `abort`。卸载时（`useEffect` 清理）也 abort。

**理由**：当前 `abortRef` 在 fetch 后创建，实际无效；用户卡住时无法中止。

**注意**：中止后 SSE 连接断开，后端 `streamChat` 的 fetch 会被取消（无需后端改）。

## Risks / Trade-offs

- **[风险] react-markdown 与 Next 16 / React 19 不兼容** → 安装后立即 `npm run build` 验证；若不兼容，退回纯文本并在 design 记录、推迟该子项（不影响错误可见性主线）。
- **[风险] 中止请求导致后端未捕获异常** → `agent.service` 已有 try/catch 兜底 emit error；中止是客户端取消 fetch，后端 stream 的 `controller.enqueue` 可能抛错，但 route.ts 已有 try/catch 忽略 controller 已关闭的情况（`chat/route.ts:58-64`）。需验证中止不产生 500 日志噪音。
- **[权衡] 错误就近展示 vs 全局一致性** → 本变更限定在 AI 助手页；若后续其它页也需要统一错误展示，可再抽象为共享组件（非目标）。
- **[权衡] 标题生成时机后移** → 极端情况（LLM 成功但持久化前崩溃）会丢失标题生成；但该路径概率极低，且不持久化 assistant 消息也不会有"有回复无标题"的体验问题。
- **[风险] "无反应"根因可能不止错误吞掉** → 修复错误可见性后，原本被隐藏的真实失败原因会暴露（如某次 401）；若暴露后仍有问题，便于针对性修复。这是本变更的预期收益。
