/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 一次性初始化 SQLite 演示数据库：
 *   1. 创建数据库文件并执行全部 Drizzle 迁移；
 *   2. 原子写入 demo-init.sql 中的演示数据。
 *
 * 重复执行是安全的：Drizzle 只执行尚未应用的迁移，演示数据使用
 * INSERT OR IGNORE，已存在的数据不会被覆盖。
 *
 * 用法：
 *   pnpm db:sqlite:demo
 *   DB_DRIVER=sqlite DATABASE_URL=./data.db node scripts/sqlite/init-demo.js
 */
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const { migrateSqlite } = require("./migrate");

const dbUrl = process.env.DATABASE_URL ?? "./data.db";
const sqlPath = path.join(__dirname, "demo-init.sql");

function seedDemoData() {
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`找不到演示数据脚本: ${sqlPath}`);
  }

  const sqlite = new Database(dbUrl);
  sqlite.pragma("foreign_keys = ON");

  try {
    const sql = fs.readFileSync(sqlPath, "utf8");
    sqlite.transaction(() => sqlite.exec(sql))();

    return sqlite.prepare(
      `SELECT 'users' AS t, COUNT(*) AS n FROM users
       UNION ALL SELECT 'dbt_projects', COUNT(*) FROM dbt_projects
       UNION ALL SELECT 'dbt_versions', COUNT(*) FROM dbt_versions
       UNION ALL SELECT 'dbt_database_connections', COUNT(*) FROM dbt_database_connections
       UNION ALL SELECT 'dbt_runtime_environments', COUNT(*) FROM dbt_runtime_environments
       UNION ALL SELECT 'dbt_directories', COUNT(*) FROM dbt_directories
       UNION ALL SELECT 'dbt_files', COUNT(*) FROM dbt_files
       UNION ALL SELECT 'dbt_project_environments', COUNT(*) FROM dbt_project_environments`,
    ).all();
  } finally {
    sqlite.close();
  }
}

try {
  migrateSqlite(dbUrl);
  console.log(`✓ SQLite 表结构已就绪 -> ${dbUrl}`);

  const counts = seedDemoData();
  console.log("✓ SQLite 演示数据初始化完成");
  for (const { t, n } of counts) {
    console.log(`  - ${t}: ${n} 行`);
  }
} catch (err) {
  console.error("✗ SQLite 演示数据库初始化失败:", err);
  process.exitCode = 1;
}
