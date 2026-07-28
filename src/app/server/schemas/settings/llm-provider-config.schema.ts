import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/app/server/configs/dbt/constants";

/** 支持的 LLM 协议供应商 */
export const LLM_PROVIDER_VALUES = ["openai", "anthropic"] as const;

/** 创建大模型配置 */
export const createLlmConfigSchema = z.object({
  name: z.string().min(1, "预设名称不能为空").max(100),
  provider: z.enum(LLM_PROVIDER_VALUES),
  model: z.string().min(1, "模型名不能为空").max(100),
  apiKey: z.string().optional(),
  baseUrl: z.string().max(512).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(1_000_000).optional(),
  topP: z.number().min(0).max(1).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

/** 更新大模型配置 */
export const updateLlmConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  provider: z.enum(LLM_PROVIDER_VALUES).optional(),
  model: z.string().min(1).max(100).optional(),
  // 仅在显式传入时重新加密 apiKey；空字符串/undefined 均视为不修改
  apiKey: z.string().optional(),
  baseUrl: z.string().max(512).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(1_000_000).optional(),
  topP: z.number().min(0).max(1).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

/** 配置 ID 参数 */
export const llmConfigIdSchema = z.object({
  id: z.coerce.number().int().positive("无效的配置 ID"),
});

/** 列表查询参数 */
export const listLlmConfigsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  provider: z.enum(LLM_PROVIDER_VALUES).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
