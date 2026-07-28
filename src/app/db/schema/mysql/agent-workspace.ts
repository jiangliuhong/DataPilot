import {
  mysqlTable,
  bigint,
  varchar,
  timestamp,
  foreignKey,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { users } from "./user";

/**
 * Agent 工作空间表（MySQL）。
 *
 * 工作空间是 Agent 操作的「上下文根」抽象，一个 workspace 绑定一类资源实体。
 * 当前仅支持 `dbt_project` 类型（refId → dbt_projects.id），未来可扩展更多类型。
 * 多态关联：type + refId 指向具体实体，无外键约束（多态）。
 * 同一用户对同一 (type, refId) 只保留一个活跃 workspace（唯一索引）。
 */
export const agentWorkspaces = mysqlTable(
  "agent_workspaces",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    /** 工作空间类型：'dbt_project' | 未来扩展 */
    type: varchar("type", { length: 32 }).notNull(),
    /** 关联实体 id（如 dbt_projects.id），多态，无 FK */
    refId: bigint("ref_id", { mode: "number" }).notNull(),
    /** 冗余快照名（创建时的实体名），避免每次跨表 join */
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "agent_workspaces_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    // 同一用户对同一 (type, refId) 仅一个活跃 workspace。
    // 注意：唯一索引会包含 deletedAt，软删除后行不再冲突，可重新 upsert。
    uniqueIndex("agent_workspaces_user_type_ref_idx").on(
      table.userId,
      table.type,
      table.refId,
      table.deletedAt,
    ),
    index("agent_workspaces_user_deleted_idx").on(
      table.userId,
      table.deletedAt,
    ),
  ],
);

/** agent_workspaces 插入类型 */
export type NewAgentWorkspace = typeof agentWorkspaces.$inferInsert;
/** agent_workspaces 查询类型 */
export type AgentWorkspace = typeof agentWorkspaces.$inferSelect;
