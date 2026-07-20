import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import {
  dbtTasks,
  dbtRuntimeEnvironments,
  dbtDatabaseConnections,
  type NewDbtTask,
} from "@/app/db/schema";

/** 任务列表返回的连接摘要（JOIN 环境、连接） */
export type TaskWithSummary = Awaited<ReturnType<typeof findList>>["items"][number];

/** 创建任务 */
export async function createTask(data: NewDbtTask) {
  const { id } = await insertReturningId(dbtTasks, data);
  return findById(id);
}

/** 根据 ID 查询任务（排除软删除） */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(dbtTasks)
    .where(and(eq(dbtTasks.id, id), isNull(dbtTasks.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 按项目 + 名称查任务（用于项目内唯一性校验） */
export async function findByNameInProject(projectId: number, name: string) {
  const [row] = await db
    .select()
    .from(dbtTasks)
    .where(
      and(
        eq(dbtTasks.projectId, projectId),
        eq(dbtTasks.name, name),
        isNull(dbtTasks.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 任务列表（分页 + projectId/environmentId/command 过滤，含环境与连接摘要） */
export async function findList(options: {
  limit: number;
  offset: number;
  projectId?: number;
  environmentId?: number;
  command?: string;
}) {
  const conditions = [isNull(dbtTasks.deletedAt)];
  if (options.projectId !== undefined) {
    conditions.push(eq(dbtTasks.projectId, options.projectId));
  }
  if (options.environmentId !== undefined) {
    conditions.push(eq(dbtTasks.environmentId, options.environmentId));
  }
  if (options.command) {
    conditions.push(eq(dbtTasks.command, options.command as NewDbtTask["command"]));
  }

  const where = and(...conditions);

  const [countRow] = await db.select({ total: count() }).from(dbtTasks).where(where);

  const items = await db
    .select({
      id: dbtTasks.id,
      projectId: dbtTasks.projectId,
      environmentId: dbtTasks.environmentId,
      name: dbtTasks.name,
      description: dbtTasks.description,
      command: dbtTasks.command,
      select: dbtTasks.select,
      exclude: dbtTasks.exclude,
      fullRefresh: dbtTasks.fullRefresh,
      vars: dbtTasks.vars,
      target: dbtTasks.target,
      scheduleCron: dbtTasks.scheduleCron,
      scheduleStatus: dbtTasks.scheduleStatus,
      createdAt: dbtTasks.createdAt,
      updatedAt: dbtTasks.updatedAt,
      environmentName: dbtRuntimeEnvironments.name,
      environmentStatus: dbtRuntimeEnvironments.status,
      initializationStatus: dbtRuntimeEnvironments.initializationStatus,
      connectionId: dbtRuntimeEnvironments.connectionId,
      connectionName: dbtDatabaseConnections.name,
      databaseType: dbtDatabaseConnections.databaseType,
    })
    .from(dbtTasks)
    .innerJoin(
      dbtRuntimeEnvironments,
      eq(dbtTasks.environmentId, dbtRuntimeEnvironments.id),
    )
    .innerJoin(
      dbtDatabaseConnections,
      eq(dbtRuntimeEnvironments.connectionId, dbtDatabaseConnections.id),
    )
    .where(where)
    .orderBy(desc(dbtTasks.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 更新任务（仅允许变更业务字段） */
export async function updateById(
  id: number,
  data: Partial<
    Pick<
      NewDbtTask,
      | "name"
      | "description"
      | "environmentId"
      | "command"
      | "select"
      | "exclude"
      | "fullRefresh"
      | "vars"
      | "target"
    >
  >,
) {
  await db
    .update(dbtTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dbtTasks.id, id), isNull(dbtTasks.deletedAt)));
  return findById(id);
}

/** 软删除任务 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtTasks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtTasks.id, id));
}
