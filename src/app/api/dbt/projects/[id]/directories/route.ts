import { projectIdSchema } from "@/app/server/schemas/dbt/project.schema";
import { createDirectorySchema, listDirectoriesQuerySchema } from "@/app/server/schemas/dbt/directory.schema";
import * as directoryService from "@/app/server/services/dbt/directory.service";
import * as projectService from "@/app/server/services/dbt/project.service";
import { handleValidationError, notFound, apiError, conflict } from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/projects/:id/directories — 目录列表 */
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

  const query = listDirectoriesQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (query.success && query.data.parentId !== undefined) {
    const dirs = await directoryService.listDirectoriesByParent(projectId, query.data.parentId);
    return Response.json(dirs);
  }

  const dirs = await directoryService.listDirectories(projectId);
  return Response.json(dirs);
}

/** POST /api/dbt/projects/:id/directories — 创建目录 */
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
    const data = createDirectorySchema.parse(body);
    const directory = await directoryService.createDirectory({
      projectId,
      name: data.name,
      parentId: data.parentId ?? null,
    });
    return Response.json(directory, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && error.message.includes("already exists")) {
      return conflict("Directory already exists in this location");
    }
    return apiError("Failed to create directory", 500);
  }
}
