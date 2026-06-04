import { directoryIdSchema, updateDirectorySchema } from "@/app/server/schemas/dbt/directory.schema";
import * as directoryService from "@/app/server/services/dbt/directory.service";
import { handleValidationError, notFound, apiError, badRequest } from "@/app/server/errors/api-error";

/** PUT /api/dbt/projects/:id/directories/:dirId — 重命名/移动目录 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; dirId: string }> },
) {
  const rawParams = await params;
  const parsed = directoryIdSchema.safeParse(rawParams);
  if (!parsed.success) return handleValidationError(parsed.error);

  const projectId = Number(rawParams.id);
  const dirId = Number(rawParams.dirId);

  try {
    const body = await request.json();
    const data = updateDirectorySchema.parse(body);

    // 重命名
    if (data.name) {
      const result = await directoryService.renameDirectory(projectId, dirId, data.name);
      return Response.json(result);
    }

    // 移动
    if (data.parentId !== undefined) {
      const result = await directoryService.moveDirectory(projectId, dirId, data.parentId);
      return Response.json(result);
    }

    return badRequest("Must provide name or parentId to update");
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error) {
      if (error.message.includes("not found")) return notFound(error.message);
      if (error.message.includes("Cannot move")) return badRequest(error.message);
      return badRequest(error.message);
    }
    return apiError("Failed to update directory", 500);
  }
}

/** DELETE /api/dbt/projects/:id/directories/:dirId — 删除目录 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; dirId: string }> },
) {
  const rawParams = await params;
  const parsed = directoryIdSchema.safeParse(rawParams);
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    await directoryService.deleteDirectory(Number(rawParams.id), Number(rawParams.dirId));
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(error.message);
    }
    return apiError("Failed to delete directory", 500);
  }
}
