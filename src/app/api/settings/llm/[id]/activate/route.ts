import * as llmConfigService from "@/app/server/services/settings/llm-provider-config.service";
import { llmConfigIdSchema } from "@/app/server/schemas/settings/llm-provider-config.schema";
import {
  handleValidationError,
  apiError,
  notFound,
} from "@/app/server/errors/api-error";
import { requireAuth } from "@/app/server/lib/auth-guard";

/** POST /api/settings/llm/[id]/activate — 设为当前生效配置 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const parsed = llmConfigIdSchema.safeParse({ id });
  if (!parsed.success) return handleValidationError(parsed.error);

  try {
    const config = await llmConfigService.activateLlmConfig(Number(id));
    if (!config) return notFound("大模型配置不存在");
    return Response.json(config);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "设为生效配置失败",
      500,
    );
  }
}
