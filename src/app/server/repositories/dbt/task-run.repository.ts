import { eq, and, lte, count, desc, inArray } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import {
  dbtTaskRuns,
  type NewDbtTaskRun,
} from "@/app/db/schema";

/** 任务运行记录状态 */
export type TaskRunStatus = NewDbtTaskRun["status"];

/** 创建运行记录（初始状态 queued） */
export async function createRun(data: NewDbtTaskRun) {
  const { id } = await insertReturningId(dbtTaskRuns, data);
  return findRunById(id);
}

/** 根据 ID 查询运行记录 */
export async function findRunById(id: number) {
  const [row] = await db
    .select()
    .from(dbtTaskRuns)
    .where(eq(dbtTaskRuns.id, id))
    .limit(1);
  return row ?? null;
}

/** 查询某任务的活跃运行（status 为 queued 或 running）—— 用于并发检测 */
export async function findActiveRunOfTask(taskId: number) {
  const [row] = await db
    .select()
    .from(dbtTaskRuns)
    .where(
      and(
        eq(dbtTaskRuns.taskId, taskId),
        inArray(dbtTaskRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 某任务的运行记录列表（分页 + status 过滤，按 startedAt 倒序） */
export async function findRunsByTask(options: {
  taskId: number;
  limit: number;
  offset: number;
  status?: TaskRunStatus;
}) {
  const conditions = [eq(dbtTaskRuns.taskId, options.taskId)];
  if (options.status) {
    conditions.push(eq(dbtTaskRuns.status, options.status));
  }
  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(dbtTaskRuns)
    .where(where);

  const items = await db
    .select()
    .from(dbtTaskRuns)
    .where(where)
    .orderBy(desc(dbtTaskRuns.startedAt), desc(dbtTaskRuns.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 查询超过阈值仍处于活跃状态（queued 或 running）的运行记录（用于僵尸记录修正）。
 *  - running 行按 startedAt 判定年龄（正常进入 running 时回填）
 *  - queued 行按 createdAt 判定年龄（queued 状态下 startedAt 为 null，
 *    若进程在 queued→running 之间崩溃，该行永远不会进入 running，
 *    必须用 createdAt 才能被清理——否则任务会被 findActiveRunOfTask 永久阻塞）
 *  限制单次最多 100 条，避免大量积压时一次性载入内存（W10）。 */
export async function findStaleActive(thresholdDate: Date) {
  return db
    .select()
    .from(dbtTaskRuns)
    .where(
      and(
        inArray(dbtTaskRuns.status, ["queued", "running"]),
        lte(dbtTaskRuns.createdAt, thresholdDate),
      ),
    )
    .limit(100);
}

/** 更新运行记录状态 */
export async function updateRun(
  id: number,
  data: Partial<
    Pick<
      NewDbtTaskRun,
      "status" | "exitCode" | "errorMessage" | "startedAt" | "finishedAt"
    >
  >,
) {
  await db
    .update(dbtTaskRuns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(dbtTaskRuns.id, id));
  return findRunById(id);
}

/** 批量更新运行记录状态（僵尸记录修正用）。
 *  where 限定 status in (queued, running)，避免在 find 与 update 之间
 *  被其他路径置为终态的记录被误改（S2），同时覆盖卡在 queued 的僵尸行。 */
export async function updateStatusByIds(
  ids: number[],
  data: Partial<
    Pick<
      NewDbtTaskRun,
      "status" | "exitCode" | "errorMessage" | "finishedAt"
    >
  >,
) {
  if (ids.length === 0) return;
  await db
    .update(dbtTaskRuns)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        inArray(dbtTaskRuns.id, ids),
        inArray(dbtTaskRuns.status, ["queued", "running"]),
      ),
    );
}
