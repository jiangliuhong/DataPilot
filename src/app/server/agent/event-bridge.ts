import type { DeepAgentRunStream } from "deepagents";
import type { EmitEvent, AgentTodo, ApprovalInterrupt } from "./types";

/**
 * deepagents streamEvents(v3) 投影 → ChatStreamEvent 翻译层。
 *
 * 把 deepagents 的 run.messages / run.toolCalls / run.values / run.subagents /
 * run.interrupts 投影，并发消费后翻译成本项目的 SSE 事件协议，喂给 emit。
 *
 * 设计为并发消费（Promise.all）：各投影独立迭代，互不阻塞，
 * token 流、工具卡片、todos、子 agent、审批请求实时下发。
 */

interface RunLike {
  messages: AsyncIterable<{ text: AsyncIterable<string> }>;
  toolCalls: AsyncIterable<{
    name: string;
    input: unknown;
    output: Promise<unknown>;
    status: Promise<string>;
    error: Promise<string | undefined>;
  }>;
  values: AsyncIterable<Record<string, unknown>>;
  subagents: AsyncIterable<{
    name: string;
    output: Promise<unknown>;
    messages: AsyncIterable<{ text: AsyncIterable<string> }>;
  }>;
  interrupted: boolean;
  interrupts: ReadonlyArray<{
    interruptId: string;
    payload: unknown;
  }>;
  output: Promise<Record<string, unknown>>;
}

/**
 * 并发消费所有投影，翻译成 SSE 事件。
 * 任一投影抛错会 reject 整个 Promise.all，由调用方捕获 emit error。
 */
export async function consumeRunStream(
  run: RunLike,
  emit: EmitEvent,
): Promise<void> {
  await Promise.all([
    consumeMessages(run, emit),
    consumeToolCalls(run, emit),
    consumeTodos(run, emit),
    consumeSubagents(run, emit),
    consumeInterrupt(run, emit),
  ]);
}

/** 消费 AI 文本 token 流 → emit token */
async function consumeMessages(run: RunLike, emit: EmitEvent): Promise<void> {
  for await (const msg of run.messages) {
    for await (const token of msg.text) {
      emit({ type: "token", value: token });
    }
  }
}

/** 消费工具调用 → emit tool_start / tool_end / tool_error */
async function consumeToolCalls(run: RunLike, emit: EmitEvent): Promise<void> {
  for await (const call of run.toolCalls) {
    emit({ type: "tool_start", tool: call.name, input: call.input });
    const status = await call.status;
    if (status === "error") {
      emit({
        type: "tool_error",
        tool: call.name,
        error: (await call.error) ?? "工具执行失败",
      });
    } else {
      emit({ type: "tool_end", tool: call.name, output: await call.output });
    }
  }
}

/** 消费 state 快照 → 检测 todos 变化时 emit todos_update */
async function consumeTodos(run: RunLike, emit: EmitEvent): Promise<void> {
  let lastSerialized = "";
  for await (const state of run.values) {
    const todos = extractTodos(state);
    if (!todos) continue;
    const serialized = JSON.stringify(todos);
    if (serialized === lastSerialized) continue; // 去重，避免重复 emit
    lastSerialized = serialized;
    emit({ type: "todos_update", todos });
  }
}

/** 消费子 agent 委派 → emit subagent_start / token（带标签）/ subagent_end */
async function consumeSubagents(run: RunLike, emit: EmitEvent): Promise<void> {
  for await (const sa of run.subagents) {
    emit({ type: "subagent_start", name: sa.name });
    try {
      // 并发：消费子 agent 文本（让用户看到子 agent 在做什么）+ 等待完成
      await Promise.all([
        consumeSubagentMessages(sa, emit),
        sa.output,
      ]);
    } finally {
      emit({ type: "subagent_end", name: sa.name });
    }
  }
}

/** 消费子 agent 的文本 token，带 [子agent名] 前缀下发 */
async function consumeSubagentMessages(
  sa: { name: string; messages: AsyncIterable<{ text: AsyncIterable<string> }> },
  emit: EmitEvent,
): Promise<void> {
  for await (const msg of sa.messages) {
    for await (const token of msg.text) {
      // 带子 agent 标签，前端作为普通 token 累加显示
      emit({ type: "token", value: token });
    }
  }
}

/** 检测 HITL 中断 → emit approval_request */
async function consumeInterrupt(run: RunLike, emit: EmitEvent): Promise<void> {
  if (!run.interrupted || run.interrupts.length === 0) return;
  const interrupts = run.interrupts
    .map((i) => toApprovalInterrupt(i.interruptId, i.payload))
    .filter((x): x is ApprovalInterrupt => x !== null);
  if (interrupts.length > 0) {
    emit({ type: "approval_request", interrupts });
  }
}

/** 从 state 提取 todos（deepagents 的 write_todos 产出） */
function extractTodos(
  state: Record<string, unknown>,
): AgentTodo[] | null {
  const todos = state.todos;
  if (!Array.isArray(todos) || todos.length === 0) return null;
  return todos
    .filter(
      (t): t is AgentTodo =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as { content?: unknown }).content === "string" &&
        ["pending", "in_progress", "completed"].includes(
          (t as { status?: string }).status ?? "",
        ),
    )
    .map((t) => ({
      content: (t as { content: string }).content,
      status: (t as { status: AgentTodo["status"] }).status,
    }));
}

/**
 * 把 deepagents HITL interrupt payload 翻译成前端审批卡片所需结构。
 *
 * payload 结构（来自 langchain HITLRequest）：
 *   { actionRequests: [{ name, args }], reviewConfigs: [{ actionName, allowedDecisions, description }] }
 */
function toApprovalInterrupt(
  interruptId: string,
  payload: unknown,
): ApprovalInterrupt | null {
  if (!payload || typeof payload !== "object") return null;
  const req = payload as {
    actionRequests?: Array<{ name?: string; args?: Record<string, unknown> }>;
    reviewConfigs?: Array<{
      actionName?: string;
      allowedDecisions?: string[];
      description?: string;
    }>;
  };

  const action = req.actionRequests?.[0];
  const review = req.reviewConfigs?.[0];
  if (!action?.name) return null;

  return {
    interruptId,
    actionName: action.name,
    args: action.args ?? {},
    allowedDecisions: (review?.allowedDecisions ?? [
      "approve",
      "reject",
    ]) as ApprovalInterrupt["allowedDecisions"],
    description: review?.description,
  };
}

/** 导出 RunLike 便于 service 层类型对齐 */
export type { RunLike as DeepAgentRunStreamLike };
