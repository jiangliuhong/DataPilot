import * as llmConfigService from "@/app/server/services/settings/llm-provider-config.service";
import {
  updateLlmConfigSchema,
  llmConfigIdSchema,
} from "@/app/server/schemas/settings/llm-provider-config.schema";
import {
  handleValidationError,
  apiError,
  notFound,
} from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** GET /api/settings/llm/[id] — 配置详情 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = llmConfigIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const config = await llmConfigService.getLlmConfig(Number(id));
  if (!config) return notFound("大模型配置不存在");
  return Response.json(config);
}

/** PUT /api/settings/llm/[id] — 更新配置 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = llmConfigIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const body = await request.json();
    const data = updateLlmConfigSchema.parse(body);
    const config = await llmConfigService.updateLlmConfig(Number(id), data);
    if (!config) return notFound("大模型配置不存在");
    return Response.json(config);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return handleValidationError(error as unknown as import("zod").ZodError);
    }
    // service 层抛出的业务校验错误（如停用项不可生效）归为 400 并透传可读消息
    if (error instanceof Error) {
      return apiError(error.message, 400);
    }
    return apiError("更新大模型配置失败", 500);
  }
}

/** DELETE /api/settings/llm/[id] — 删除配置 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = llmConfigIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  const result = await llmConfigService.deleteLlmConfig(Number(id));
  if (!result) return notFound("大模型配置不存在");
  return Response.json({ success: true });
}
