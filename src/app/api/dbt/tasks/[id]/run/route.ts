import * as taskExecutionService from "@/app/server/services/dbt/task-execution.service";
import { taskIdSchema } from "@/app/server/schemas/dbt/task.schema";
import {
  handleValidationError,
  apiError,
  notFound,
  conflict,
  badRequest,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** POST /api/dbt/tasks/[id]/run — 触发任务执行（立即返回 runId） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const parsed = taskIdSchema.safeParse({ id });
    if (!parsed.success) return handleValidationError(parsed.error);

    const result = await taskExecutionService.runTask(Number(id));
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, 401);
    if (error instanceof Error) {
      const code = (error as Error & { code?: string }).code;
      const msg = error.message;
      if (code === "NOT_FOUND") return notFound(msg);
      if (code === "CONFLICT") return conflict(msg);
      if (code === "BAD_REQUEST") return badRequest(msg);
    }
    return apiError("Failed to run task", 500);
  }
}
