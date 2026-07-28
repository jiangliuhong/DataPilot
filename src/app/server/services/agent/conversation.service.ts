import * as conversationRepo from "@/app/server/repositories/agent/conversation.repository";
import * as messageRepo from "@/app/server/repositories/agent/message.repository";
import * as workspaceRepo from "@/app/server/repositories/agent/workspace.repository";
import type { AgentConversation, AgentWorkspace } from "@/app/db/schema";

/** 创建会话（归属当前用户 + 指定 workspace） */
export async function createConversation(
  userId: number,
  data: { workspaceId: number; title?: string },
): Promise<AgentConversation> {
  // 校验 workspace 归属当前用户
  const workspace = await workspaceRepo.findById(data.workspaceId, userId);
  if (!workspace) {
    throw new Error("workspace 不存在");
  }
  return conversationRepo.create({
    userId,
    workspaceId: data.workspaceId,
    title: data.title,
  });
}

/**
 * Upsert 工作空间并创建会话（一步到位）。
 *
 * 用于「打开某 dbt project 开聊」：确保 workspace 存在，再在其下建会话。
 */
export async function upsertWorkspaceAndCreateConversation(
  userId: number,
  input: { type: string; refId: number; name: string; title?: string },
): Promise<{ workspace: AgentWorkspace; conversation: AgentConversation }> {
  const workspace = await workspaceRepo.upsert({
    userId,
    type: input.type,
    refId: input.refId,
    name: input.name,
  });
  const conversation = await conversationRepo.create({
    userId,
    workspaceId: workspace.id,
    title: input.title,
  });
  return { workspace, conversation };
}

/** 查询工作空间详情（带归属校验） */
export async function getWorkspace(
  id: number,
  userId: number,
): Promise<AgentWorkspace | null> {
  return workspaceRepo.findById(id, userId);
}

/** 当前用户的工作空间列表 */
export async function listWorkspaces(
  userId: number,
  options: { limit: number; offset: number },
) {
  return workspaceRepo.findList({ userId, ...options });
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
