import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import { agentWorkspaces, type AgentWorkspace } from "@/app/db/schema";

/**
 * Agent 工作空间 Repository。
 *
 * 工作空间是 Agent 的「上下文根」抽象，多态关联一类资源实体（当前仅 dbt_project）。
 * 所有查询均排除软删除，并按 userId 做数据隔离。
 */

/** 按 ID 查询工作空间（带 userId 归属校验，排除软删除） */
export async function findById(
  id: number,
  userId: number,
): Promise<AgentWorkspace | null> {
  const [row] = await db
    .select()
    .from(agentWorkspaces)
    .where(
      and(
        eq(agentWorkspaces.id, id),
        eq(agentWorkspaces.userId, userId),
        isNull(agentWorkspaces.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 按 (userId, type, refId) 查询活跃工作空间。
 *
 * 用于「打开某 dbt project 开聊」时复用已存在的 workspace。
 */
export async function findByUserAndRef(
  userId: number,
  type: string,
  refId: number,
): Promise<AgentWorkspace | null> {
  const [row] = await db
    .select()
    .from(agentWorkspaces)
    .where(
      and(
        eq(agentWorkspaces.userId, userId),
        eq(agentWorkspaces.type, type),
        eq(agentWorkspaces.refId, refId),
        isNull(agentWorkspaces.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 当前用户的工作空间列表（分页 + 排除软删除 + 倒序） */
export async function findList(options: {
  userId: number;
  limit: number;
  offset: number;
}) {
  const where = and(
    eq(agentWorkspaces.userId, options.userId),
    isNull(agentWorkspaces.deletedAt),
  );

  const [countRow] = await db
    .select({ total: count() })
    .from(agentWorkspaces)
    .where(where);

  const items = await db
    .select()
    .from(agentWorkspaces)
    .where(where)
    .orderBy(desc(agentWorkspaces.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/**
 * Upsert 工作空间：存在则复用（可同步 name 快照），不存在则创建。
 *
 * 用于「打开某资源（如 dbt project）开聊」时确保有对应 workspace。
 * 返回活跃的工作空间记录。
 */
export async function upsert(input: {
  userId: number;
  type: string;
  refId: number;
  name: string;
}): Promise<AgentWorkspace> {
  const existing = await findByUserAndRef(
    input.userId,
    input.type,
    input.refId,
  );

  if (existing) {
    // 同步 name 快照（资源可能已改名）
    if (existing.name !== input.name) {
      await db
        .update(agentWorkspaces)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(agentWorkspaces.id, existing.id));
      return (await findById(existing.id, input.userId)) as AgentWorkspace;
    }
    return existing;
  }

  const { id } = await insertReturningId(agentWorkspaces, {
    userId: input.userId,
    type: input.type,
    refId: input.refId,
    name: input.name,
  });
  return (await findById(id, input.userId)) as AgentWorkspace;
}
