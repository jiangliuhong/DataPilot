import { type NextRequest } from "next/server";
import * as environmentService from "@/app/server/services/dbt/environment.service";
import * as environmentRepo from "@/app/server/repositories/dbt/environment.repository";
import { createEnvironmentSchema, listEnvironmentsQuerySchema } from "@/app/server/schemas/dbt/environment.schema";
import { handleValidationError, apiError, conflict, badRequest } from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/environments — 环境列表 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const query = listEnvironmentsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await environmentService.listEnvironments(query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list environments", 500);
  }
}

/** POST /api/dbt/environments — 创建运行环境 */
export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = createEnvironmentSchema.parse(body);

    const existing = await environmentRepo.findByName(data.name);
    if (existing) {
      return conflict("环境名称已存在");
    }

    const environment = await environmentService.createEnvironment(data);
    return Response.json(environment, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && (error.message.includes("不存在") || error.message.includes("不支持"))) {
      return badRequest(error.message);
    }
    return apiError("Failed to create environment", 500);
  }
}
