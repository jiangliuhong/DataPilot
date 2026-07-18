import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/** dbt 数据库连接表 */
export const dbtDatabaseConnections = sqliteTable(
  "dbt_database_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name", { length: 255 }).notNull(),
    databaseType: text("database_type", {
      length: 20,
      enum: ["mysql5", "mysql8", "starrocks", "postgresql"],
    }).notNull(),
    host: text("host", { length: 255 }).notNull(),
    port: integer("port").notNull(),
    databaseName: text("database_name", { length: 255 }).notNull(),
    schemaName: text("schema_name", { length: 255 }),
    username: text("username", { length: 255 }).notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    extraConfig: text("extra_config", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
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
  (table) => [unique("dbt_database_connections_name_unique").on(table.name)],
);

/** dbt_database_connections 插入类型 */
export type NewDbtDatabaseConnection =
  typeof dbtDatabaseConnections.$inferInsert;
/** dbt_database_connections 查询类型 */
export type DbtDatabaseConnection =
  typeof dbtDatabaseConnections.$inferSelect;
