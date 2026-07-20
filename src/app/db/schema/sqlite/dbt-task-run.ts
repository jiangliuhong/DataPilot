import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { dbtTasks } from "./dbt-task";

/** dbt 任务运行状态枚举 */
export const TASK_RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
] as const;

/** dbt 任务运行记录表 */
export const dbtTaskRuns = sqliteTable(
  "dbt_task_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull(),
    status: text("status", { length: 12, enum: [...TASK_RUN_STATUSES] })
      .notNull()
      .default("queued"),
    exitCode: integer("exit_code"),
    errorMessage: text("error_message"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [dbtTasks.id],
      name: "task_run_task_fk",
    })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

/** dbt_task_runs 插入类型 */
export type NewDbtTaskRun = typeof dbtTaskRuns.$inferInsert;
/** dbt_task_runs 查询类型 */
export type DbtTaskRun = typeof dbtTaskRuns.$inferSelect;
