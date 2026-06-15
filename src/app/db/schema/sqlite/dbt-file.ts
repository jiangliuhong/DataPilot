import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  foreignKey,
  index,
} from "drizzle-orm/sqlite-core";
import { dbtProjects } from "./dbt-project";
import { dbtDirectories } from "./dbt-directory";

/** dbt 项目文件表 */
export const dbtFiles = sqliteTable(
  "dbt_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    directoryId: integer("directory_id"), // null = 项目根目录下的文件
    name: text("name", { length: 255 }).notNull(),
    path: text("path", { length: 500 }).notNull(),
    content: text("content").notNull().default(""),
    fileType: text("file_type", { length: 20 }).notNull(),
    size: integer("size").notNull().default(0),
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
      name: "dbt_files_project_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.directoryId],
      foreignColumns: [dbtDirectories.id],
      name: "dbt_files_directory_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("dbt_files_project_id_idx").on(table.projectId),
    index("dbt_files_directory_id_idx").on(table.directoryId),
    index("dbt_files_path_idx").on(table.path),
    index("dbt_files_file_type_idx").on(table.fileType),
  ],
);

/** dbt_files 插入类型 */
export type NewDbtFile = typeof dbtFiles.$inferInsert;
/** dbt_files 查询类型 */
export type DbtFile = typeof dbtFiles.$inferSelect;
