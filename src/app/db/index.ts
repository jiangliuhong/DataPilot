import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2/driver";
import * as mysql from "mysql2/promise";

import * as schema from "./schema";

const DB_DRIVER = process.env.DB_DRIVER ?? "mysql";

function createMySQLClient() {
  const connection = mysql.createPool(process.env.DATABASE_URL!);
  return drizzle(connection, { schema, mode: "default" });
}

// 使用 MySQL 作为主类型（schema 基于 mysqlTable 定义）
export const db: MySql2Database<typeof schema> = createMySQLClient();

export type Database = typeof db;
