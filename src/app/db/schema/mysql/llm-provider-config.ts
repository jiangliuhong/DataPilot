import {
  mysqlTable,
  bigint,
  varchar,
  text,
  double,
  int,
  boolean,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

/**
 * 大模型供应商配置表（全局共享）。
 *
 * 支持多套预设，其中 isDefault=true 的为当前生效配置（全局唯一，由 service 层事务保证）。
 * API Key 以 AES-256-GCM 加密存储（encryptedApiKey），本地服务如 Ollama 可空。
 * 配置项不再从环境变量读取，DB 为唯一来源。
 */
export const llmProviderConfigs = mysqlTable(
  "llm_provider_configs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    name: varchar("name", { length: 100 }).notNull(),
    // 协议分发键：openai（兼容任意 OpenAI 协议服务）/ anthropic
    provider: mysqlEnum("provider", ["openai", "anthropic"]).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    // 加密后的 API Key；本地 Ollama 等无 key 服务可空
    encryptedApiKey: text("encrypted_api_key"),
    // OpenAI 兼容服务的 base URL 覆盖（如 DeepSeek、Moonshot、本地 vLLM）
    baseUrl: varchar("base_url", { length: 512 }),
    // 生成参数（均可空，未配置时由 provider SDK 使用默认值）
    temperature: double("temperature"),
    maxTokens: int("max_tokens"),
    topP: double("top_p"),
    // 当前生效配置（全局唯一，由 service 事务保证）
    isDefault: boolean("is_default").notNull().default(false),
    status: mysqlEnum("status", ["active", "inactive"])
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
);

/** llm_provider_configs 插入类型 */
export type NewLlmProviderConfig = typeof llmProviderConfigs.$inferInsert;
/** llm_provider_configs 查询类型 */
export type LlmProviderConfig = typeof llmProviderConfigs.$inferSelect;
