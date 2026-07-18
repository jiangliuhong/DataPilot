/**
 * SSE 流式事件协议（POST /api/agent/chat 的 text/event-stream 下发）。
 *
 * 每条事件以 `data: <JSON>\n\n` 格式下发，JSON 含 `type` 字段。
 */
export type ChatStreamEvent =
  /** AI 文本 token（逐 token 流式追加到当前 assistant 消息） */
  | { type: "token"; value: string }
  /** 工具调用开始（含工具名和入参） */
  | { type: "tool_start"; tool: string; input: unknown }
  /** 工具调用结束（含工具名和返回结果，已序列化为可 JSON 化结构） */
  | { type: "tool_end"; tool: string; output: unknown }
  /** 消息完成（带持久化后的 assistant 消息 ID），随后关闭流 */
  | { type: "message_end"; messageId: number }
  /** 错误（含错误描述），随后关闭流 */
  | { type: "error"; message: string };

/** 事件下发回调（agent.service 用此回调 emit 事件，与传输层解耦） */
export type EmitEvent = (event: ChatStreamEvent) => void;
