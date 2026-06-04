import { updateProjectSchema, projectIdSchema } from "@/app/server/schemas/dbt/project.schema";
import * as projectService from "@/app/server/services/dbt/project.service";
import { safeExecute, handleValidationError, apiError, notFound } from "@/app/server/errors/api-error";

/** GET /api/dbt/projects/:id — 项目详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const project = await projectService.getProject(Number(id));
  if (!project) return notFound("Project not found");
  return Response.json(project);
}

/** PUT /api/dbt/projects/:id — 更新项目 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const body = await request.json();
    const data = updateProjectSchema.parse(body);
    const project = await projectService.updateProject(Number(id), data);
    if (!project) return notFound("Project not found");
    return Response.json(project);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to update project", 500);
  }
}

/** DELETE /api/dbt/projects/:id — 软删除项目 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const result = await projectService.deleteProject(Number(id));
  if (!result) return notFound("Project not found");
  return Response.json({ success: true });
}
