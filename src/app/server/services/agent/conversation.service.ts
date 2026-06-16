import * as conversationRepo from "@/app/server/repositories/agent/conversation.repository";
import * as messageRepo from "@/app/server/repositories/agent/message.repository";
import type { AgentConversation } from "@/app/db/schema";

/** 创建会话（归属当前用户） */
export async function createConversation(
  userId: number,
  data: { title?: string },
): Promise<AgentConversation> {
  return conversationRepo.create({ userId, title: data.title });
}

/** 查询会话详情（带归属校验） */
export async function getConversation(
  id: number,
  userId: number,
): Promise<AgentConversation | null> {
  return conversationRepo.findById(id, userId);
}

/** 当前用户的会话列表 */
export async function listConversations(
  userId: number,
  options: { limit: number; offset: number },
) {
  return conversationRepo.findList({ userId, ...options });
}

/** 软删除会话（带归属校验） */
export async function deleteConversation(
  id: number,
  userId: number,
): Promise<AgentConversation | null> {
  return conversationRepo.softDelete(id, userId);
}

/**
 * 查询会话消息（按时间正序）。
 *
 * 先校验会话归属当前 userId，不属于则返回 null（调用方据此返回 404）。
 */
export async function listMessages(
  conversationId: number,
  userId: number,
) {
  const conversation = await conversationRepo.findById(conversationId, userId);
  if (!conversation) return null;

  const rows = await messageRepo.findByConversationId(conversationId);
  // toolCalls 字段反序列化（跨驱动一致）
  return rows.map((row) => ({
    ...row,
    toolCalls: messageRepo.parseToolCalls(row.toolCalls),
  }));
}
