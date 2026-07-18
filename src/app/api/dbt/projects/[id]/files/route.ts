import { projectIdSchema } from "@/app/server/schemas/dbt/project.schema";
import { createFileSchema, listFilesQuerySchema } from "@/app/server/schemas/dbt/file.schema";
import * as fileService from "@/app/server/services/dbt/file.service";
import * as projectService from "@/app/server/services/dbt/project.service";
import { handleValidationError, notFound, apiError, conflict, badRequest } from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/projects/:id/files — 文件列表 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const projectId = Number(id);
  const project = await projectService.getProject(projectId);
  if (!project) return notFound("Project not found");

  const query = listFilesQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return handleValidationError(query.error);

  const result = await fileService.listFiles({
    projectId,
    limit: query.data.limit,
    offset: query.data.offset,
    fileType: query.data.fileType,
    directoryId: query.data.directoryId,
  });
  return Response.json(result);
}

/** POST /api/dbt/projects/:id/files — 创建文件 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const projectId = Number(id);
  const project = await projectService.getProject(projectId);
  if (!project) return notFound("Project not found");

  try {
    const body = await request.json();
    const data = createFileSchema.parse(body);
    const file = await fileService.createFile({
      projectId,
      directoryId: data.directoryId ?? null,
      name: data.name,
      content: data.content,
      fileType: data.fileType,
    });
    return Response.json(file, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error) {
      if (error.message.includes("already exists")) return conflict("File already exists in this directory");
      if (error.message.includes("Unsupported") || error.message.includes("不支持")) return badRequest(error.message);
      return badRequest(error.message);
    }
    return apiError("Failed to create file", 500);
  }
}
