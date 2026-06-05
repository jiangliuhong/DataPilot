import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db } from "@/app/db";
import {
  dbtProjectEnvironments,
  type NewDbtProjectEnvironment,
} from "@/app/db/schema/dbt-project-environment";
import { dbtRuntimeEnvironments } from "@/app/db/schema/dbt-runtime-environment";
import { dbtVersions } from "@/app/db/schema/dbt-version";
import { dbtDatabaseConnections } from "@/app/db/schema/dbt-database-connection";

/** 创建绑定 */
export async function createBinding(data: NewDbtProjectEnvironment) {
  const [result] = await db
    .insert(dbtProjectEnvironments)
    .values(data)
    .$returningId();
  return findById(result.id);
}

/** 根据 ID 查询绑定 */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(dbtProjectEnvironments)
    .where(
      and(
        eq(dbtProjectEnvironments.id, id),
        isNull(dbtProjectEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 按 projectId + environmentId 查询绑定（查重用） */
export async function findBinding(projectId: number, environmentId: number) {
  const [row] = await db
    .select()
    .from(dbtProjectEnvironments)
    .where(
      and(
        eq(dbtProjectEnvironments.projectId, projectId),
        eq(dbtProjectEnvironments.environmentId, environmentId),
        isNull(dbtProjectEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 查询项目下绑定的环境列表（含环境详情） */
export async function findListByProjectId(options: {
  projectId: number;
  limit: number;
  offset: number;
}) {
  const conditions = [
    eq(dbtProjectEnvironments.projectId, options.projectId),
    isNull(dbtProjectEnvironments.deletedAt),
  ];
  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(dbtProjectEnvironments)
    .where(where);

  const items = await db
    .select({
      id: dbtProjectEnvironments.id,
      projectId: dbtProjectEnvironments.projectId,
      environmentId: dbtProjectEnvironments.environmentId,
      environmentAlias: dbtProjectEnvironments.environmentAlias,
      createdAt: dbtProjectEnvironments.createdAt,
      updatedAt: dbtProjectEnvironments.updatedAt,
      environmentName: dbtRuntimeEnvironments.name,
      environmentStatus: dbtRuntimeEnvironments.status,
      versionId: dbtRuntimeEnvironments.versionId,
      connectionId: dbtRuntimeEnvironments.connectionId,
      versionName: dbtVersions.name,
      version: dbtVersions.version,
      connectionName: dbtDatabaseConnections.name,
      databaseType: dbtDatabaseConnections.databaseType,
    })
    .from(dbtProjectEnvironments)
    .innerJoin(
      dbtRuntimeEnvironments,
      eq(dbtProjectEnvironments.environmentId, dbtRuntimeEnvironments.id),
    )
    .innerJoin(
      dbtVersions,
      eq(dbtRuntimeEnvironments.versionId, dbtVersions.id),
    )
    .innerJoin(
      dbtDatabaseConnections,
      eq(dbtRuntimeEnvironments.connectionId, dbtDatabaseConnections.id),
    )
    .where(where)
    .orderBy(desc(dbtProjectEnvironments.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 软删除绑定 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtProjectEnvironments)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtProjectEnvironments.id, id));
}

/** 检查指定环境是否存在项目绑定 */
export async function existsByEnvironmentId(environmentId: number) {
  const [row] = await db
    .select({ id: dbtProjectEnvironments.id })
    .from(dbtProjectEnvironments)
    .where(
      and(
        eq(dbtProjectEnvironments.environmentId, environmentId),
        isNull(dbtProjectEnvironments.deletedAt),
      ),
    )
    .limit(1);
  return !!row;
}
