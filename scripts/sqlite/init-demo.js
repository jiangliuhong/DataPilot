/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 一次性初始化 SQLite 演示数据库：
 *   1. 创建数据库文件并执行全部 Drizzle 迁移；
 *   2. 原子写入 demo-init.sql 中的演示数据；
 *   3. 若项目根目录没有 .env，生成开箱即用的 demo 配置（DB_DRIVER、
 *      DATABASE_URL、随机生成的 DBT_ENCRYPTION_KEY 与 AUTH_JWT_SECRET）。
 *
 * 重复执行是安全的：Drizzle 只执行尚未应用的迁移，演示数据使用
 * INSERT OR IGNORE，已存在的数据不会被覆盖；已存在的 .env 不会被覆盖。
 *
 * 用法：
 *   pnpm db:sqlite:demo
 *   DB_DRIVER=sqlite DATABASE_URL=./data.db node scripts/sqlite/init-demo.js
 */
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const { migrateSqlite } = require("./migrate");

const dbUrl = process.env.DATABASE_URL ?? "./data.db";
const sqlPath = path.join(__dirname, "demo-init.sql");
const projectRoot = path.join(__dirname, "..", "..");
const envPath = path.join(projectRoot, ".env");

/**
 * 当 .env 不存在时，生成 demo 开箱即用的环境配置。
 *
 * 仅写入服务启动所必需的变量：
 * - DB_DRIVER / DATABASE_URL：与本次初始化使用的数据库保持一致；
 * - DBT_ENCRYPTION_KEY：crypto.ts 要求的 32 字节 hex（aes-256-gcm）；
 * - AUTH_JWT_SECRET：jwt.ts 要求的 ≥32 字符 HS256 密钥。
 *
 * 已存在的 .env 一律跳过，避免覆盖用户已有配置。
 */
function ensureEnvFile() {
  if (fs.existsSync(envPath)) {
    console.log("✓ .env 已存在，跳过生成");
    return;
  }

  const encryptionKey = crypto.randomBytes(32).toString("hex");
  const jwtSecret = crypto.randomBytes(48).toString("hex");
  // 仅取 dbUrl 的文件名部分，避免在不同工作目录下运行时把绝对路径写入 .env
  const dbFileName = path.isAbsolute(dbUrl)
    ? dbUrl
    : path.relative(projectRoot, path.resolve(projectRoot, dbUrl)) || dbUrl;

  const content = `# 由 scripts/sqlite/init-demo.js 自动生成的演示配置
# 请勿提交到版本库。生产环境请另行配置。

# Database driver: sqlite (demo)
DB_DRIVER=sqlite

# SQLite database file
DATABASE_URL=${dbFileName}

# Encryption key for sensitive fields (aes-256-gcm, 32 bytes hex)
DBT_ENCRYPTION_KEY=${encryptionKey}

# JWT signing secret for user authentication (HS256, >= 32 chars)
AUTH_JWT_SECRET=${jwtSecret}

# ===== AI Agent (LangChain) =====
LLM_PROVIDER=openai
# OPENAI_API_KEY=
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini
`;

  fs.writeFileSync(envPath, content, { encoding: "utf8" });
  console.log(`✓ 已生成演示配置 -> ${path.relative(projectRoot, envPath) || ".env"}`);
}

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

  ensureEnvFile();
} catch (err) {
  console.error("✗ SQLite 演示数据库初始化失败:", err);
  process.exitCode = 1;
}
