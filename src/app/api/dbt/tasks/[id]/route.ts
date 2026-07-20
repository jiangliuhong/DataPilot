import * as taskService from "@/app/server/services/dbt/task.service";
import {
  updateTaskSchema,
  taskIdSchema,
} from "@/app/server/schemas/dbt/task.schema";
import {
  handleValidationError,
  apiError,
  notFound,
  conflict,
  badRequest,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/tasks/[id] — 任务详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const parsed = taskIdSchema.safeParse({ id });
    if (!parsed.success) return handleValidationError(parsed.error);

    const task = await taskService.getTask(Number(id));
    if (!task) return notFound("任务不存在");
    return Response.json(task);
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, 401);
    return apiError("Failed to get task", 500);
  }
}

/** PUT /api/dbt/tasks/[id] — 更新任务 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const parsed = taskIdSchema.safeParse({ id });
    if (!parsed.success) return handleValidationError(parsed.error);

    const body = await request.json();
    const data = updateTaskSchema.parse(body);
    const task = await taskService.updateTask(Number(id), data);
    if (!task) return notFound("任务不存在");
    return Response.json(task);
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, 401);
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes("已存在")) return conflict(msg);
      if (msg.includes("不支持") || msg.includes("未绑定") || msg.includes("不存在")) {
        return badRequest(msg);
      }
    }
    return apiError("Failed to update task", 500);
  }
}

/** DELETE /api/dbt/tasks/[id] — 软删除任务 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const parsed = taskIdSchema.safeParse({ id });
    if (!parsed.success) return handleValidationError(parsed.error);

    const result = await taskService.deleteTask(Number(id));
    if (!result) return notFound("任务不存在");
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, 401);
    return apiError("Failed to delete task", 500);
  }
}
