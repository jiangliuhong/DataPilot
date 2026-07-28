import { type NextRequest } from "next/server";
import * as llmConfigService from "@/app/server/services/settings/llm-provider-config.service";
import {
  createLlmConfigSchema,
  listLlmConfigsQuerySchema,
} from "@/app/server/schemas/settings/llm-provider-config.schema";
import {
  handleValidationError,
  apiError,
} from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/settings/llm — 大模型配置列表 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const query = listLlmConfigsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await llmConfigService.listLlmConfigs(query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    return apiError("查询大模型配置列表失败", 500);
  }
}

/** POST /api/settings/llm — 创建大模型配置 */
export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = createLlmConfigSchema.parse(body);
    const created = await llmConfigService.createLlmConfig(data);
    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    // service 层抛出的业务校验错误（如停用项不可生效）归为 400 并透传可读消息
    if (error instanceof Error) {
      return apiError(error.message, 400);
    }
    return apiError("创建大模型配置失败", 500);
  }
}
