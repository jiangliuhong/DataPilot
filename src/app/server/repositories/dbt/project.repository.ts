import { eq, and, isNull, like, sql, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import { dbtProjects, type NewDbtProject } from "@/app/db/schema";

/** 创建项目 */
export async function createProject(data: NewDbtProject) {
  const { id } = await insertReturningId(dbtProjects, data);
  return findById(id);
}

/** 根据 ID 查询项目（排除软删除） */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(dbtProjects)
    .where(and(eq(dbtProjects.id, id), isNull(dbtProjects.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 根据名称查询项目（排除软删除） */
export async function findByName(name: string) {
  const [row] = await db
    .select()
    .from(dbtProjects)
    .where(and(eq(dbtProjects.name, name), isNull(dbtProjects.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 项目列表（分页 + 状态过滤） */
export async function findList(options: {
  limit: number;
  offset: number;
  status?: "active" | "archived";
}) {
  const conditions = [isNull(dbtProjects.deletedAt)];
  if (options.status) {
    conditions.push(eq(dbtProjects.status, options.status));
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(dbtProjects)
    .where(where);

  const items = await db
    .select()
    .from(dbtProjects)
    .where(where)
    .orderBy(desc(dbtProjects.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 更新项目 */
export async function updateById(
  id: number,
  data: Partial<Pick<NewDbtProject, "name" | "description" | "status">>,
) {
  await db
    .update(dbtProjects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dbtProjects.id, id), isNull(dbtProjects.deletedAt)));
  return findById(id);
}

/** 软删除项目 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtProjects)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtProjects.id, id));
}
