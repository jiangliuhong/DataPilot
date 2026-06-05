import * as environmentService from "@/app/server/services/dbt/environment.service";
import { updateEnvironmentSchema, environmentIdSchema } from "@/app/server/schemas/dbt/environment.schema";
import { handleValidationError, apiError, notFound, conflict, badRequest } from "@/app/server/errors/api-error";

/** GET /api/dbt/environments/[id] — 环境详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = environmentIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const environment = await environmentService.getEnvironment(Number(id));
  if (!environment) return notFound("运行环境不存在");
  return Response.json(environment);
}

/** PUT /api/dbt/environments/[id] — 更新环境 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = environmentIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const body = await request.json();
    const data = updateEnvironmentSchema.parse(body);
    const environment = await environmentService.updateEnvironment(Number(id), data);
    if (!environment) return notFound("运行环境不存在");
    return Response.json(environment);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && (error.message.includes("不存在") || error.message.includes("不支持"))) {
      return badRequest(error.message);
    }
    return apiError("Failed to update environment", 500);
  }
}

/** DELETE /api/dbt/environments/[id] — 删除环境 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = environmentIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const result = await environmentService.deleteEnvironment(Number(id));
    if (!result) return notFound("运行环境不存在");
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("绑定")) {
      return conflict(error.message);
    }
    return apiError("Failed to delete environment", 500);
  }
}
