import { z } from "zod";

// createConversationSchema / upsertWorkspaceAndCreateConversationSchema
// 已迁移至 workspace.schema.ts（会话必属 workspace，创建逻辑与之耦合）。
export {
  createConversationSchema,
  upsertWorkspaceAndCreateConversationSchema,
} from "./workspace.schema";

/** 会话 ID 路径参数校验 */
export const conversationIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的会话 ID"),
});

/** 会话列表查询参数校验 */
export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
