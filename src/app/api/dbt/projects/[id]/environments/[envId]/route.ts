import * as projectEnvService from "@/app/server/services/dbt/project-environment.service";
import { unbindEnvironmentSchema } from "@/app/server/schemas/dbt/project-environment.schema";
import { handleValidationError, apiError, notFound } from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** DELETE /api/dbt/projects/[id]/environments/[envId] — 解绑环境 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> },
) {
  await requireAuth();
  const { id, envId } = await params;
  const parsed = unbindEnvironmentSchema.safeParse({ id, envId });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const result = await projectEnvService.unbindEnvironment(
      Number(id),
      Number(envId),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("不存在")) {
      return notFound(error.message);
    }
    return apiError("Failed to unbind environment", 500);
  }
}
