import { eq, and, isNull, like, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import { dbtFiles, type NewDbtFile } from "@/app/db/schema";

/** 创建文件 */
export async function create(data: NewDbtFile) {
  const { id } = await insertReturningId(dbtFiles, data);
  return findById(id);
}

/** 检查同目录下是否存在同名文件 */
export async function existsByName(projectId: number, name: string, directoryId: number | null) {
  const conditions = [
    eq(dbtFiles.projectId, projectId),
    eq(dbtFiles.name, name),
    isNull(dbtFiles.deletedAt),
  ];
  if (directoryId === null) {
    conditions.push(isNull(dbtFiles.directoryId));
  } else {
    conditions.push(eq(dbtFiles.directoryId, directoryId));
  }
  const [row] = await db
    .select({ id: dbtFiles.id })
    .from(dbtFiles)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

/** 根据 ID 查询文件（排除软删除） */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(dbtFiles)
    .where(and(eq(dbtFiles.id, id), isNull(dbtFiles.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 项目下文件列表（分页 + 类型过滤，不含 content） */
export async function findByProjectId(options: {
  projectId: number;
  limit: number;
  offset: number;
  fileType?: string;
  directoryId?: number;
}) {
  const conditions = [
    eq(dbtFiles.projectId, options.projectId),
    isNull(dbtFiles.deletedAt),
  ];
  if (options.fileType) {
    conditions.push(eq(dbtFiles.fileType, options.fileType));
  }
  if (options.directoryId !== undefined) {
    conditions.push(eq(dbtFiles.directoryId, options.directoryId));
  }

  const where = and(...conditions);

  const [countRow] = await db.select({ total: count() }).from(dbtFiles).where(where);

  // 列表查询不含 content 字段，避免传输大量文件内容
  const items = await db
    .select({
      id: dbtFiles.id,
      projectId: dbtFiles.projectId,
      directoryId: dbtFiles.directoryId,
      name: dbtFiles.name,
      path: dbtFiles.path,
      fileType: dbtFiles.fileType,
      size: dbtFiles.size,
      createdAt: dbtFiles.createdAt,
      updatedAt: dbtFiles.updatedAt,
    })
    .from(dbtFiles)
    .where(where)
    .orderBy(desc(dbtFiles.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 查询指定目录下的文件（不含子目录） */
export async function findByDirectoryId(directoryId: number) {
  return db
    .select()
    .from(dbtFiles)
    .where(and(eq(dbtFiles.directoryId, directoryId), isNull(dbtFiles.deletedAt)));
}

/** 查询项目下所有文件（含 content，用于导出） */
export async function findAllByProjectId(projectId: number) {
  return db
    .select()
    .from(dbtFiles)
    .where(
      and(eq(dbtFiles.projectId, projectId), isNull(dbtFiles.deletedAt)),
    );
}

/** 更新文件 */
export async function updateById(
  id: number,
  data: Partial<Pick<NewDbtFile, "name" | "content" | "fileType" | "size" | "directoryId" | "path">>,
) {
  await db
    .update(dbtFiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dbtFiles.id, id), isNull(dbtFiles.deletedAt)));
  return findById(id);
}

/** 软删除文件 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtFiles)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtFiles.id, id));
}

/** 按路径前缀批量软删除文件（目录级联删除时使用） */
export async function softDeleteByPathPrefix(projectId: number, pathPrefix: string) {
  const now = new Date();
  await db
    .update(dbtFiles)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtFiles.projectId, projectId),
        like(dbtFiles.path, `${pathPrefix}%`),
      ),
    );
}

/** 按目录 ID 列表批量软删除文件 */
export async function softDeleteByDirectoryIds(projectId: number, directoryIds: number[]) {
  if (directoryIds.length === 0) return;
  const now = new Date();
  // 使用 inArray 批量匹配
  const { inArray } = await import("drizzle-orm");
  await db
    .update(dbtFiles)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtFiles.projectId, projectId),
        inArray(dbtFiles.directoryId, directoryIds),
      ),
    );
}

/** 软删除项目下所有文件 */
export async function softDeleteByProjectId(projectId: number) {
  const now = new Date();
  await db
    .update(dbtFiles)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtFiles.projectId, projectId),
        isNull(dbtFiles.deletedAt),
      ),
    );
}
