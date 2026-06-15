/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 以编程方式对 SQLite 数据库执行 Drizzle 迁移。
 *
 * 比 `drizzle-kit migrate`（CLI）更稳定：CLI 在某些环境下会卡在
 * 「applying migrations...」交互处；这里使用 drizzle-orm 官方的
 * better-sqlite3 migrator，同步执行，无交互。
 *
 * 用法：
 *   pnpm db:sqlite:migrate
 *   # 或
 *   DB_DRIVER=sqlite DATABASE_URL=./data.db node scripts/sqlite/migrate.js
 */
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { migrate } = require("drizzle-orm/better-sqlite3/migrator");

const dbUrl = process.env.DATABASE_URL ?? "./data.db";
const migrationsFolder = path.join(__dirname, "..", "..", "src", "app", "db", "migrations", "sqlite");

if (!fs.existsSync(migrationsFolder)) {
  console.error(`找不到迁移目录: ${migrationsFolder}`);
  console.error("请先执行: DB_DRIVER=sqlite pnpm db:generate");
  process.exit(1);
}

const sqlite = new Database(dbUrl);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

try {
  migrate(db, { migrationsFolder });
  console.log(`✓ SQLite 迁移完成 -> ${dbUrl}`);
} catch (err) {
  console.error("✗ 迁移失败:", err);
  process.exitCode = 1;
} finally {
  sqlite.close();
}
