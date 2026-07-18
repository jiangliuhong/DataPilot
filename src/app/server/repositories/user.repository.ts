import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import type { User } from "@/app/db/schema";

/** 根据用户名查询用户（排除软删除） */
export async function findByUsername(username: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** 根据 ID 查询用户（排除软删除） */
export async function findById(id: number): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return row ?? null;
}
