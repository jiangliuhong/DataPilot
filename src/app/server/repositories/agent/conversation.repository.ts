import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import { agentConversations, type AgentConversation } from "@/app/db/schema";

/** 创建会话（归属当前用户 + 指定 workspace） */
export async function create(input: {
  userId: number;
  workspaceId: number;
  title?: string;
}): Promise<AgentConversation> {
  const { id } = await insertReturningId(agentConversations, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    title: input.title ?? "新对话",
  });
  const created = await findById(id, input.userId);
  // 刚插入的记录必然存在
  return created as AgentConversation;
}

/**
 * 根据 ID 查询会话（带 userId 归属校验，排除软删除）。
 *
 * 越权访问（会话不属于该 userId）与"不存在"无差异，均返回 null，防止探测。
 */
export async function findById(
  id: number,
  userId: number,
): Promise<AgentConversation | null> {
  const [row] = await db
    .select()
    .from(agentConversations)
    .where(
      and(
        eq(agentConversations.id, id),
        eq(agentConversations.userId, userId),
        isNull(agentConversations.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 当前用户的会话列表（分页 + 排除软删除 + 倒序） */
export async function findList(options: {
  userId: number;
  limit: number;
  offset: number;
}) {
  const where = and(
    eq(agentConversations.userId, options.userId),
    isNull(agentConversations.deletedAt),
  );

  const [countRow] = await db
    .select({ total: count() })
    .from(agentConversations)
    .where(where);

  const items = await db
    .select()
    .from(agentConversations)
    .where(where)
    .orderBy(desc(agentConversations.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 更新会话标题（带 userId 归属校验）；不属于该用户则返回 null */
export async function updateTitle(
  id: number,
  userId: number,
  title: string,
): Promise<AgentConversation | null> {
  await db
    .update(agentConversations)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(agentConversations.id, id),
        eq(agentConversations.userId, userId),
        isNull(agentConversations.deletedAt),
      ),
    );
  return findById(id, userId);
}

/** 软删除会话（带 userId 归属校验）；不属于该用户则不操作，返回 null */
export async function softDelete(
  id: number,
  userId: number,
): Promise<AgentConversation | null> {
  const existing = await findById(id, userId);
  if (!existing) return null;

  const now = new Date();
  await db
    .update(agentConversations)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(agentConversations.id, id));
  return existing;
}
