import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  unique,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { dbtVersions } from "./dbt-version";
import { dbtDatabaseConnections } from "./dbt-database-connection";

/** dbt 运行环境表 */
export const dbtRuntimeEnvironments = sqliteTable(
  "dbt_runtime_environments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name", { length: 255 }).notNull(),
    versionId: integer("version_id").notNull(),
    connectionId: integer("connection_id").notNull(),
    status: text("status", { length: 8, enum: ["active", "inactive"] })
      .notNull()
      .default("active"),
    initializationStatus: text("initialization_status", {
      length: 20,
      enum: ["pending", "running", "initialized", "failed"],
    })
      .notNull()
      .default("pending"),
    venvPath: text("venv_path", { length: 512 }),
    initializedAt: integer("initialized_at", { mode: "timestamp" }),
    lastErrorMessage: text("last_error_message"),
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
      columns: [table.versionId],
      foreignColumns: [dbtVersions.id],
      name: "runtime_env_version_fk",
    })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({
      columns: [table.connectionId],
      foreignColumns: [dbtDatabaseConnections.id],
      name: "runtime_env_connection_fk",
    })
      .onDelete("cascade")
      .onUpdate("no action"),
    unique("dbt_runtime_environments_name_unique").on(table.name),
  ],
);

/** dbt_runtime_environments 插入类型 */
export type NewDbtRuntimeEnvironment =
  typeof dbtRuntimeEnvironments.$inferInsert;
/** dbt_runtime_environments 查询类型 */
export type DbtRuntimeEnvironment =
  typeof dbtRuntimeEnvironments.$inferSelect;
