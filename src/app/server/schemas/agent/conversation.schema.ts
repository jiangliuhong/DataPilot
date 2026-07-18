import { z } from "zod";

/** 创建会话请求体校验（title 可选，缺省时 service 用"新对话"） */
export const createConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
});

/** 会话 ID 路径参数校验 */
export const conversationIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的会话 ID"),
});

/** 会话列表查询参数校验 */
export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
