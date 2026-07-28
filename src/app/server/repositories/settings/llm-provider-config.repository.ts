import { eq, ne, and, isNull, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import {
  llmProviderConfigs,
  type NewLlmProviderConfig,
} from "@/app/db/schema";

/** 根据 ID 查询配置（排除软删除） */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(llmProviderConfigs)
    .where(
      and(
        eq(llmProviderConfigs.id, id),
        isNull(llmProviderConfigs.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 查询当前生效配置（isDefault=true 且 status=active，排除软删除）。
 * 全局唯一，由 service 层事务保证。
 */
export async function findActive() {
  const [row] = await db
    .select()
    .from(llmProviderConfigs)
    .where(
      and(
        eq(llmProviderConfigs.isDefault, true),
        eq(llmProviderConfigs.status, "active"),
        isNull(llmProviderConfigs.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 是否存在任何生效配置 */
export async function existsActive(): Promise<boolean> {
  const row = await findActive();
  return row !== null;
}

/** 配置列表（分页 + provider/status 过滤） */
export async function findList(options: {
  limit: number;
  offset: number;
  provider?: "openai" | "anthropic";
  status?: "active" | "inactive";
}) {
  const conditions = [isNull(llmProviderConfigs.deletedAt)];
  if (options.provider) {
    conditions.push(eq(llmProviderConfigs.provider, options.provider));
  }
  if (options.status) {
    conditions.push(eq(llmProviderConfigs.status, options.status));
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(llmProviderConfigs)
    .where(where);

  const items = await db
    .select()
    .from(llmProviderConfigs)
    .where(where)
    .orderBy(desc(llmProviderConfigs.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 创建配置 */
export async function create(data: NewLlmProviderConfig) {
  const { id } = await insertReturningId(llmProviderConfigs, data);
  return findById(id);
}

/** 更新配置 */
export async function updateById(
  id: number,
  data: Partial<
    Omit<NewLlmProviderConfig, "id" | "createdAt" | "deletedAt">
  >,
) {
  await db
    .update(llmProviderConfigs)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(llmProviderConfigs.id, id),
        isNull(llmProviderConfigs.deletedAt),
      ),
    );
  return findById(id);
}

/**
 * 把除指定 id 外的所有生效标记清空（事务内调用）。
 * 用于保证全局唯一生效配置。
 */
export async function clearOtherDefaults(id: number) {
  await db
    .update(llmProviderConfigs)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(
        ne(llmProviderConfigs.id, id),
        eq(llmProviderConfigs.isDefault, true),
        isNull(llmProviderConfigs.deletedAt),
      ),
    );
}

/** 软删除配置 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(llmProviderConfigs)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(llmProviderConfigs.id, id));
}
