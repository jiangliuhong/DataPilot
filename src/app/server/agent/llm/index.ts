import { createOpenAILLM } from "./providers/openai";

/**
 * LLM 接入工厂：按环境变量 LLM_PROVIDER 分发到对应 provider。
 *
 * 首版支持 `openai`（兼容任意 OpenAI 协议服务）。
 * 新增 provider 只需：① 在 providers/ 下新建文件 ② 在此添加 case 分支。
 *
 * @throws Error 当 provider 不支持或对应 API Key 未配置时
 */
export function createLLM() {
  const provider = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();

  switch (provider) {
    case "openai":
      return createOpenAILLM();
    default:
      throw new Error(
        `不支持的 LLM provider: ${provider}（当前仅支持 openai）`,
      );
  }
}
