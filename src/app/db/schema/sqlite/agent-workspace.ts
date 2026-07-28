import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  foreignKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { users } from "./user";

/**
 * Agent 工作空间表（SQLite）。
 *
 * 工作空间是 Agent 操作的「上下文根」抽象，一个 workspace 绑定一类资源实体。
 * 当前仅支持 `dbt_project` 类型（refId → dbt_projects.id），未来可扩展更多类型。
 * 多态关联：type + refId 指向具体实体，无外键约束（多态）。
 * 同一用户对同一 (type, refId) 只保留一个活跃 workspace（唯一索引）。
 */
export const agentWorkspaces = sqliteTable(
  "agent_workspaces",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    /** 工作空间类型：'dbt_project' | 未来扩展 */
    type: text("type", { length: 32 }).notNull(),
    /** 关联实体 id（如 dbt_projects.id），多态，无 FK */
    refId: integer("ref_id").notNull(),
    /** 冗余快照名（创建时的实体名），避免每次跨表 join */
    name: text("name", { length: 255 }).notNull(),
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
      name: "agent_workspaces_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    // 同一用户对同一 (type, refId) 仅一个活跃 workspace。
    // 注意：SQLite 唯一索引会把 deletedAt IS NULL 的行视为不同（NULL 不相等），
    // 因此软删除后再 upsert 会创建新行，符合「软删后可重建」语义。
    uniqueIndex("agent_workspaces_user_type_ref_idx").on(
      table.userId,
      table.type,
      table.refId,
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
