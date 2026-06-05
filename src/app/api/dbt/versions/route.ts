import { type NextRequest } from "next/server";
import * as versionService from "@/app/server/services/dbt/version.service";
import * as versionRepo from "@/app/server/repositories/dbt/version.repository";
import { createVersionSchema, listVersionsQuerySchema } from "@/app/server/schemas/dbt/version.schema";
import { handleValidationError, apiError, conflict } from "@/app/server/errors/api-error";

/** GET /api/dbt/versions — 版本列表 */
export async function GET(request: NextRequest) {
  try {
    const query = listVersionsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await versionService.listVersions(query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to list versions", 500);
  }
}

/** POST /api/dbt/versions — 创建版本 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createVersionSchema.parse(body);

    const existing = await versionRepo.findByName(data.name);
    if (existing) {
      return conflict("版本名称已存在");
    }

    const version = await versionService.createVersion(data);
    return Response.json(version, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("Failed to create version", 500);
  }
}
