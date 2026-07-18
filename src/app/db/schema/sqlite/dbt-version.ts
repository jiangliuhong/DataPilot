import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/** dbt Core 版本表 */
export const dbtVersions = sqliteTable(
  "dbt_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name", { length: 255 }).notNull(),
    version: text("version", { length: 50 }).notNull(),
    adapterPackages: text("adapter_packages", { mode: "json" })
      .$type<
        {
          name: string;
          version: string;
          supportedDatabases: string[];
        }[]
      >()
      .notNull(),
    dependencies: text("dependencies", { mode: "json" })
      .$type<{ name: string; version: string }[]>()
      .notNull(),
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
  (table) => [unique("dbt_versions_name_unique").on(table.name)],
);

/** dbt_versions 插入类型 */
export type NewDbtVersion = typeof dbtVersions.$inferInsert;
/** dbt_versions 查询类型 */
export type DbtVersion = typeof dbtVersions.$inferSelect;
