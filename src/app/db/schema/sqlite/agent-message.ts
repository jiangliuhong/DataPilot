import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  foreignKey,
  index,
} from "drizzle-orm/sqlite-core";
import { agentConversations } from "./agent-conversation";

/**
 * Agent 对话消息表（SQLite）。
 *
 * toolCalls 在 SQLite 下用 text 存储，repository 层用 JSON.parse/stringify
 * 显式序列化/反序列化，保证与 MySQL 的行为一致。
 */
export const agentMessages = sqliteTable(
  "agent_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: integer("conversation_id").notNull(),
    role: text("role", { length: 16, enum: ["user", "assistant", "tool"] })
      .notNull(),
    content: text("content"),
    toolCalls: text("tool_calls"),
    toolCallId: text("tool_call_id", { length: 128 }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId],
      foreignColumns: [agentConversations.id],
      name: "agent_messages_conversation_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("agent_messages_conversation_id_idx").on(table.conversationId),
  ],
);

/** agent_messages 插入类型 */
export type NewAgentMessage = typeof agentMessages.$inferInsert;
/** agent_messages 查询类型 */
export type AgentMessage = typeof agentMessages.$inferSelect;
