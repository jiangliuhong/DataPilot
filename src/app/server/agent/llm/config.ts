/**
 * 大模型运行时配置 DTO（解密后、供 LLM 工厂使用）。
 *
 * 由 settings service 从 DB 读取并解密后构造，与 DB 行类型解耦：
 * - 不含 id / 时间戳 / 加密字段
 * - apiKey 为明文（仅在服务端内存中流转，不落日志、不回前端）
 */
export interface LlmRuntimeConfig {
  /** 协议供应商分发键 */
  provider: "openai" | "anthropic";
  /** 模型名 */
  model: string;
  /** 明文 API Key（本地 Ollama 等可空） */
  apiKey?: string;
  /** OpenAI 兼容服务 base URL 覆盖 */
  baseUrl?: string;
  /** 生成温度（0~2） */
  temperature?: number;
  /** 单次响应最大 tokens */
  maxTokens?: number;
  /** 核采样（0~1） */
  topP?: number;
}
