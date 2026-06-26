import * as environmentService from "@/app/server/services/dbt/environment.service";
import {
  environmentIdSchema,
} from "@/app/server/schemas/dbt/environment.schema";
import {
  handleValidationError,
  apiError,
  notFound,
  conflict,
} from "@/app/server/errors/api-error";

/**
 * POST /api/dbt/environments/[id]/initialize
 * 手动触发运行环境的 venv 初始化。异步执行，立即返回。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = environmentIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const result = await environmentService.initializeEnvironment(Number(id));
    return Response.json(result);
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    if (code === "NOT_FOUND") return notFound("运行环境不存在");
    if (code === "CONFLICT") return conflict("该环境正在初始化中");
    return apiError("Failed to initialize environment", 500);
  }
}
