import { type NextRequest } from "next/server";
import * as projectService from "@/app/server/services/dbt/project.service";
import * as projectRepo from "@/app/server/repositories/dbt/project.repository";
import { createProjectSchema, listProjectsQuerySchema } from "@/app/server/schemas/dbt/project.schema";
import { safeExecute, handleValidationError, apiError, conflict } from "@/app/server/errors/api-error";

/** GET /api/dbt/projects — 项目列表 */
export async function GET(request: NextRequest) {
  try {
    const query = listProjectsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await projectService.listProjects(query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list projects", 500);
  }
}

/** POST /api/dbt/projects — 创建项目 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createProjectSchema.parse(body);

    // 检查名称唯一性
    const existing = await projectRepo.findByName(data.name);
    if (existing) {
      return conflict("Project name already exists");
    }

    const project = await projectService.createProject(data);
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to create project", 500);
  }
}
