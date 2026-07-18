import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/** 用户表 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username", { length: 64 }).notNull(),
    passwordHash: text("password_hash", { length: 255 }).notNull(),
    displayName: text("display_name", { length: 128 }).notNull(),
    email: text("email", { length: 255 }),
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
  (table) => [unique("users_username_unique").on(table.username)],
);

/** users 插入类型 */
export type NewUser = typeof users.$inferInsert;
/** users 查询类型 */
export type User = typeof users.$inferSelect;
