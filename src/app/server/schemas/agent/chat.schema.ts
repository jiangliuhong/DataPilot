import { z } from "zod";

/** 发送对话消息请求体校验 */
export const sendChatSchema = z.object({
  conversationId: z.coerce.number().int().positive("无效的会话 ID"),
  message: z.string().min(1, "消息不能为空").max(20000),
});

/** 单个 HITL 决策（approve/edit/reject，与 langchain Decision 对齐） */
const decisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("approve") }),
  z.object({
    type: z.literal("edit"),
    editedAction: z.object({
      name: z.string(),
      args: z.record(z.string(), z.unknown()),
    }),
  }),
  z.object({
    type: z.literal("reject"),
    message: z.string().optional(),
  }),
]);

/**
 * 恢复 HITL 中断的请求体校验。
 *
 * 用户审批写操作后调用，decisions 与 approval_request 的 interrupts 一一对应。
 */
export const resumeChatSchema = z.object({
  conversationId: z.coerce.number().int().positive("无效的会话 ID"),
  decisions: z.array(decisionSchema).min(1, "至少需要一个决策"),
});
