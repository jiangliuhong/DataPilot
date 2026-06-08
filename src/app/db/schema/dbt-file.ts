import {
  mysqlTable,
  bigint,
  varchar,
  text,
  timestamp,
  foreignKey,
  index,
} from "drizzle-orm/mysql-core";
import { dbtProjects } from "./dbt-project";
import { dbtDirectories } from "./dbt-directory";

/** dbt 项目文件表 */
export const dbtFiles = mysqlTable(
  "dbt_files",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    projectId: bigint("project_id", { mode: "number" }).notNull(),
    directoryId: bigint("directory_id", { mode: "number" }), // null = 项目根目录下的文件
    name: varchar("name", { length: 255 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    content: text("content").notNull().default(""),
    fileType: varchar("file_type", { length: 20 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull().default(0),
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
