import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db, insertReturningId } from "@/app/db";
import {
  dbtDatabaseConnections,
  type NewDbtDatabaseConnection,
} from "@/app/db/schema";

/** 创建数据库连接 */
export async function createConnection(data: NewDbtDatabaseConnection) {
  const { id } = await insertReturningId(dbtDatabaseConnections, data);
  return findById(id);
}

/** 根据 ID 查询连接（排除软删除） */
export async function findById(id: number) {
  const [row] = await db
    .select()
    .from(dbtDatabaseConnections)
    .where(
      and(
        eq(dbtDatabaseConnections.id, id),
        isNull(dbtDatabaseConnections.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 根据名称查询连接（排除软删除） */
export async function findByName(name: string) {
  const [row] = await db
    .select()
    .from(dbtDatabaseConnections)
    .where(
      and(
        eq(dbtDatabaseConnections.name, name),
        isNull(dbtDatabaseConnections.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 连接列表（分页 + databaseType/status 过滤） */
export async function findList(options: {
  limit: number;
  offset: number;
  databaseType?: "mysql5" | "mysql8" | "starrocks" | "postgresql";
  status?: "active" | "inactive";
}) {
  const conditions = [isNull(dbtDatabaseConnections.deletedAt)];
  if (options.databaseType) {
    conditions.push(eq(dbtDatabaseConnections.databaseType, options.databaseType));
  }
  if (options.status) {
    conditions.push(eq(dbtDatabaseConnections.status, options.status));
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: count() })
    .from(dbtDatabaseConnections)
    .where(where);

  const items = await db
    .select()
    .from(dbtDatabaseConnections)
    .where(where)
    .orderBy(desc(dbtDatabaseConnections.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items,
    total: countRow?.total ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

/** 更新连接 */
export async function updateById(
  id: number,
  data: Partial<
    Pick<
      NewDbtDatabaseConnection,
      | "name"
      | "databaseType"
      | "host"
      | "port"
      | "databaseName"
      | "schemaName"
      | "username"
      | "encryptedPassword"
      | "extraConfig"
      | "status"
    >
  >,
) {
  await db
    .update(dbtDatabaseConnections)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(dbtDatabaseConnections.id, id),
        isNull(dbtDatabaseConnections.deletedAt),
      ),
    );
  return findById(id);
}

/** 软删除连接 */
export async function softDeleteById(id: number) {
  const now = new Date();
  await db
    .update(dbtDatabaseConnections)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(dbtDatabaseConnections.id, id));
}
