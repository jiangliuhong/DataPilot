/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 运行 SQLite 演示数据初始化脚本。
 *
 * 使用项目已安装的 better-sqlite3（与运行时驱动一致），避免对系统级
 * sqlite3 CLI 的依赖。
 *
 * 用法：
 *   pnpm db:sqlite:demo
 *   # 或
 *   DB_DRIVER=sqlite DATABASE_URL=./data.db node scripts/sqlite/run-demo-init.js
 *
 * 前置：已通过 `DB_DRIVER=sqlite pnpm db:migrate` 建表。
 */
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const dbUrl = process.env.DATABASE_URL ?? "./data.db";
const sqlPath = path.join(__dirname, "demo-init.sql");

if (!fs.existsSync(sqlPath)) {
  console.error(`找不到演示 SQL 脚本: ${sqlPath}`);
  process.exit(1);
}

if (!fs.existsSync(dbUrl)) {
  console.error(
    `找不到数据库文件: ${dbUrl}\n请先执行: DB_DRIVER=sqlite pnpm db:migrate`,
  );
  process.exit(1);
}

const sqlite = new Database(dbUrl);
sqlite.pragma("foreign_keys = ON");

const sql = fs.readFileSync(sqlPath, "utf8");
// drizzle 迁移脚本使用 --> statement-breakpoint 分隔，这里 demo 脚本是手工
// 编写的纯 SQL，直接 exec 即可（better-sqlite3 的 exec 支持多语句）。
sqlite.exec(sql);

const counts = sqlite.prepare(
  `SELECT 'users' AS t, COUNT(*) AS n FROM users
   UNION ALL SELECT 'dbt_projects', COUNT(*) FROM dbt_projects
   UNION ALL SELECT 'dbt_versions', COUNT(*) FROM dbt_versions
   UNION ALL SELECT 'dbt_database_connections', COUNT(*) FROM dbt_database_connections
   UNION ALL SELECT 'dbt_runtime_environments', COUNT(*) FROM dbt_runtime_environments
   UNION ALL SELECT 'dbt_directories', COUNT(*) FROM dbt_directories
   UNION ALL SELECT 'dbt_files', COUNT(*) FROM dbt_files
   UNION ALL SELECT 'dbt_project_environments', COUNT(*) FROM dbt_project_environments`,
).all();

sqlite.close();

console.log(`✓ 演示数据已写入 ${dbUrl}`);
for (const { t, n } of counts) {
  console.log(`  - ${t}: ${n} 行`);
}
