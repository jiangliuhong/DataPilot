import {
  mysqlTable,
  bigint,
  varchar,
  timestamp,
  foreignKey,
  index,
} from "drizzle-orm/mysql-core";
import { users } from "./user";
import { agentWorkspaces } from "./agent-workspace";

/** Agent 对话会话表（按用户隔离，必属一个 workspace） */
export const agentConversations = mysqlTable(
  "agent_conversations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    /** 所属工作空间（agent 操作的上下文根） */
    workspaceId: bigint("workspace_id", { mode: "number" }).notNull(),
    title: varchar("title", { length: 255 }).notNull().default("新对话"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // 会话归属于创建者用户
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "agent_conversations_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    // 会话归属于工作空间
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [agentWorkspaces.id],
      name: "agent_conversations_workspace_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("agent_conversations_user_id_idx").on(table.userId),
    index("agent_conversations_workspace_id_idx").on(table.workspaceId),
    // 加速"按用户列会话（排除软删除）"的查询
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
