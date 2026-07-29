import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2/driver";
import { drizzle as drizzleSQLite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as mysql from "mysql2/promise";

import * as schema from "./schema";
// Importing relations registers them (side effect) with the active dialect.
import "./relations";

const DB_DRIVER = process.env.DB_DRIVER ?? "mysql";

/** 当前是否使用 SQLite 驱动 */
export const isSQLite = DB_DRIVER === "sqlite";

function createMySQLClient() {
  const connection = mysql.createPool(process.env.DATABASE_URL!);
  return drizzle(connection, { schema, mode: "default" });
}

function createSQLiteClient() {
  const url = process.env.DATABASE_URL ?? "./data.db";
  const sqlite = new Database(url);
  // 开启 WAL 提升并发读，外键约束默认开启以匹配 MySQL 行为
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzleSQLite(sqlite, { schema });
}

// 运行时按 DB_DRIVER 选择驱动；类型统一以 MySQL 为准（schema 的规范类型），
// 这样 repository / service 层代码无需感知驱动差异。
const rawDb = isSQLite ? createSQLiteClient() : createMySQLClient();

export const db = rawDb as unknown as MySql2Database<typeof schema>;

export type Database = typeof db;

/**
 * Repository 用于「在事务内执行 vs 走全局 db」的统一客户端类型。
 *
 * 取 db 的 select/insert/update 子集：事务回调传入的 tx 与全局 db 都满足该结构，
 * 因此 repository 方法可用 `tx?: DbClient` 接收事务上下文，缺省回退到全局 db。
 *（见 harden-dbt-construction-flow / dbt-transaction-integrity）
 */
export type DbClient = Pick<Database, "select" | "insert" | "update">;

/**
 * 跨驱动的「插入并返回自增主键」封装。
 *
 * - MySQL：使用 drizzle 的 `.$returningId()`（MySQL 原生不支持 RETURNING）。
 * - SQLite：使用标准的 `.returning({ id })`。
 *
 * 抽象出该函数后，repository 的 insert 写法可与具体驱动解耦。
 */
export async function insertReturningId<TTable extends { id: unknown }>(
  table: TTable,
  data: object,
  tx?: DbClient,
): Promise<{ id: number }> {
  // tx 提供时在事务内插入，否则用全局 db（保持非事务调用路径零改动）
  const client = (tx ?? db) as typeof db;
  if (isSQLite) {
    // SQLite 支持原生 RETURNING
    const [row] = await (client as unknown as {
      insert: (t: TTable) => {
        values: (d: object) => {
          returning: (fields: { id: unknown }) => Promise<{ id: number }[]>;
        };
      };
    })
      .insert(table)
      .values(data)
      .returning({ id: (table as unknown as { id: unknown }).id });
    return { id: row.id };
  }
  // MySQL：drizzle 提供 $returningId() 辅助方法
  const [row] = await (client as unknown as {
    insert: (t: TTable) => {
      values: (d: object) => {
        $returningId: () => Promise<{ id: number }[]>;
      };
    };
  })
    .insert(table)
    .values(data)
    .$returningId();
  return { id: row.id };
}
