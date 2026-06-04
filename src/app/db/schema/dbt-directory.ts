import {
  mysqlTable,
  serial,
  int,
  varchar,
  timestamp,
  foreignKey,
  index,
} from "drizzle-orm/mysql-core";
import { dbtProjects } from "./dbt-project";

/** dbt 项目目录表 */
export const dbtDirectories = mysqlTable(
  "dbt_directories",
  {
    id: serial("id").primaryKey(),
    projectId: int("project_id").notNull(),
    parentId: int("parent_id"), // null = 根目录
    name: varchar("name", { length: 255 }).notNull(),
    path: varchar("path", { length: 1024 }).notNull(),
    depth: int("depth").notNull().default(0),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
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
