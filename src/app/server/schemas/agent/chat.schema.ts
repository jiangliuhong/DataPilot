import { z } from "zod";

/** 发送对话消息请求体校验 */
export const sendChatSchema = z.object({
  conversationId: z.coerce.number().int().positive("无效的会话 ID"),
  message: z.string().min(1, "消息不能为空").max(20000),
});
