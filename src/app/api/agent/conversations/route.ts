import { type NextRequest } from "next/server";
import * as conversationService from "@/app/server/services/agent/conversation.service";
import {
  createConversationSchema,
  listConversationsQuerySchema,
} from "@/app/server/schemas/agent/conversation.schema";
import {
  handleValidationError,
  apiError,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/agent/conversations — 当前用户的会话列表 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const query = listConversationsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await conversationService.listConversations(
      user.id,
      query,
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list conversations", 500);
  }
}

/** POST /api/agent/conversations — 创建会话（归属当前用户） */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = createConversationSchema.parse(body);
    const conversation = await conversationService.createConversation(
      user.id,
      data,
    );
    return Response.json(conversation, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to create conversation", 500);
  }
}
