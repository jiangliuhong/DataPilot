import { eq, asc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import { agentMessages } from "@/app/db/schema";

/**
 * 工具调用结构（assistant 消息）。
 *
 * 与 LangChain 的 AIMessage.tool_calls[] 形状对齐，便于重建对话上下文。
 */
export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** 创建消息的入参 */
export interface CreateMessageInput {
  conversationId: number;
  role: "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: ToolCallRecord[];
  toolCallId?: string;
}

/**
 * 创建一条消息。
 *
 * toolCalls 在两种驱动下都序列化为 JSON 字符串存储（SQLite 存 text，
 * MySQL 存 text 列），保证跨驱动行为一致。读取时由 `parseToolCalls` 反序列化。
 */
export async function create(input: CreateMessageInput) {
  const { id } = await insertReturningId(agentMessages, {
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    toolCalls:
      input.toolCalls !== undefined
        ? JSON.stringify(input.toolCalls)
        : undefined,
    toolCallId: input.toolCallId,
  });
  return findById(id);
}

/** 根据 ID 查询消息 */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * 按会话查询消息（按 createdAt 正序，用于重建对话上下文）。
 *
 * 调用方（service）需先校验会话归属当前 userId，再调用本方法。
 */
export async function findByConversationId(conversationId: number) {
  return db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.conversationId, conversationId))
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));
}

/** 反序列化 toolCalls JSON 字符串（跨驱动一致） */
export function parseToolCalls(raw: string | null | undefined): ToolCallRecord[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ToolCallRecord[];
  } catch {
    return null;
  }
}
