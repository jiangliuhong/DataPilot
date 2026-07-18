# SQLite 演示初始化数据维护约束

本文件适用于 `scripts/sqlite/` 及其子目录。修改本目录文件时，除遵守项目根目录的 `AGENTS.md` 外，还必须遵守以下规则。

## 文件职责

- `demo-init.sql` 是全新 SQLite 演示数据库的种子数据唯一来源，只允许包含 DML，不得包含建表、改表、索引等 DDL。
- 表结构只能通过 `src/app/db/schema/sqlite/` 与 Drizzle 迁移维护；不得手工修改已生成的迁移文件。
- `migrate.js` 只负责执行迁移，`init-demo.js` 只负责迁移后原子执行种子 SQL。不要把具体演示数据写进 JavaScript。
- `init-demo.js` 额外负责：当项目根目录没有 `.env` 时，生成开箱即用的 demo 配置（`DB_DRIVER`、`DATABASE_URL`、随机生成的 `DBT_ENCRYPTION_KEY` 与 `AUTH_JWT_SECRET`）。密钥必须用 `crypto.randomBytes` 现场生成；已存在的 `.env` 一律跳过，不得覆盖。

## 修改演示数据的步骤

1. 修改前先检查对应的 SQLite schema、外键、非空约束、枚举值和现有种子记录，禁止凭印象增加字段或数据。
2. 在 `demo-init.sql` 中修改或增加记录，并保持依赖顺序：被引用记录必须先于引用它的记录插入。
3. 已公开或被外键引用的固定 ID 应保持稳定。新增记录使用未占用且明确的固定 ID，同时补齐所有关联记录。
4. 时间戳统一使用 `unixepoch()`；JSON 字段统一使用 `json('...')` 并保证内容是合法 JSON。
5. 新增种子记录默认使用 `INSERT OR IGNORE`，保证初始化脚本可重复执行且不会覆盖用户已经修改的数据。
6. 如果只是改变“全新初始化后的默认值”，直接修改现有 `INSERT OR IGNORE` 中的值。注意：再次运行初始化不会更新已经存在的记录；应在全新的临时数据库上验证，或由用户明确决定是否重建本地演示库。
7. 不得为了让旧数据库自动变化而擅自加入无条件 `UPDATE`、`REPLACE`、删除语句或覆盖式 UPSERT。若需求明确要求升级已有数据库，必须单独设计可审查的数据升级方案，不能混入普通 demo 初始化逻辑。
8. 不得自动删除或覆盖 `data.db`。重建本地数据库属于破坏性操作，必须先取得用户明确授权。

## 演示账户与敏感字段

- 密码不得以明文写入 `password_hash`。使用项目的 `hashPassword` 生成 scrypt 哈希：

  ```bash
  pnpm exec tsx -e "import { hashPassword } from './src/app/server/lib/password'; console.log(hashPassword('NEW_DEMO_PASSWORD'))"
  ```

- 修改演示账户密码时，必须同时更新 `demo-init.sql` 中紧邻账户数据的明文凭据说明；若 README 或其他用户文档公开了该凭据，也要同步更新。
- 演示数据只能使用虚构账户、域名、主机和凭据，不得写入真实 API Key、JWT secret、数据库密码或个人信息。
- `encrypted_password` 不得伪造为可用密文。除非需求明确提供安全的生成流程，否则保留清晰的不可用占位值，并注明需要通过 UI 重建连接。

## SQL 内容要求

- 保持脚本分区注释和编号清晰；新增表数据时同步更新 `init-demo.js` 的统计查询（若该表需要出现在初始化结果中）。
- dbt/SQL 文件内容嵌入 SQLite 字符串时，必须正确处理单引号和换行，并确认 Jinja 内容没有破坏外层 SQL 字面量。
- 不得把 schema 修复、业务数据迁移或生产数据放入 `demo-init.sql`。

## 必须验证

每次修改演示数据后，必须在全新的临时数据库上执行初始化，并在同一数据库上再执行一次以验证幂等性：

```bash
tmp_dir="$(mktemp -d)"
DB_DRIVER=sqlite DATABASE_URL="$tmp_dir/data.db" pnpm db:sqlite:demo
DB_DRIVER=sqlite DATABASE_URL="$tmp_dir/data.db" pnpm db:sqlite:demo
```

然后按本次改动查询关键记录，确认行数、字段值、外键关系和 JSON 内容正确。涉及登录账户时，还必须通过 `verifyPassword` 或实际登录流程验证密码与哈希匹配。验证失败不得交付。
