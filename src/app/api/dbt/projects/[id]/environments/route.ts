import { type NextRequest } from "next/server";
import * as projectEnvService from "@/app/server/services/dbt/project-environment.service";
import { bindEnvironmentSchema, projectIdParamSchema } from "@/app/server/schemas/dbt/project-environment.schema";
import { DEFAULT_PAGE_SIZE } from "@/app/server/configs/dbt/constants";
import { handleValidationError, apiError, notFound, conflict, badRequest } from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/dbt/projects/[id]/environments — 查看项目绑定的环境列表 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = projectIdParamSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const result = await projectEnvService.listProjectEnvironments({
      projectId: Number(id),
      limit: Number(searchParams.limit) || DEFAULT_PAGE_SIZE,
      offset: Number(searchParams.offset) || 0,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("不存在")) {
      return notFound(error.message);
    }
    return apiError("Failed to list project environments", 500);
  }
}

/** POST /api/dbt/projects/[id]/environments — 绑定环境 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = projectIdParamSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const body = await request.json();
    const data = bindEnvironmentSchema.parse(body);

    const binding = await projectEnvService.bindEnvironment({
      projectId: Number(id),
      ...data,
    });
    return Response.json(binding, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    if (error instanceof Error && error.message.includes("已存在")) {
      return conflict(error.message);
    }
    if (error instanceof Error && error.message.includes("不存在")) {
      return notFound(error.message);
    }
    return apiError("Failed to bind environment", 500);
  }
}
