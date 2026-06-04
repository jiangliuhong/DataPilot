import { projectIdSchema } from "@/app/server/schemas/dbt/project.schema";
import * as importExportService from "@/app/server/services/dbt/import-export.service";
import * as projectService from "@/app/server/services/dbt/project.service";
import { handleValidationError, notFound, apiError, badRequest } from "@/app/server/errors/api-error";

/** GET /api/dbt/projects/:id/export — 导出为 ZIP */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const projectId = Number(id);

  try {
    const project = await projectService.getProject(projectId);
    if (!project) return notFound("Project not found");

    const zipBuffer = await importExportService.exportProject(projectId);

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name}.zip"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(error.message);
    }
    return apiError("Failed to export project", 500);
  }
}
