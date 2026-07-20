import * as taskService from "@/app/server/services/dbt/task.service";
import { taskRunIdSchema } from "@/app/server/schemas/dbt/task.schema";
import {
  handleValidationError,
  apiError,
  notFound,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/task-runs/[runId] — 单条运行记录详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    await requireAuth();
    const { runId } = await params;
    const parsed = taskRunIdSchema.safeParse({ runId });
    if (!parsed.success) return handleValidationError(parsed.error);

    const run = await taskService.getRun(Number(runId));
    if (!run) return notFound("运行记录不存在");
    return Response.json(run);
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, 401);
    return apiError("Failed to get task run", 500);
  }
}
