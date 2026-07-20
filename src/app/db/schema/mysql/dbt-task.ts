import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  mysqlEnum,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/mysql-core";
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
export const dbtTasks = mysqlTable(
  "dbt_tasks",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    projectId: bigint("project_id", { mode: "number" }).notNull(),
    environmentId: bigint("environment_id", { mode: "number" }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    command: mysqlEnum("command", [...TASK_COMMANDS]).notNull(),
    select: text("select_arg"),
    exclude: text("exclude_arg"),
    fullRefresh: boolean("full_refresh").notNull().default(false),
    vars: text("vars_arg"),
    target: varchar("target_arg", { length: 255 }),
    scheduleCron: varchar("schedule_cron", { length: 100 }),
    scheduleStatus: mysqlEnum("schedule_status", ["disabled", "enabled"])
      .notNull()
      .default("disabled"),
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
