import * as conversationService from "@/app/server/services/agent/conversation.service";
import { conversationIdSchema } from "@/app/server/schemas/agent/conversation.schema";
import {
  handleValidationError,
  notFound,
  apiError,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/agent/conversations/:id — 会话详情（带归属校验） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = conversationIdSchema.parse(await params);
    const conversation = await conversationService.getConversation(id, user.id);
    if (!conversation) return notFound("会话不存在");
    return Response.json(conversation);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to get conversation", 500);
  }
}

/** DELETE /api/agent/conversations/:id — 软删除会话（带归属校验） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = conversationIdSchema.parse(await params);
    const result = await conversationService.deleteConversation(id, user.id);
    if (!result) return notFound("会话不存在");
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to delete conversation", 500);
  }
}
