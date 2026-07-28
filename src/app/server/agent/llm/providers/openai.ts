import { ChatOpenAI } from "@langchain/openai";
import type { LlmRuntimeConfig } from "../config";

/**
 * 创建 OpenAI 兼容的 ChatModel 实例。
 *
 * 兼容任何 OpenAI 协议服务（OpenAI 官方、DeepSeek、Moonshot、本地 Ollama / vLLM 等），
 * 通过 baseUrl 切换。
 *
 * @param config 运行时配置（已解密，来自 settings service）
 * @throws Error 当 apiKey 未配置时抛出明确错误（本地 Ollama 等无 key 服务可留空）
 */
export function createOpenAILLM(config: LlmRuntimeConfig) {
  if (!config.apiKey) {
    throw new Error("OpenAI 协议大模型未配置 API Key");
  }

  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    // 仅在显式配置时覆盖 base URL，指向兼容服务
    ...(config.baseUrl
      ? { configuration: { baseURL: config.baseUrl } }
      : {}),
    ...buildGenerationParams(config),
  });
}

/** 从运行时配置提取 OpenAI 支持的生成参数（仅取已配置项） */
function buildGenerationParams(config: LlmRuntimeConfig) {
  const params: Record<string, number> = {};
  if (config.temperature !== undefined) params.temperature = config.temperature;
  if (config.maxTokens !== undefined) params.maxTokens = config.maxTokens;
  if (config.topP !== undefined) params.topP = config.topP;
  return params;
}
