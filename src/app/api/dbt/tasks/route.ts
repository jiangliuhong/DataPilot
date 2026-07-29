import { type NextRequest } from "next/server";
import * as taskService from "@/app/server/services/dbt/task.service";
import {
  createTaskSchema,
  listTasksQuerySchema,
} from "@/app/server/schemas/dbt/task.schema";
import {
  handleValidationError,
  apiError,
  conflict,
  badRequest,
} from "@/app/server/errors/api-error";
import { requireAuth, UnauthorizedError } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/tasks — 任务列表（支持 projectId/environmentId/command 过滤） */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const query = listTasksQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await taskService.listTasks(query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError(error.message, 401);
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list tasks", 500);
  }
}

/** POST /api/dbt/tasks — 创建任务（唯一性/绑定/兼容性校验均在 service 层） */
export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = createTaskSchema.parse(body);

    const task = await taskService.createTask(data);
    return Response.json(task, { status: 201 });
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
    return apiError("Failed to create task", 500);
  }
}
