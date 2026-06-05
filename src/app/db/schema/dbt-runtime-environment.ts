import {
  mysqlTable,
  serial,
  varchar,
  bigint,
  timestamp,
  mysqlEnum,
  unique,
} from "drizzle-orm/mysql-core";
import { dbtVersions } from "./dbt-version";
import { dbtDatabaseConnections } from "./dbt-database-connection";

/** dbt 运行环境表 */
export const dbtRuntimeEnvironments = mysqlTable(
  "dbt_runtime_environments",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    versionId: bigint("version_id", { mode: "number" })
      .notNull()
      .references(() => dbtVersions.id, { onDelete: "cascade" }),
    connectionId: bigint("connection_id", { mode: "number" })
      .notNull()
      .references(() => dbtDatabaseConnections.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["active", "inactive"])
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    unique("dbt_runtime_environments_name_unique").on(table.name),
  ],
);

/** dbt_runtime_environments 插入类型 */
export type NewDbtRuntimeEnvironment =
  typeof dbtRuntimeEnvironments.$inferInsert;
/** dbt_runtime_environments 查询类型 */
export type DbtRuntimeEnvironment =
  typeof dbtRuntimeEnvironments.$inferSelect;
