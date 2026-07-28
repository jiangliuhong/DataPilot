import { ChatAnthropic } from "@langchain/anthropic";
import type { LlmRuntimeConfig } from "../config";

/** Anthropic 默认最大输出 tokens（SDK 默认值偏小，未显式配置时兜底） */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * 创建 Anthropic（Claude）ChatModel 实例。
 *
 * @param config 运行时配置（已解密，来自 settings service）
 * @throws Error 当 apiKey 未配置时抛出明确错误
 */
export function createAnthropicLLM(config: LlmRuntimeConfig) {
  if (!config.apiKey) {
    throw new Error("Anthropic 协议大模型未配置 API Key");
  }

  return new ChatAnthropic({
    model: config.model,
    anthropicApiKey: config.apiKey,
    // 仅在显式配置时覆盖 base URL
    ...(config.baseUrl ? { anthropicApiUrl: config.baseUrl } : {}),
    // Anthropic 要求显式 maxTokens；未配置时使用兜底值
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...buildGenerationParams(config),
  });
}

/** 从运行时配置提取 Anthropic 支持的生成参数（仅取已配置项） */
function buildGenerationParams(config: LlmRuntimeConfig) {
  const params: { temperature?: number; topP?: number } = {};
  if (config.temperature !== undefined) params.temperature = config.temperature;
  if (config.topP !== undefined) params.topP = config.topP;
  return params;
}
