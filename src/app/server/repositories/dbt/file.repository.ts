import path from "node:path";
import { eq, and, isNull, like, count, desc } from "drizzle-orm";
import { db, insertReturningId, type DbClient } from "@/app/db";
import { dbtFiles, type NewDbtFile } from "@/app/db/schema";
import * as directoryRepo from "@/app/server/repositories/dbt/directory.repository";

/** 创建文件 */
export async function create(data: NewDbtFile, tx?: DbClient) {
  const { id } = await insertReturningId(dbtFiles, data, tx);
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
  // undefined = 不过滤目录；null = 仅根目录；number = 指定目录
  directoryId?: number | null;
}) {
  const conditions = [
    eq(dbtFiles.projectId, options.projectId),
    isNull(dbtFiles.deletedAt),
  ];
  if (options.fileType) {
    conditions.push(eq(dbtFiles.fileType, options.fileType));
  }
  if (options.directoryId !== undefined) {
    // null 表示「项目根目录」(directory_id IS NULL)；
    // 正整数表示具体某个目录下的文件。
    conditions.push(
      options.directoryId === null
        ? isNull(dbtFiles.directoryId)
        : eq(dbtFiles.directoryId, options.directoryId),
    );
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
  tx?: DbClient,
) {
  const client = tx ?? db;
  await client
    .update(dbtFiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dbtFiles.id, id), isNull(dbtFiles.deletedAt)));
  return findById(id);
}

/** 软删除文件 */
export async function softDeleteById(id: number, tx?: DbClient) {
  const client = tx ?? db;
  const now = new Date();
  await client
    .update(dbtFiles)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtFiles.id, id));
}

/** 按路径前缀批量软删除文件（目录级联删除时使用） */
export async function softDeleteByPathPrefix(projectId: number, pathPrefix: string, tx?: DbClient) {
  const client = tx ?? db;
  const now = new Date();
  await client
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
export async function softDeleteByProjectId(projectId: number, tx?: DbClient) {
  const client = tx ?? db;
  const now = new Date();
  await client
    .update(dbtFiles)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtFiles.projectId, projectId),
        isNull(dbtFiles.deletedAt),
      ),
    );
}

// ===========================================================================
// 以下方法供 deepagents DbProjectBackend 使用（按路径寻址，而非 fileId）
// ===========================================================================

/**
 * 按 (projectId, path) 精确查询文件（排除软删除）。
 * path 形如 "models/staging/orders.sql"（与 dbt_files.path 列一致，无前导 /）。
 */
export async function findByProjectAndPath(projectId: number, filePath: string) {
  const [row] = await db
    .select()
    .from(dbtFiles)
    .where(
      and(
        eq(dbtFiles.projectId, projectId),
        eq(dbtFiles.path, filePath),
        isNull(dbtFiles.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 按 path 写文件（存在则更新内容，不存在则创建）。
 *
 * 自动建立所需的父目录（mkdir -p 语义）。计算逻辑参考 file.service.createFile：
 *   - 根级文件 path=name，directoryId=null
 *   - 子目录文件 path=`${dir.path}/${name}`
 *   - size = Buffer.byteLength(content, "utf-8")
 *
 * fileType 由调用方传入（通常按扩展名推断）。
 */
export async function upsertByPath(input: {
  projectId: number;
  /** DB 路径，无前导 /，如 "models/staging/orders.sql" */
  path: string;
  content: string;
  /** 文件类型（按扩展名推断），新建时必填，更新时忽略 */
  fileType: string;
}) {
  const dir = path.posix.dirname(input.path);
  const name = path.posix.basename(input.path);
  // dirname 对 "a.sql" 返回 "."，对 "/" 返回 "/"；需归一化为段数组
  const dirSegments =
    dir === "." || dir === "/" ? [] : dir.split("/").filter(Boolean);

  const directoryId = await directoryRepo.ensurePath(input.projectId, dirSegments);

  // 按 path 精确判断存在性（与后续 update 用同一把键，避免 name+directoryId
  // 与 path 不一致时更新到错误文件）。path 是业务唯一键。
  const existing = await findByProjectAndPath(input.projectId, input.path);
  if (existing) {
    return updateByPath(input.projectId, input.path, input.content);
  }

  // 不存在则创建
  const created = await create({
    projectId: input.projectId,
    directoryId,
    name,
    path: input.path,
    content: input.content,
    fileType: input.fileType,
    size: Buffer.byteLength(input.content, "utf-8"),
  });
  return created;
}

/**
 * 按 path 更新文件内容（重新计算 size，刷新 updatedAt）。
 * 仅更新 content/size，不改 name/fileType/directoryId。
 */
export async function updateByPath(
  projectId: number,
  filePath: string,
  content: string,
  tx?: DbClient,
) {
  const client = tx ?? db;
  await client
    .update(dbtFiles)
    .set({
      content,
      size: Buffer.byteLength(content, "utf-8"),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dbtFiles.projectId, projectId),
        eq(dbtFiles.path, filePath),
        isNull(dbtFiles.deletedAt),
      ),
    );
  return findByProjectAndPath(projectId, filePath);
}
