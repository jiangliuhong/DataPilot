import {
  mysqlTable,
  bigint,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  unique,
} from "drizzle-orm/mysql-core";

/** dbt 项目表 */
export const dbtProjects = mysqlTable(
  "dbt_projects",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["active", "archived"])
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [unique("dbt_projects_name_unique").on(table.name)],
);

/** dbt_projects 插入类型 */
export type NewDbtProject = typeof dbtProjects.$inferInsert;
/** dbt_projects 查询类型 */
export type DbtProject = typeof dbtProjects.$inferSelect;
