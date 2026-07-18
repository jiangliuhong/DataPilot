import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/** dbt 项目表 */
export const dbtProjects = sqliteTable(
  "dbt_projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name", { length: 255 }).notNull(),
    description: text("description"),
    status: text("status", { length: 10, enum: ["active", "archived"] })
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
  (table) => [unique("dbt_projects_name_unique").on(table.name)],
);

/** dbt_projects 插入类型 */
export type NewDbtProject = typeof dbtProjects.$inferInsert;
/** dbt_projects 查询类型 */
export type DbtProject = typeof dbtProjects.$inferSelect;
