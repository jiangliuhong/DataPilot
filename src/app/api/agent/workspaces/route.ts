import { type NextRequest } from "next/server";
import * as conversationService from "@/app/server/services/agent/conversation.service";
import { listConversationsQuerySchema } from "@/app/server/schemas/agent/conversation.schema";
import {
  handleValidationError,
  apiError,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/agent/workspaces — 当前用户的工作空间列表 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const query = listConversationsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await conversationService.listWorkspaces(user.id, query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return apiError(error.message, 401);
    }
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list workspaces", 500);
  }
}
