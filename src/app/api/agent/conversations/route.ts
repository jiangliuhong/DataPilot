import { type NextRequest } from "next/server";
import * as conversationService from "@/app/server/services/agent/conversation.service";
import {
  createConversationSchema,
  upsertWorkspaceAndCreateConversationSchema,
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

/**
 * POST /api/agent/conversations — 创建会话。
 *
 * 支持两种 body：
 * - 主流程（一步到位）：{ type, refId, name, title? } → upsert workspace + 建会话
 * - 已有 workspace：{ workspaceId, title? } → 直接建会话
 *
 * 通过 body 是否含 workspaceId 区分（first-match）。
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // 已有 workspace：直接建会话
    if (body && typeof body.workspaceId === "number") {
      const data = createConversationSchema.parse(body);
      const conversation = await conversationService.createConversation(
        user.id,
        data,
      );
      return Response.json(conversation, { status: 201 });
    }

    // 主流程：upsert workspace + 建会话
    const data = upsertWorkspaceAndCreateConversationSchema.parse(body);
    const { conversation } =
      await conversationService.upsertWorkspaceAndCreateConversation(
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
