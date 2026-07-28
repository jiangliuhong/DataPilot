/**
 * SSE 流式事件协议（POST /api/agent/chat 的 text/event-stream 下发）。
 *
 * 每条事件以 `data: <JSON>\n\n` 格式下发，JSON 含 `type` 字段。
 *
 * 事件由 deepagents streamEvents(v3) 投影经 event-bridge 翻译而来。
 */
export type ChatStreamEvent =
  /** AI 文本 token（逐 token 流式追加到当前 assistant 消息） */
  | { type: "token"; value: string }
  /** 工具调用开始（含工具名和入参） */
  | { type: "tool_start"; tool: string; input: unknown }
  /** 工具调用结束（含工具名和返回结果，已序列化为可 JSON 化结构） */
  | { type: "tool_end"; tool: string; output: unknown }
  /** 工具调用出错（含工具名和错误信息） */
  | { type: "tool_error"; tool: string; error: string }
  /** 消息完成（带持久化后的 assistant 消息 ID），随后关闭流 */
  | { type: "message_end"; messageId: number }
  /** 错误（含错误描述），随后关闭流 */
  | { type: "error"; message: string }
  /** 任务清单更新（deepagents write_todos 工具产出） */
  | { type: "todos_update"; todos: AgentTodo[] }
  /** 子 agent 委派开始 */
  | { type: "subagent_start"; name: string }
  /** 子 agent 委派结束 */
  | { type: "subagent_end"; name: string }
  /**
   * 写操作审批请求（HITL interrupt）。
   * 流暂停，等待前端 POST /api/agent/chat/resume 提交 decision。
   */
  | { type: "approval_request"; interrupts: ApprovalInterrupt[] }
  /** 审批已处理，agent 继续执行 */
  | { type: "approval_resolved" };

/** 任务清单条目（对应 deepagents write_todos 的状态） */
export interface AgentTodo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

/** 审批中断载荷（deepagents HITL interrupt 的投影） */
export interface ApprovalInterrupt {
  /** 中断 id（resume 时关联用） */
  interruptId: string;
  /** 待审批的工具名（write_file / edit_file 等） */
  actionName: string;
  /** 工具入参（如 { file_path, content }） */
  args: Record<string, unknown>;
  /** 允许的决策类型 */
  allowedDecisions: ("approve" | "edit" | "reject")[];
  /** 审批说明 */
  description?: string;
}

/** 事件下发回调（agent.service 用此回调 emit 事件，与传输层解耦） */
export type EmitEvent = (event: ChatStreamEvent) => void;
