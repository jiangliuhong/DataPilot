import {
  mysqlTable,
  bigint,
  text,
  timestamp,
  mysqlEnum,
  foreignKey,
} from "drizzle-orm/mysql-core";
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
export const dbtTaskRuns = mysqlTable(
  "dbt_task_runs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    taskId: bigint("task_id", { mode: "number" }).notNull(),
    status: mysqlEnum("status", [...TASK_RUN_STATUSES])
      .notNull()
      .default("queued"),
    exitCode: bigint("exit_code", { mode: "number" }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
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
