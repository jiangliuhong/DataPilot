import * as conversationService from "@/app/server/services/agent/conversation.service";
import { conversationIdSchema } from "@/app/server/schemas/agent/conversation.schema";
import {
  handleValidationError,
  notFound,
  apiError,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/agent/conversations/:id/messages — 会话消息列表（带归属校验） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = conversationIdSchema.parse(await params);
    const messages = await conversationService.listMessages(id, user.id);
    // 会话不属于该用户（或不存在）→ 404
    if (!messages) return notFound("会话不存在");
    return Response.json({ items: messages });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list messages", 500);
  }
}
