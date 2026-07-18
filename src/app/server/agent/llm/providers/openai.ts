import { ChatOpenAI } from "@langchain/openai";

/**
 * 创建 OpenAI 兼容的 ChatModel 实例。
 *
 * 兼容任何 OpenAI 协议服务（OpenAI 官方、DeepSeek、Moonshot、本地 Ollama / vLLM 等），
 * 通过 OPENAI_BASE_URL 切换。
 *
 * @throws Error 当 OPENAI_API_KEY 未配置时抛出明确错误
 */
export function createOpenAILLM() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("LLM API Key 未配置（环境变量 OPENAI_API_KEY）");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseURL = process.env.OPENAI_BASE_URL;

  return new ChatOpenAI({
    model,
    apiKey,
    // 仅在显式配置时覆盖 base URL，指向兼容服务
    ...(baseURL
      ? { configuration: { baseURL } }
      : {}),
  });
}
