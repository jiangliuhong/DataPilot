import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import {
  dbtRuntimeEnvironments,
  dbtVersions,
  dbtDatabaseConnections,
  type NewDbtRuntimeEnvironment,
} from "@/app/db/schema";

/** 创建运行环境 */
export async function createEnvironment(data: NewDbtRuntimeEnvironment) {
  const { id } = await insertReturningId(dbtRuntimeEnvironments, data);
  return findById(id);
}

/** 根据 ID 查询环境（含关联的版本和连接摘要） */
export async function findById(id: number) {
  const [row] = await db
    .select({
      id: dbtRuntimeEnvironments.id,
      name: dbtRuntimeEnvironments.name,
      versionId: dbtRuntimeEnvironments.versionId,
      connectionId: dbtRuntimeEnvironments.connectionId,
      status: dbtRuntimeEnvironments.status,
      initializationStatus: dbtRuntimeEnvironments.initializationStatus,
      venvPath: dbtRuntimeEnvironments.venvPath,
      initializedAt: dbtRuntimeEnvironments.initializedAt,
      lastErrorMessage: dbtRuntimeEnvironments.lastErrorMessage,
      createdAt: dbtRuntimeEnvironments.createdAt,
      updatedAt: dbtRuntimeEnvironments.updatedAt,
      deletedAt: dbtRuntimeEnvironments.deletedAt,
      versionName: dbtVersions.name,
      version: dbtVersions.version,
      connectionName: dbtDatabaseConnections.name,
      databaseType: dbtDatabaseConnections.databaseType,
    })
    .from(dbtRuntimeEnvironments)
    .innerJoin(
      dbtVersions,
      eq(dbtRuntimeEnvironments.versionId, dbtVersions.id),
    )
    .innerJoin(
      dbtDatabaseConnections,
      eq(dbtRuntimeEnvironments.connectionId, dbtDatabaseConnections.id),
    )
    .where(
      and(
        eq(dbtRuntimeEnvironments.id, id),
        isNull(dbtRuntimeEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 根据名称查询环境（排除软删除） */
export async function findByName(name: string) {
  const [row] = await db
    .select()
    .from(dbtRuntimeEnvironments)
    .where(
      and(
        eq(dbtRuntimeEnvironments.name, name),
        isNull(dbtRuntimeEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 环境列表（分页 + status 过滤） */
export async function findList(options: {
  limit: number;
  offset: number;
  status?: "active" | "inactive";
}) {
  const conditions = [isNull(dbtRuntimeEnvironments.deletedAt)];
  if (options.status) {
    conditions.push(eq(dbtRuntimeEnvironments.status, options.status));
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(dbtRuntimeEnvironments)
    .where(where);

  const items = await db
    .select({
      id: dbtRuntimeEnvironments.id,
      name: dbtRuntimeEnvironments.name,
      versionId: dbtRuntimeEnvironments.versionId,
      connectionId: dbtRuntimeEnvironments.connectionId,
      status: dbtRuntimeEnvironments.status,
      initializationStatus: dbtRuntimeEnvironments.initializationStatus,
      venvPath: dbtRuntimeEnvironments.venvPath,
      initializedAt: dbtRuntimeEnvironments.initializedAt,
      lastErrorMessage: dbtRuntimeEnvironments.lastErrorMessage,
      createdAt: dbtRuntimeEnvironments.createdAt,
      updatedAt: dbtRuntimeEnvironments.updatedAt,
      versionName: dbtVersions.name,
      version: dbtVersions.version,
      connectionName: dbtDatabaseConnections.name,
      databaseType: dbtDatabaseConnections.databaseType,
    })
    .from(dbtRuntimeEnvironments)
    .innerJoin(
      dbtVersions,
      eq(dbtRuntimeEnvironments.versionId, dbtVersions.id),
    )
    .innerJoin(
      dbtDatabaseConnections,
      eq(dbtRuntimeEnvironments.connectionId, dbtDatabaseConnections.id),
    )
    .where(where)
    .orderBy(desc(dbtRuntimeEnvironments.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 更新环境 */
export async function updateById(
  id: number,
  data: Partial<
    Pick<NewDbtRuntimeEnvironment, "name" | "versionId" | "connectionId" | "status">
  >,
) {
  await db
    .update(dbtRuntimeEnvironments)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(dbtRuntimeEnvironments.id, id),
        isNull(dbtRuntimeEnvironments.deletedAt),
      ),
    );
  return findById(id);
}

/** 更新初始化状态相关字段 */
export async function updateInitializationState(
  id: number,
  data: {
    status: "pending" | "running" | "initialized" | "failed";
    venvPath?: string | null;
    initializedAt?: Date | null;
    lastErrorMessage?: string | null;
  },
) {
  // 注意：data.status 对应表里的 initialization_status 列（schema 字段名 initializationStatus），
  // 不能与 active/inactive 的 status 列混淆，因此显式映射。
  await db
    .update(dbtRuntimeEnvironments)
    .set(
      {
        initializationStatus: data.status,
        venvPath: data.venvPath,
        initializedAt: data.initializedAt,
        lastErrorMessage: data.lastErrorMessage,
        updatedAt: new Date(),
      },
    )
    .where(
      and(
        eq(dbtRuntimeEnvironments.id, id),
        isNull(dbtRuntimeEnvironments.deletedAt),
      ),
    );
  return findById(id);
}

/** 轻量查询：仅取初始化状态（供并发检查使用） */
export async function findInitializationStatus(id: number) {
  const [row] = await db
    .select({
      id: dbtRuntimeEnvironments.id,
      initializationStatus: dbtRuntimeEnvironments.initializationStatus,
      venvPath: dbtRuntimeEnvironments.venvPath,
    })
    .from(dbtRuntimeEnvironments)
    .where(
      and(
        eq(dbtRuntimeEnvironments.id, id),
        isNull(dbtRuntimeEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 软删除环境 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtRuntimeEnvironments)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtRuntimeEnvironments.id, id));
}

/** 检查指定版本是否存在关联环境 */
export async function existsByVersionId(versionId: number) {
  const [row] = await db
    .select({ id: dbtRuntimeEnvironments.id })
    .from(dbtRuntimeEnvironments)
    .where(
      and(
        eq(dbtRuntimeEnvironments.versionId, versionId),
        isNull(dbtRuntimeEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return !!row;
}

/** 检查指定连接是否存在关联环境 */
export async function existsByConnectionId(connectionId: number) {
  const [row] = await db
    .select({ id: dbtRuntimeEnvironments.id })
    .from(dbtRuntimeEnvironments)
    .where(
      and(
        eq(dbtRuntimeEnvironments.connectionId, connectionId),
        isNull(dbtRuntimeEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return !!row;
}
