import {
  mysqlTable,
  bigint,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  foreignKey,
  index,
} from "drizzle-orm/mysql-core";
import { agentConversations } from "./agent-conversation";

/** Agent 对话消息表 */
export const agentMessages = mysqlTable(
  "agent_messages",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    conversationId: bigint("conversation_id", { mode: "number" }).notNull(),
    role: mysqlEnum("role", ["user", "assistant", "tool"]).notNull(),
    // tool 消息可能只有 tool_calls；content 可空
    content: text("content"),
    // assistant 消息的工具调用数组（JSON 字符串）
    toolCalls: text("tool_calls"),
    // tool 消息关联的调用 id（对应 assistant 消息 toolCalls 中的 id）
    toolCallId: varchar("tool_call_id", { length: 128 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
