import { HumanMessage } from "@langchain/core/messages";
import * as conversationRepo from "@/app/server/repositories/agent/conversation.repository";
import * as messageRepo from "@/app/server/repositories/agent/message.repository";
import * as workspaceRepo from "@/app/server/repositories/agent/workspace.repository";
import type { ToolCallRecord } from "@/app/server/repositories/agent/message.repository";
import type { AgentWorkspace } from "@/app/db/schema";
import { createProjectAgent } from "./project-agent.factory";
import { getActiveRuntimeConfig } from "@/app/server/services/settings/llm-provider-config.service";
import { consumeRunStream } from "./event-bridge";
import { dbMessagesToLangChain } from "./message-mapper";
import type { EmitEvent } from "./types";

/**
 * deepagents 编排的「对话 thread_id」生成规则。
 *
 * 同一 conversation 的首次发送与后续 resume 必须命中同一 thread_id，
 * 才能让 checkpointer 恢复同一执行态。
 */
function threadIdOf(conversationId: number): string {
  return `conv-${conversationId}`;
}

/**
 * 解析会话 + 工作空间（鉴权 + 拿 workspace）。
 * 越权或不存在的会话视为不存在。
 */
async function resolveConversationWorkspace(
  conversationId: number,
  userId: number,
  emit: EmitEvent,
): Promise<{ workspace: AgentWorkspace; title: string } | null> {
  const conversation = await conversationRepo.findById(conversationId, userId);
  if (!conversation) {
    emit({ type: "error", message: "会话不存在" });
    return null;
  }
  const workspace = await workspaceRepo.findById(
    conversation.workspaceId,
    userId,
  );
  if (!workspace) {
    emit({ type: "error", message: "工作空间不存在" });
    return null;
  }
  return { workspace, title: conversation.title };
}

/**
 * 流式编排一轮 Agent 对话（deepagents streamEvents v3）。
 *
 * 流程：校验会话/workspace → 持久化 user 消息 → 装配 agent →
 *      streamEvents(v3) 并发消费投影 → SSE emit → 持久化 assistant 消息。
 *
 * @param userId         当前登录用户（数据隔离）
 * @param conversationId 会话 ID
 * @param message        用户消息文本
 * @param emit           事件下发回调
 * @param signal         可选中止信号
 */
export async function streamChat(
  userId: number,
  conversationId: number,
  message: string,
  emit: EmitEvent,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const resolved = await resolveConversationWorkspace(
      conversationId,
      userId,
      emit,
    );
    if (!resolved) return;
    const { workspace, title } = resolved;

    // 1. 持久化 user 消息
    await messageRepo.create({ conversationId, role: "user", content: message });

    // 2. 加载历史上下文（含刚写入的 user 消息），转 LangChain 消息
    const historyRows = await messageRepo.findByConversationId(conversationId);
    const history = dbMessagesToLangChain(historyRows);

    // 3. 装配 agent（绑定到当前 workspace）；DB 为唯一配置源，先取生效配置注入
    const llmConfig = await getActiveRuntimeConfig();
    const agent = createProjectAgent(workspace, userId, llmConfig);

    // 4. streamEvents(v3) —— 真 token 流式 + 工具调用 + todos + 子 agent + HITL
    const run = await agent.streamEvents(
      { messages: [...history, new HumanMessage(message)] },
      {
        configurable: { thread_id: threadIdOf(conversationId) },
        version: "v3",
        signal,
      },
    );

    // 5. 并发消费投影 → SSE
    await consumeRunStream(run as Parameters<typeof consumeRunStream>[0], emit);

    // 6. HITL 中断：agent 暂停等待审批，不持久化、不结束本轮。
    //    run.output 在 interrupt 时会 resolve 为中断态快照，但此时 assistant
    //    消息尚未完成，持久化会导致与 resume 后重复。正确做法是直接 return，
    //    等 resume 时再走完整的「消费 → 持久化 → message_end」流程。
    if (run.interrupted) {
      return;
    }

    // 7. 取最终 state，持久化 assistant 消息
    const finalState = await run.output;
    const { content, toolCalls } = extractAssistantMessage(finalState);

    // 标题生成（首条消息且标题仍为默认）
    if (title === "新对话" && message.trim().length > 0) {
      await conversationRepo.updateTitle(
        conversationId,
        userId,
        message.slice(0, 30),
      );
    }

    const created = await messageRepo.create({
      conversationId,
      role: "assistant",
      content,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    });

    emit({ type: "message_end", messageId: created?.id ?? 0 });
  } catch (error) {
    // AbortError 视为正常中止，不 emit error（前端自行处理）
    if (error instanceof Error && error.name === "AbortError") return;
    const msg = error instanceof Error ? error.message : "对话编排失败";
    emit({ type: "error", message: msg });
  }
}

/**
 * 恢复因 HITL 中断的执行（用户审批写操作后调用）。
 *
 * 必须用同一 thread_id，checkpointer 才能恢复执行态。
 *
 * @param conversationId 会话 ID（决定 thread_id）
 * @param decisions      审批决策数组（approve/edit/reject）
 * @param emit           事件下发回调
 */
export async function resumeChat(
  userId: number,
  conversationId: number,
  decisions: ResumeDecision[],
  emit: EmitEvent,
): Promise<void> {
  try {
    const resolved = await resolveConversationWorkspace(
      conversationId,
      userId,
      emit,
    );
    if (!resolved) return;
    const { workspace } = resolved;

    const llmConfig = await getActiveRuntimeConfig();
    const agent = createProjectAgent(workspace, userId, llmConfig);

    // 用 Command resume：deepagents HITL 的恢复方式。
    // streamEvents 的第一个参数接受 Command 实例（LangGraph resume 协议）。
    const { Command } = await import("@langchain/langgraph");
    const resumeCommand = new Command({ resume: { decisions } });
    const run = await agent.streamEvents(
      resumeCommand as unknown as Parameters<typeof agent.streamEvents>[0],
      {
        configurable: { thread_id: threadIdOf(conversationId) },
        version: "v3",
      },
    );

    emit({ type: "approval_resolved" });
    await consumeRunStream(run as Parameters<typeof consumeRunStream>[0], emit);

    // 持久化恢复后的 assistant 消息
    const finalState = await run.output;
    const { content, toolCalls } = extractAssistantMessage(finalState);
    const created = await messageRepo.create({
      conversationId,
      role: "assistant",
      content,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    });
    emit({ type: "message_end", messageId: created?.id ?? 0 });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    const msg = error instanceof Error ? error.message : "恢复执行失败";
    emit({ type: "error", message: msg });
  }
}

/** HITL 决策类型（与 langchain Decision 对齐） */
export type ResumeDecision =
  | { type: "approve" }
  | { type: "edit"; editedAction: { name: string; args: Record<string, unknown> } }
  | { type: "reject"; message?: string };

/**
 * 从最终 state 提取 assistant 消息内容与工具调用记录（用于持久化）。
 */
function extractAssistantMessage(state: Record<string, unknown>): {
  content: string;
  toolCalls: ToolCallRecord[];
} {
  const messages = state.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { content: "", toolCalls: [] };
  }
  const last = messages[messages.length - 1] as {
    content?: unknown;
    tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  };

  const content =
    typeof last.content === "string"
      ? last.content
      : Array.isArray(last.content)
        ? last.content
            .map((c: unknown) =>
              typeof c === "object" && c !== null && "text" in c
                ? String((c as { text: unknown }).text)
                : "",
            )
            .join("")
        : String(last.content ?? "");

  const toolCalls: ToolCallRecord[] = Array.isArray(last.tool_calls)
    ? last.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
      }))
    : [];

  return { content, toolCalls };
}
