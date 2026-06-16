/** Agent 会话 */
export interface AgentConversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** 工具调用记录（assistant 消息的工具调用数组） */
export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Agent 消息 */
export interface AgentMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls: AgentToolCall[] | null;
  toolCallId: string | null;
  createdAt: string;
}

/** SSE 流式事件（与后端 ChatStreamEvent 对齐） */
export type ChatStreamEvent =
  | { type: "token"; value: string }
  | { type: "tool_start"; tool: string; input: unknown }
  | { type: "tool_end"; tool: string; output: unknown }
  | { type: "message_end"; messageId: number }
  | { type: "error"; message: string };

/** 会话列表分页响应 */
export interface ConversationListResponse {
  items: AgentConversation[];
  total: number;
  limit: number;
  offset: number;
}

/** 消息列表响应 */
export interface MessageListResponse {
  items: AgentMessage[];
}
