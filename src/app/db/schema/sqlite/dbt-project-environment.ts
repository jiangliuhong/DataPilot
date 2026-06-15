import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { dbtProjects } from "./dbt-project";
import { dbtRuntimeEnvironments } from "./dbt-runtime-environment";

/** dbt 项目环境绑定表 */
export const dbtProjectEnvironments = sqliteTable(
  "dbt_project_environments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    environmentId: integer("environment_id").notNull(),
    environmentAlias: text("environment_alias", { length: 255 }),
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
