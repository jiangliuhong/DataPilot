import { resumeChat, type ResumeDecision } from "@/app/server/agent/project-agent.service";
import { resumeChatSchema } from "@/app/server/schemas/agent/chat.schema";
import {
  handleValidationError,
  notFound,
  apiError,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";
import { createAgentSseResponse } from "../sse-response";

/**
 * POST /api/agent/chat/resume — 恢复因 HITL 中断的 agent 执行（SSE）。
 *
 * 用户审批写操作后调用。必须复用同一 conversation（thread_id），
 * checkpointer 才能恢复中断前的执行态。
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    return apiError("认证失败", 500);
  }

  let body: { conversationId: number; decisions: ResumeDecision[] };
  try {
    const parsed = resumeChatSchema.parse(await request.json());
    body = parsed as { conversationId: number; decisions: ResumeDecision[] };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("请求解析失败", 400);
  }

  // 会话存在性预检（在流启动前，以便返回真实 404）
  const { getConversation } = await import(
    "@/app/server/services/agent/conversation.service"
  );
  const existing = await getConversation(body.conversationId, user.id);
  if (!existing) {
    return notFound("会话不存在");
  }

  return createAgentSseResponse(request.signal, (emit) =>
    resumeChat(user.id, body.conversationId, body.decisions, emit),
  );
}
