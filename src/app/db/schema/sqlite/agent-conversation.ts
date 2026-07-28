import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  foreignKey,
  index,
} from "drizzle-orm/sqlite-core";
import { users } from "./user";
import { agentWorkspaces } from "./agent-workspace";

/** Agent 对话会话表（SQLite，按用户隔离，必属一个 workspace） */
export const agentConversations = sqliteTable(
  "agent_conversations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    /** 所属工作空间（agent 操作的上下文根） */
    workspaceId: integer("workspace_id").notNull(),
    title: text("title", { length: 255 }).notNull().default("新对话"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "agent_conversations_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [agentWorkspaces.id],
      name: "agent_conversations_workspace_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("agent_conversations_user_id_idx").on(table.userId),
    index("agent_conversations_workspace_id_idx").on(table.workspaceId),
    index("agent_conversations_user_deleted_idx").on(
      table.userId,
      table.deletedAt,
    ),
  ],
);

/** agent_conversations 插入类型 */
export type NewAgentConversation = typeof agentConversations.$inferInsert;
/** agent_conversations 查询类型 */
export type AgentConversation = typeof agentConversations.$inferSelect;
