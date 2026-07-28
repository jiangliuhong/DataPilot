import type { PaginatedResponse, PaginationParams } from "@/web/types/dbt";

/** 支持的 LLM 协议供应商 */
export type LlmProvider = "openai" | "anthropic";

/** 大模型配置项（脱敏：不含明文 apiKey，仅 hasApiKey 标记） */
export interface LlmProviderConfigItem {
  id: number;
  name: string;
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  isDefault: boolean;
  status: "active" | "inactive";
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** 创建配置入参 */
export interface CreateLlmConfigInput {
  name: string;
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  isDefault?: boolean;
  status?: "active" | "inactive";
}

/** 更新配置入参（apiKey 留空表示不修改） */
export interface UpdateLlmConfigInput {
  name?: string;
  provider?: LlmProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  isDefault?: boolean;
  status?: "active" | "inactive";
}

/** 列表查询参数 */
export type ListLlmConfigsParams = PaginationParams & {
  provider?: LlmProvider;
  status?: "active" | "inactive";
};

/** 列表响应 */
export type LlmConfigListResponse = PaginatedResponse<LlmProviderConfigItem>;

/** provider 选项（下拉用） */
export const LLM_PROVIDER_OPTIONS: {
  value: LlmProvider;
  label: string;
  description: string;
}[] = [
  {
    value: "openai",
    label: "OpenAI 协议",
    description: "兼容 OpenAI 官方、DeepSeek、Moonshot、本地 Ollama / vLLM 等",
  },
  {
    value: "anthropic",
    label: "Anthropic 协议",
    description: "Claude 系列（gpt-4o-mini 不适用，需选用 Claude 模型）",
  },
];
