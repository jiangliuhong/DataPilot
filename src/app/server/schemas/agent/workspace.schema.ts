import { z } from "zod";

/**
 * 创建会话请求体校验。
 *
 * 必须指定 workspaceId（会话必属一个工作空间）；title 可选，缺省时 service 用"新对话"。
 */
export const createConversationSchema = z.object({
  workspaceId: z.number().int().positive("无效的工作空间 ID"),
  title: z.string().min(1).max(255).optional(),
});

/**
 * 「打开资源开聊」一步到位创建 workspace + 会话。
 *
 * 用于前端「选 dbt project 开聊」：传 type/refId/name，
 * service 先 upsert workspace，再在其下建会话。
 */
export const upsertWorkspaceAndCreateConversationSchema = z.object({
  type: z.string().min(1).max(32),
  refId: z.number().int().positive("无效的资源 ID"),
  name: z.string().min(1).max(255),
  title: z.string().min(1).max(255).optional(),
});

/** Upsert workspace 请求体（仅建/复用 workspace，不建会话） */
export const upsertWorkspaceSchema = z.object({
  type: z.string().min(1).max(32),
  refId: z.number().int().positive("无效的资源 ID"),
  name: z.string().min(1).max(255),
});
