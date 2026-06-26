## 1. 错误可见性（核心：修复"无反应"根因）

- [x] 1.1 在 `src/web/features/agent/components/conversation-list.tsx` 渲染 `useConversations` 暴露的 `error`：会话列表区域显示 HeroUI `<Alert color="danger">`，含错误文案 + "重试"按钮（调用 `refresh`/`create` 重入），支持关闭（Alert 自带 onClose 或本地 state）
- [x] 1.2 在 `src/web/features/agent/components/agent-chat-layout.tsx` 串联 `useConversationMessages` 的 `error`：对话区在历史加载失败时显示错误提示 + "重试"（重新调用 `load(selectedId)`）
- [x] 1.3 确认 `use-conversations.ts` 的 `create` 在失败时已 `setError`（无需改 hook 逻辑），组件层补充对 `error` 的渲染；新建成功路径无需改动（已 `setSelectedId`）
- [x] 1.4 抽取一个可复用的错误展示片段或小组件（HeroUI Alert + 重试 + 关闭），控制 conversation-list / message 区文件行数不超 150

## 2. 对话错误终态刷新历史

- [x] 2.1 修改 `src/web/features/agent/hooks/use-agent-chat.ts`：将 `onComplete` 语义扩展为"终态回调"——在 `finally` 块中，若流式消息最终为 `error` 态（或正常 message_end），都触发回调（刷新历史 + 会话列表）。保证 `generating` 复位
- [x] 2.2 网络中断（fetch/reader 抛错）路径已进入 catch 并 `setError`，确认 catch 分支也触发终态回调，清理临时气泡
- [x] 2.3 在 `agent-chat-layout.tsx` 的 `handleSend` 的回调中确保 `loadMessages` + `refreshConvs` 在错误后也执行（与 2.1 配合）

## 3. 停止生成（abort）

- [x] 3.1 修改 `src/web/api-client/agent.ts` 的 `chatApi.streamChat`：新增可选 `signal?: AbortSignal` 参数，透传给 `fetch`；保持非 OK 时抛 `ApiError` 行为不变
- [x] 3.2 修改 `src/web/features/agent/hooks/use-agent-chat.ts`：在发起 fetch **前**创建 `AbortController`（而非之后），`signal` 传入 `streamChat` 与 `parseSSEStream`（后者已支持 signal）；`sendMessage` 暴露 `abort` 能力（如返回 controller 或新增 `stop` 方法）
- [x] 3.3 在 `useAgentChat` 的组件层（`agent-chat-layout.tsx` 或 `chat-input.tsx`）增加卸载清理：`useEffect` cleanup 中调用 abort，避免幽灵流
- [x] 3.4 修改 `src/web/features/agent/components/chat-input.tsx`：`generating` 为 true 时显示"停止"按钮（点击 abort），与发送按钮切换；保证组件 < 150 行

## 4. assistant 消息 Markdown 渲染

- [x] 4.1 安装依赖 `react-markdown` + `remark-gfm`，确认与 React 19 / Next 16 兼容（`npm run build` 验证）
- [x] 4.2 修改 `src/web/features/agent/components/message-bubble.tsx`：assistant 消息内容用 `<ReactMarkdown remarkPlugins={[remarkGfm]}>` 渲染（默认不渲染原始 HTML）；移除"纯文本渲染"注释，保留 `whitespace-pre-wrap` 兜底
- [x] 4.3 验证历史与流式 assistant 消息均一致以 Markdown 渲染（流式过程中内容实时更新也正常）

## 5. 后端：标题生成时机后移

- [x] 5.1 修改 `src/app/server/agent/agent.service.ts`：将"首条消息生成标题"（当前在 LLM 调用前，约 56-62 行）移到 LLM 成功产出最终文本后、持久化 assistant 消息前；错误路径（catch emit error）不更新标题，保持"新对话"
- [x] 5.2 确认 `conversation.repository.updateTitle` 已带 `userId` 归属校验（无需改），仅调整调用时机
- [x] 5.3 验证：对话成功→标题更新；对话失败（如制造 LLM 异常）→标题保持"新对话"

## 6. 端到端验证（完成 add-ai-agent-chat 遗留 14.1–14.5）

- [x] 6.1 已登录态：新建会话 → 发送"列出所有活跃项目" → 观察工具调用卡片 → 流式回复 → 刷新页面验证历史持久化
- [x] 6.2 鉴权隔离：未登录访问 `/api/agent/*` 返回 401；用户 A 无法访问/删除用户 B 的会话（404）
- [ ] 6.3 多轮工具调用：发送"列出项目，然后读取第一个项目的某文件"，验证连续 tool_start/tool_end
- [x] 6.4 错误处理验证：临时清空 `OPENAI_API_KEY` 或制造工具异常 → 确认前端显示错误提示（可见 + 可重试）、标题保持"新对话"、历史刷新无脏气泡
- [ ] 6.5 停止生成验证：生成中点击"停止" → 确认请求中止、输入框重新可用、已接收内容保留
- [ ] 6.6 Markdown 验证：让 AI 回复包含列表/代码块/表格 → 确认正确渲染、不执行原始 HTML

## 7. 质量门禁

- [x] 7.1 `npx tsc --noEmit` 通过（0 错误）
- [x] 7.2 `npm run lint` 新增/修改代码 0 错误
- [x] 7.3 `npm run build` 通过（SQLite + 智谱配置）
- [x] 7.4 检查文件行数符合项目规范：组件 < 150 行、route < 50 行、service < 200 行；若 conversation-list/chat-input 因新增逻辑超限，拆分子组件
