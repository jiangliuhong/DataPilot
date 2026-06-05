import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db } from "@/app/db";
import { dbtVersions, type NewDbtVersion } from "@/app/db/schema/dbt-version";

/** 创建版本 */
export async function createVersion(data: NewDbtVersion) {
  const [result] = await db.insert(dbtVersions).values(data).$returningId();
  return findById(result.id);
}

/** 根据 ID 查询版本（排除软删除） */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(dbtVersions)
    .where(and(eq(dbtVersions.id, id), isNull(dbtVersions.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 根据名称查询版本（排除软删除） */
export async function findByName(name: string) {
  const [row] = await db
    .select()
    .from(dbtVersions)
    .where(and(eq(dbtVersions.name, name), isNull(dbtVersions.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 版本列表（分页 + version/status 过滤） */
export async function findList(options: {
  limit: number;
  offset: number;
  version?: string;
  status?: "active" | "inactive";
}) {
  const conditions = [isNull(dbtVersions.deletedAt)];
  if (options.version) {
    conditions.push(eq(dbtVersions.version, options.version));
  }
  if (options.status) {
    conditions.push(eq(dbtVersions.status, options.status));
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(dbtVersions)
    .where(where);

  const items = await db
    .select()
    .from(dbtVersions)
    .where(where)
    .orderBy(desc(dbtVersions.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 更新版本 */
export async function updateById(
  id: number,
  data: Partial<
    Pick<
      NewDbtVersion,
      "name" | "version" | "adapterPackages" | "dependencies" | "status"
    >
  >,
) {
  await db
    .update(dbtVersions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dbtVersions.id, id), isNull(dbtVersions.deletedAt)));
  return findById(id);
}

/** 软删除版本 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtVersions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtVersions.id, id));
}
