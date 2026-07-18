import { projectIdSchema } from "@/app/server/schemas/dbt/project.schema";
import * as importExportService from "@/app/server/services/dbt/import-export.service";
import { handleValidationError, notFound, apiError, badRequest, payloadTooLarge } from "@/app/server/errors/api-error";
import { MAX_IMPORT_FILE_SIZE } from "@/app/server/configs/dbt/constants";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** POST /api/dbt/projects/:id/import — 导入 ZIP 文件 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const projectId = Number(id);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return badRequest("No file uploaded");
    }

    // 校验文件类型
    if (!file.name.endsWith(".zip")) {
      return badRequest("Invalid file format, only ZIP is supported");
    }

    // 校验文件大小
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      return payloadTooLarge("File size exceeds limit (50MB)");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importExportService.importProject(projectId, buffer);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) return notFound(error.message);
      if (error.message.includes("exceeds limit")) return payloadTooLarge(error.message);
      return badRequest(error.message);
    }
    return apiError("Failed to import project", 500);
  }
}
