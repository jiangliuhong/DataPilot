import {
  mysqlTable,
  bigint,
  varchar,
  timestamp,
  mysqlEnum,
  unique,
} from "drizzle-orm/mysql-core";

/** 用户表 */
export const users = mysqlTable(
  "users",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    email: varchar("email", { length: 255 }),
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
  (table) => [unique("users_username_unique").on(table.username)],
);

/** users 插入类型 */
export type NewUser = typeof users.$inferInsert;
/** users 查询类型 */
export type User = typeof users.$inferSelect;
