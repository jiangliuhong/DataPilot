import { createOpenAILLM } from "./providers/openai";
import { createAnthropicLLM } from "./providers/anthropic";
import type { LlmRuntimeConfig } from "./config";

/**
 * LLM 接入工厂：按运行时配置的 provider 字段分发到对应 provider。
 *
 * 配置来源为 settings service（DB），不再读取环境变量。
 * 新增 provider 只需：① 在 providers/ 下新建文件 ② 在此添加 case 分支。
 *
 * @param config 运行时配置（已解密，来自 settings service）
 * @throws Error 当 provider 不支持时
 */
export function createLLM(config: LlmRuntimeConfig) {
  switch (config.provider) {
    case "openai":
      return createOpenAILLM(config);
    case "anthropic":
      return createAnthropicLLM(config);
    default:
      throw new Error(
        `不支持的 LLM provider: ${config.provider satisfies never}（当前支持 openai / anthropic）`,
      );
  }
}

export type { LlmRuntimeConfig } from "./config";
