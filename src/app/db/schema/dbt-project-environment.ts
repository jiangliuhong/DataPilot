import {
  mysqlTable,
  serial,
  varchar,
  bigint,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { dbtProjects } from "./dbt-project";
import { dbtRuntimeEnvironments } from "./dbt-runtime-environment";

/** dbt 项目环境绑定表 */
export const dbtProjectEnvironments = mysqlTable(
  "dbt_project_environments",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number" })
      .notNull()
      .references(() => dbtProjects.id, { onDelete: "cascade" }),
    environmentId: bigint("environment_id", { mode: "number" })
      .notNull()
      .references(() => dbtRuntimeEnvironments.id, { onDelete: "cascade" }),
    environmentAlias: varchar("environment_alias", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    uniqueIndex("dbt_project_environments_unique").on(
      table.projectId,
      table.environmentId,
    ),
  ],
);

/** dbt_project_environments 插入类型 */
export type NewDbtProjectEnvironment =
  typeof dbtProjectEnvironments.$inferInsert;
/** dbt_project_environments 查询类型 */
export type DbtProjectEnvironment =
  typeof dbtProjectEnvironments.$inferSelect;
