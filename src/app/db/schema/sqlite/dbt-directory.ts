import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  foreignKey,
  index,
} from "drizzle-orm/sqlite-core";
import { dbtProjects } from "./dbt-project";

/** dbt 项目目录表 */
export const dbtDirectories = sqliteTable(
  "dbt_directories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    parentId: integer("parent_id"), // null = 根目录
    name: text("name", { length: 255 }).notNull(),
    path: text("path", { length: 500 }).notNull(),
    depth: integer("depth").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
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
      columns: [table.projectId],
      foreignColumns: [dbtProjects.id],
      name: "dbt_directories_project_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "dbt_directories_parent_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("dbt_directories_project_id_idx").on(table.projectId),
    index("dbt_directories_parent_id_idx").on(table.parentId),
    index("dbt_directories_path_idx").on(table.path),
  ],
);

/** dbt_directories 插入类型 */
export type NewDbtDirectory = typeof dbtDirectories.$inferInsert;
/** dbt_directories 查询类型 */
export type DbtDirectory = typeof dbtDirectories.$inferSelect;
