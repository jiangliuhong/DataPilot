import { eq, and, isNull, like, sql } from "drizzle-orm";
import { db } from "@/app/db";
import {
  dbtDirectories,
  type NewDbtDirectory,
} from "@/app/db/schema/dbt-directory";

/** 创建目录 */
export async function create(data: NewDbtDirectory) {
  const [result] = await db.insert(dbtDirectories).values(data).$returningId();
  return findById(result.id);
}

/** 检查同父目录下是否存在同名目录 */
export async function existsByName(projectId: number, name: string, parentId: number | null) {
  const conditions = [
    eq(dbtDirectories.projectId, projectId),
    eq(dbtDirectories.name, name),
    isNull(dbtDirectories.deletedAt),
  ];
  if (parentId === null) {
    conditions.push(isNull(dbtDirectories.parentId));
  } else {
    conditions.push(eq(dbtDirectories.parentId, parentId));
  }
  const [row] = await db
    .select({ id: dbtDirectories.id })
    .from(dbtDirectories)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

/** 根据 ID 查询目录（排除软删除） */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(dbtDirectories)
    .where(and(eq(dbtDirectories.id, id), isNull(dbtDirectories.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 查询项目下所有目录（排除软删除） */
export async function findByProjectId(projectId: number) {
  return db
    .select()
    .from(dbtDirectories)
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        isNull(dbtDirectories.deletedAt),
      ),
    )
    .orderBy(dbtDirectories.depth, dbtDirectories.sortOrder, dbtDirectories.name);
}

/** 查询指定父目录下的直接子目录 */
export async function findByParentId(projectId: number, parentId: number | null) {
  const parentCondition =
    parentId === null
      ? isNull(dbtDirectories.parentId)
      : eq(dbtDirectories.parentId, parentId);

  return db
    .select()
    .from(dbtDirectories)
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        parentCondition,
        isNull(dbtDirectories.deletedAt),
      ),
    )
    .orderBy(dbtDirectories.sortOrder, dbtDirectories.name);
}

/** 更新目录 */
export async function updateById(
  id: number,
  data: Partial<Pick<NewDbtDirectory, "name" | "parentId" | "path" | "depth" | "sortOrder">>,
) {
  await db
    .update(dbtDirectories)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dbtDirectories.id, id), isNull(dbtDirectories.deletedAt)));
  return findById(id);
}

/** 软删除目录 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtDirectories)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtDirectories.id, id));
}

/** 按路径前缀批量软删除（级联删除子目录） */
export async function softDeleteByPathPrefix(projectId: number, pathPrefix: string) {
  const now = new Date();
  await db
    .update(dbtDirectories)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        like(dbtDirectories.path, `${pathPrefix}%`),
      ),
    );
}

/** 按路径前缀查询所有目录（用于移动时级联更新） */
export async function findByPathPrefix(projectId: number, pathPrefix: string) {
  return db
    .select()
    .from(dbtDirectories)
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        like(dbtDirectories.path, `${pathPrefix}%`),
        isNull(dbtDirectories.deletedAt),
      ),
    );
}

/** 软删除项目下所有目录 */
export async function softDeleteByProjectId(projectId: number) {
  const now = new Date();
  await db
    .update(dbtDirectories)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        isNull(dbtDirectories.deletedAt),
      ),
    );
}
