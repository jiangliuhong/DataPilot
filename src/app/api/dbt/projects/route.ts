import { type NextRequest } from "next/server";
import * as projectService from "@/app/server/services/dbt/project.service";
import { createProjectSchema, listProjectsQuerySchema } from "@/app/server/schemas/dbt/project.schema";
import { handleValidationError, apiError, conflict } from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/projects — 项目列表 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
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

/** POST /api/dbt/projects — 创建项目（唯一性校验在 service 层，route 不直接访问 repository） */
export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = createProjectSchema.parse(body);
    const project = await projectService.createProject(data);
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && error.message.includes("already exists")) {
      return conflict(error.message);
    }
    return apiError("Failed to create project", 500);
  }
}
