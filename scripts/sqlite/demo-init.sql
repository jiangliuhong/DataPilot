-- =============================================================================
-- DataPilot — SQLite 演示数据初始化脚本（种子数据）
-- =============================================================================
--
-- 用途：由 init-demo.js 在完成全部 Drizzle 迁移后执行，向 SQLite 数据库
--       插入一套可演示的示例数据，方便本地开发与体验。
--
-- 仅包含种子数据（DML），不包含任何建表语句（DDL）。表结构由 Drizzle 的
-- 迁移（drizzle-kit migrate）统一管理，符合 AGENTS.md 中「迁移是表结构唯一
-- 来源」的约定。
--
-- 幂等：所有插入使用 INSERT OR IGNORE，重复执行不会报错、不会重复插入。
--
-- 推荐用法：pnpm db:sqlite:demo
-- 该命令会自动创建数据库、执行迁移并写入本文件中的演示数据，无需前置步骤。
--
-- 时间戳列：SQLite schema 中 created_at / updated_at 是
--   integer (mode: "timestamp")，即 Unix 秒。这里统一使用 unixepoch()。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. users：演示登录账户
-- -----------------------------------------------------------------------------
-- 密码哈希格式为 scrypt 的 saltHex:hashHex（见 src/app/server/lib/password.ts，
-- 参数 N=16384, r=8, p=1, salt 16 字节, key 64 字节）。
--
-- 下面的哈希对应明文密码：
--   admin  / admin123
--   viewer / viewer123
-- 如需更换密码，请通过应用 UI 的「注册/修改密码」入口，或直接用项目里的
-- hashPassword() 重新生成后替换这里。
INSERT OR IGNORE INTO `users` (
  `id`, `username`, `password_hash`, `display_name`, `email`, `status`, `created_at`, `updated_at`
) VALUES (
  1,
  'admin',
  'd9cbcaecda453b21dd239b6cf7a03e3a:72e457adc439bb4356eaa103791c3f75465222c0ed11ff672912e13f345c25696e76cba4d67b6f0ef355a32cc773f9644744a749648299aee7bf173d7a4af354',
  'Admin',
  'admin@datapilot.local',
  'active',
  unixepoch(),
  unixepoch()
);

INSERT OR IGNORE INTO `users` (
  `id`, `username`, `password_hash`, `display_name`, `email`, `status`, `created_at`, `updated_at`
) VALUES (
  2,
  'viewer',
  'bc4667fa0ce6464f1e6b00289f51d024:a93e80b4209f2fc90d94bf5f5f7e70a693cbe0a7dcef0b33348ba7e604467d12981945b90fd4464c4b8964966c4b3a7f2a21ac2fe890836262e17f85b10ff1bd',
  'Viewer',
  'viewer@datapilot.local',
  'active',
  unixepoch(),
  unixepoch()
);

-- -----------------------------------------------------------------------------
-- 1. dbt_versions：dbt Core 版本定义（适配器包 + 依赖）
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO `dbt_versions` (
  `id`, `name`, `version`, `adapter_packages`, `dependencies`, `status`, `created_at`, `updated_at`
) VALUES (
  1,
  'dbt-core-1.7',
  '1.7.0',
  json('[
    {"name":"dbt-mysql","version":"1.7.0","supportedDatabases":["mysql5","mysql8"]},
    {"name":"dbt-postgres","version":"1.7.0","supportedDatabases":["postgresql"]},
    {"name":"dbt-starrocks","version":"1.7.0","supportedDatabases":["starrocks"]}
  ]'),
  json('[
    {"name":"dbt-core","version":"1.7.0"},
    {"name":"dbt-mysql","version":"1.7.0"}
  ]'),
  'active',
  unixepoch(),
  unixepoch()
);

-- -----------------------------------------------------------------------------
-- 2. dbt_database_connections：一个本地 MySQL8 演示连接
-- -----------------------------------------------------------------------------
-- 注意：encrypted_password 必须是 AES-256-GCM 加密后的密文（见
--       src/app/server/lib/crypto.ts），由 DBT_ENCRYPTION_KEY 决定。
--       这里放一个占位密文；如需在 UI 中实际测试连接，请通过「数据库连接」
--       页面重新创建该连接以生成与当前密钥匹配的密文。
INSERT OR IGNORE INTO `dbt_database_connections` (
  `id`, `name`, `database_type`, `host`, `port`, `database_name`, `schema_name`,
  `username`, `encrypted_password`, `extra_config`, `status`, `created_at`, `updated_at`
) VALUES (
  1,
  'local-mysql8-demo',
  'mysql8',
  '127.0.0.1',
  3306,
  'analytics',
  'public',
  'datapilot',
  'DEMO_PLACEHOLDER_PLEASE_RECREATE_VIA_UI',
  json('{"charset":"utf8mb4","ssl":false}'),
  'active',
  unixepoch(),
  unixepoch()
);

-- -----------------------------------------------------------------------------
-- 3. dbt_runtime_environments：把上面的版本 + 连接组合成一个运行环境
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO `dbt_runtime_environments` (
  `id`, `name`, `version_id`, `connection_id`, `status`, `created_at`, `updated_at`
) VALUES (
  1,
  'default-env',
  1,
  1,
  'active',
  unixepoch(),
  unixepoch()
);

-- -----------------------------------------------------------------------------
-- 4. dbt_projects：一个示例 dbt 项目
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO `dbt_projects` (
  `id`, `name`, `description`, `status`, `created_at`, `updated_at`
) VALUES (
  1,
  'demo-project',
  '由 SQLite demo 初始化脚本创建的示例 dbt 项目，用于本地体验。',
  'active',
  unixepoch(),
  unixepoch()
);

-- -----------------------------------------------------------------------------
-- 5. dbt_directories：示例目录结构（models/）
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO `dbt_directories` (
  `id`, `project_id`, `parent_id`, `name`, `path`, `depth`, `sort_order`, `created_at`, `updated_at`
) VALUES (
  1, 1, NULL, 'models', 'models', 0, 0, unixepoch(), unixepoch()
);

-- -----------------------------------------------------------------------------
-- 6. dbt_files：一个示例 SQL 模型文件
-- -----------------------------------------------------------------------------
-- 注意：content 内的 dbt Jinja 文本中如果出现单引号会与 SQL 字符串字面量
--       冲突。这里特意选用不含单引号的演示内容，保证脚本可直接被
--       better-sqlite3 / sqlite3 执行；真实文件内容仍可通过应用 UI 编辑。
INSERT OR IGNORE INTO `dbt_files` (
  `id`, `project_id`, `directory_id`, `name`, `path`, `content`, `file_type`, `size`, `created_at`, `updated_at`
) VALUES (
  1,
  1,
  1,
  'demo_customers.sql',
  'models/demo_customers.sql',
  '-- Demo dbt model: a simple customers view.
-- Replace with your own SQL via the editor UI.
select
    customer_id,
    first_name,
    last_name,
    email
from {{ ref("raw_customers") }}
',
  'sql',
  0,
  unixepoch(),
  unixepoch()
);

-- -----------------------------------------------------------------------------
-- 7. dbt_project_environments：把示例项目绑定到默认运行环境
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO `dbt_project_environments` (
  `id`, `project_id`, `environment_id`, `environment_alias`, `created_at`, `updated_at`
) VALUES (
  1, 1, 1, 'default', unixepoch(), unixepoch()
);

-- =============================================================================
-- 完成提示：可通过如下命令查看结果
--   sqlite3 ./data.db "SELECT COUNT(*) FROM dbt_projects;"
--   sqlite3 ./data.db "SELECT name FROM sqlite_master WHERE type='table';"
-- =============================================================================
