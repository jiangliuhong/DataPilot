import { eq, and, isNull, like, sql } from "drizzle-orm";
import { db, insertReturningId, type DbClient } from "@/app/db";
import {
  dbtDirectories,
  type NewDbtDirectory,
} from "@/app/db/schema";

/** 创建目录 */
export async function create(data: NewDbtDirectory, tx?: DbClient) {
  const { id } = await insertReturningId(dbtDirectories, data, tx);
  return findById(id);
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
  tx?: DbClient,
) {
  const client = tx ?? db;
  await client
    .update(dbtDirectories)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dbtDirectories.id, id), isNull(dbtDirectories.deletedAt)));
  return findById(id);
}

/** 软删除目录 */
export async function softDeleteById(id: number, tx?: DbClient) {
  const client = tx ?? db;
  const now = new Date();
  await client
    .update(dbtDirectories)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtDirectories.id, id));
}

/** 按路径前缀批量软删除（级联删除子目录） */
export async function softDeleteByPathPrefix(projectId: number, pathPrefix: string, tx?: DbClient) {
  const client = tx ?? db;
  const now = new Date();
  await client
    .update(dbtDirectories)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        like(dbtDirectories.path, `${pathPrefix}%`),
      ),
    );
}

/** 按路径前缀查询所有目录（用于移动时级联更新 / 导入时查找父目录） */
export async function findByPathPrefix(projectId: number, pathPrefix: string, tx?: DbClient) {
  const client = tx ?? db;
  return client
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
export async function softDeleteByProjectId(projectId: number, tx?: DbClient) {
  const client = tx ?? db;
  const now = new Date();
  await client
    .update(dbtDirectories)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        isNull(dbtDirectories.deletedAt),
      ),
    );
}

// ===========================================================================
// 以下方法供 deepagents DbProjectBackend 使用（按路径寻址，而非 directoryId）
// ===========================================================================

/** 按完整路径精确查询目录（排除软删除）。path 形如 "models/staging"。 */
export async function findByPath(projectId: number, path: string) {
  const [row] = await db
    .select()
    .from(dbtDirectories)
    .where(
      and(
        eq(dbtDirectories.projectId, projectId),
        eq(dbtDirectories.path, path),
        isNull(dbtDirectories.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 等价于 `mkdir -p`：沿 segments 逐级查找/创建目录，返回最末级 directoryId。
 *
 * - segments = [] 或 [""] → 返回 null（项目根）
 * - segments = ["models","staging"] → 确保 models 及 models/staging 存在，返回后者的 id
 *
 * 物化路径与 depth 参考现有 directory.service.createDirectory 的计算方式：
 *   根级目录 path=name, depth=0；子级 path=`${parent.path}/${name}`, depth=parent.depth+1。
 *
 * 注意：本方法不做循环检测（调用方保证 segments 是干净的路径段）。
 */
export async function ensurePath(
  projectId: number,
  segments: string[],
): Promise<number | null> {
  const clean = segments.filter((s) => s.length > 0);
  if (clean.length === 0) return null;

  let parentId: number | null = null;
  let parentPath = "";
  let parentDepth = -1;

  for (const name of clean) {
    const path = parentPath === "" ? name : `${parentPath}/${name}`;
    const depth = parentDepth + 1;

    // 先查（同父目录下同名 + 未软删）
    let dir = await findByPath(projectId, path);

    if (!dir) {
      // 不存在则创建（参考 createDirectory 的字段计算）
      const created = await create({
        projectId,
        parentId,
        name,
        path,
        depth,
        sortOrder: 0,
      });
      dir = created;
    }

    if (!dir) {
      throw new Error(`ensurePath 失败：无法创建目录 ${path}`);
    }
    parentId = dir.id;
    parentPath = path;
    parentDepth = depth;
  }

  return parentId;
}
