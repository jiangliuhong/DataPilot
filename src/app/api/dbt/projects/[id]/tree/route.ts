import { projectIdSchema } from "@/app/server/schemas/dbt/project.schema";
import * as directoryService from "@/app/server/services/dbt/directory.service";
import { handleValidationError, notFound } from "@/app/server/errors/api-error";
import * as projectService from "@/app/server/services/dbt/project.service";

/** GET /api/dbt/projects/:id/tree — 完整目录树 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const projectId = Number(id);
  const project = await projectService.getProject(projectId);
  if (!project) return notFound("Project not found");

  const tree = await directoryService.getDirectoryTree(projectId);
  return Response.json(tree);
}
