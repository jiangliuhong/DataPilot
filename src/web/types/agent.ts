/** Agent 工作空间（多态关联一类资源实体） */
export interface AgentWorkspace {
  id: number;
  userId: number;
  /** 工作空间类型：'dbt_project' | 未来扩展 */
  type: string;
  /** 关联实体 id（如 dbt_projects.id） */
  refId: number;
  /** 冗余快照名 */
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Agent 会话 */
export interface AgentConversation {
  id: number;
  userId: number;
  workspaceId: number;
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

/** 任务清单条目（deepagents write_todos 产出） */
export interface AgentTodo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

/** HITL 审批中断载荷 */
export interface ApprovalInterrupt {
  interruptId: string;
  actionName: string;
  args: Record<string, unknown>;
  allowedDecisions: ("approve" | "edit" | "reject")[];
  description?: string;
}

/** HITL 决策（approve/edit/reject，与后端 resumeChatSchema 对齐） */
export type ResumeDecision =
  | { type: "approve" }
  | {
      type: "edit";
      editedAction: { name: string; args: Record<string, unknown> };
    }
  | { type: "reject"; message?: string };

/** SSE 流式事件（与后端 ChatStreamEvent 对齐） */
export type ChatStreamEvent =
  | { type: "token"; value: string }
  | { type: "tool_start"; tool: string; input: unknown }
  | { type: "tool_end"; tool: string; output: unknown }
  | { type: "tool_error"; tool: string; error: string }
  | { type: "message_end"; messageId: number }
  | { type: "error"; message: string }
  | { type: "todos_update"; todos: AgentTodo[] }
  | { type: "subagent_start"; name: string }
  | { type: "subagent_end"; name: string }
  | { type: "approval_request"; interrupts: ApprovalInterrupt[] }
  | { type: "approval_resolved" };

/** 会话列表分页响应 */
export interface ConversationListResponse {
  items: AgentConversation[];
  total: number;
  limit: number;
  offset: number;
}

/** 工作空间列表分页响应 */
export interface WorkspaceListResponse {
  items: AgentWorkspace[];
  total: number;
  limit: number;
  offset: number;
}

/** 消息列表响应 */
export interface MessageListResponse {
  items: AgentMessage[];
}
