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

/** dbt 任务支持的命令枚举 */
export const TASK_COMMANDS = [
  "run",
  "build",
  "test",
  "compile",
  "seed",
  "snapshot",
] as const;

/** dbt 任务表 */
export const dbtTasks = sqliteTable(
  "dbt_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    environmentId: integer("environment_id").notNull(),
    name: text("name", { length: 255 }).notNull(),
    description: text("description"),
    command: text("command", { length: 20, enum: [...TASK_COMMANDS] }).notNull(),
    select: text("select_arg"),
    exclude: text("exclude_arg"),
    fullRefresh: integer("full_refresh", { mode: "boolean" })
      .notNull()
      .default(false),
    vars: text("vars_arg"),
    target: text("target_arg", { length: 255 }),
    scheduleCron: text("schedule_cron", { length: 100 }),
    scheduleStatus: text("schedule_status", {
      length: 10,
      enum: ["disabled", "enabled"],
    })
      .notNull()
      .default("disabled"),
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
      name: "task_project_fk",
    })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({
      columns: [table.environmentId],
      foreignColumns: [dbtRuntimeEnvironments.id],
      name: "task_environment_fk",
    })
      .onDelete("cascade")
      .onUpdate("no action"),
    uniqueIndex("dbt_tasks_project_name_unique").on(
      table.projectId,
      table.name,
    ),
  ],
);

/** dbt_tasks 插入类型 */
export type NewDbtTask = typeof dbtTasks.$inferInsert;
/** dbt_tasks 查询类型 */
export type DbtTask = typeof dbtTasks.$inferSelect;
