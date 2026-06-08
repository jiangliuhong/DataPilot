import {
  mysqlTable,
  bigint,
  varchar,
  timestamp,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/mysql-core";
import { dbtProjects } from "./dbt-project";
import { dbtRuntimeEnvironments } from "./dbt-runtime-environment";

/** dbt 项目环境绑定表 */
export const dbtProjectEnvironments = mysqlTable(
  "dbt_project_environments",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    projectId: bigint("project_id", { mode: "number" }).notNull(),
    environmentId: bigint("environment_id", { mode: "number" }).notNull(),
    environmentAlias: varchar("environment_alias", { length: 255 }),
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
      name: "project_env_project_fk",
    })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({
      columns: [table.environmentId],
      foreignColumns: [dbtRuntimeEnvironments.id],
      name: "project_env_environment_fk",
    })
      .onDelete("cascade")
      .onUpdate("no action"),
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
