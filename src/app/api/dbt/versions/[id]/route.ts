import * as versionService from "@/app/server/services/dbt/version.service";
import { updateVersionSchema, versionIdSchema } from "@/app/server/schemas/dbt/version.schema";
import { handleValidationError, apiError, notFound, conflict, badRequest } from "@/app/server/errors/api-error";

/** GET /api/dbt/versions/[id] — 版本详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = versionIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const version = await versionService.getVersion(Number(id));
  if (!version) return notFound("版本不存在");
  return Response.json(version);
}

/** PUT /api/dbt/versions/[id] — 更新版本 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = versionIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const body = await request.json();
    const data = updateVersionSchema.parse(body);
    const version = await versionService.updateVersion(Number(id), data);
    if (!version) return notFound("版本不存在");
    return Response.json(version);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to update version", 500);
  }
}

/** DELETE /api/dbt/versions/[id] — 删除版本 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = versionIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const result = await versionService.deleteVersion(Number(id));
    if (!result) return notFound("版本不存在");
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("引用")) {
      return conflict(error.message);
    }
    return apiError("Failed to delete version", 500);
  }
}
