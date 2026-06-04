import { fileIdSchema, updateFileSchema } from "@/app/server/schemas/dbt/file.schema";
import * as fileService from "@/app/server/services/dbt/file.service";
import { handleValidationError, notFound, apiError, badRequest } from "@/app/server/errors/api-error";

/** GET /api/dbt/projects/:id/files/:fileId — 文件详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const rawParams = await params;
  const parsed = fileIdSchema.safeParse(rawParams);
  if (!parsed.success) return handleValidationError(parsed.error);

  const file = await fileService.getFile(Number(rawParams.fileId));
  if (!file) return notFound("File not found");
  return Response.json(file);
}

/** PUT /api/dbt/projects/:id/files/:fileId — 更新文件 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const rawParams = await params;
  const parsed = fileIdSchema.safeParse(rawParams);
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const body = await request.json();
    const data = updateFileSchema.parse(body);
    const file = await fileService.updateFile(Number(rawParams.fileId), data);
    return Response.json(file);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(error.message);
    }
    return apiError("Failed to update file", 500);
  }
}

/** DELETE /api/dbt/projects/:id/files/:fileId — 删除文件 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const rawParams = await params;
  const parsed = fileIdSchema.safeParse(rawParams);
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    await fileService.deleteFile(Number(rawParams.fileId));
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(error.message);
    }
    return apiError("Failed to delete file", 500);
  }
}
