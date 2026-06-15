import {
  mysqlTable,
  bigint,
  varchar,
  json,
  timestamp,
  mysqlEnum,
  unique,
} from "drizzle-orm/mysql-core";

/** dbt Core 版本表 */
export const dbtVersions = mysqlTable(
  "dbt_versions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    version: varchar("version", { length: 50 }).notNull(),
    adapterPackages: json("adapter_packages").$type<
      {
        name: string;
        version: string;
        supportedDatabases: string[];
      }[]
    >().notNull(),
    dependencies: json("dependencies").$type<
      { name: string; version: string }[]
    >().notNull(),
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
  (table) => [unique("dbt_versions_name_unique").on(table.name)],
);

/** dbt_versions 插入类型 */
export type NewDbtVersion = typeof dbtVersions.$inferInsert;
/** dbt_versions 查询类型 */
export type DbtVersion = typeof dbtVersions.$inferSelect;
