import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  real,
} from "drizzle-orm/sqlite-core";

/**
 * 大模型供应商配置表（全局共享）。
 *
 * 支持多套预设，其中 isDefault=true 的为当前生效配置（全局唯一，由 service 层事务保证）。
 * API Key 以 AES-256-GCM 加密存储（encryptedApiKey），本地服务如 Ollama 可空。
 * 配置项不再从环境变量读取，DB 为唯一来源。
 */
export const llmProviderConfigs = sqliteTable(
  "llm_provider_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name", { length: 100 }).notNull(),
    // 协议分发键：openai（兼容任意 OpenAI 协议服务）/ anthropic
    provider: text("provider", { length: 32, enum: ["openai", "anthropic"] })
      .notNull(),
    model: text("model", { length: 100 }).notNull(),
    // 加密后的 API Key；本地 Ollama 等无 key 服务可空
    encryptedApiKey: text("encrypted_api_key", { length: 2048 }),
    // OpenAI 兼容服务的 base URL 覆盖（如 DeepSeek、Moonshot、本地 vLLM）
    baseUrl: text("base_url", { length: 512 }),
    // 生成参数（均可空，未配置时由 provider SDK 使用默认值）
    temperature: real("temperature"),
    maxTokens: integer("max_tokens"),
    topP: real("top_p"),
    // 当前生效配置（全局唯一，由 service 事务保证）
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", { length: 8, enum: ["active", "inactive"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
);

/** llm_provider_configs 插入类型 */
export type NewLlmProviderConfig = typeof llmProviderConfigs.$inferInsert;
/** llm_provider_configs 查询类型 */
export type LlmProviderConfig = typeof llmProviderConfigs.$inferSelect;
