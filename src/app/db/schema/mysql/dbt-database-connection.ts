import {
  mysqlTable,
  bigint,
  varchar,
  text,
  json,
  timestamp,
  mysqlEnum,
  unique,
} from "drizzle-orm/mysql-core";

/** dbt 数据库连接表 */
export const dbtDatabaseConnections = mysqlTable(
  "dbt_database_connections",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    databaseType: mysqlEnum("database_type", [
      "mysql5",
      "mysql8",
      "starrocks",
      "postgresql",
    ]).notNull(),
    host: varchar("host", { length: 255 }).notNull(),
    port: bigint("port", { mode: "number" }).notNull(),
    databaseName: varchar("database_name", { length: 255 }).notNull(),
    schemaName: varchar("schema_name", { length: 255 }),
    username: varchar("username", { length: 255 }).notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    extraConfig: json("extra_config").$type<Record<string, unknown>>(),
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
  (table) => [unique("dbt_database_connections_name_unique").on(table.name)],
);

/** dbt_database_connections 插入类型 */
export type NewDbtDatabaseConnection =
  typeof dbtDatabaseConnections.$inferInsert;
/** dbt_database_connections 查询类型 */
export type DbtDatabaseConnection =
  typeof dbtDatabaseConnections.$inferSelect;
