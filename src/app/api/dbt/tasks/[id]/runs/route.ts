import { type NextRequest } from "next/server";
import * as taskService from "@/app/server/services/dbt/task.service";
import * as taskRepo from "@/app/server/repositories/dbt/task.repository";
import {
  taskIdSchema,
  listTaskRunsQuerySchema,
} from "@/app/server/schemas/dbt/task.schema";
import {
  handleValidationError,
  apiError,
  notFound,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/tasks/[id]/runs — 任务运行记录列表（含僵尸记录修正） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const parsed = taskIdSchema.safeParse({ id });
    if (!parsed.success) return handleValidationError(parsed.error);

    const taskId = Number(id);
    // 校验任务存在
    const task = await taskRepo.findById(taskId);
    if (!task) return notFound("任务不存在");

    const query = listTaskRunsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await taskService.listTaskRuns({
      taskId,
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, 401);
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list task runs", 500);
  }
}
