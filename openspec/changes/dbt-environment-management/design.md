## Context

DataPilot 已实现 dbt 项目管理模块（项目、目录、文件的 CRUD 及 ZIP 导入导出），数据层使用 Drizzle ORM + MySQL，三层分离架构为 Route → Service → Repository。本次变更在此基础上新增 dbt Core 环境管理能力，属于跨模块扩展：新增 3 张公共配置表（版本、连接、环境）+ 1 张项目侧绑定表。

当前约束：
- 数据库为 MySQL，Drizzle ORM 是唯一 ORM
- 前后端严格分离，本次 scope 仅后端 API
- 敏感字段（数据库密码）需要加密存储
- dbt Core 版本与适配器包之间存在兼容性映射关系

## Goals / Non-Goals

**Goals:**
- 提供 dbt Core 版本的 CRUD 和依赖声明管理
- 提供数据库连接的 CRUD，支持 MySQL 5、MySQL 8、StarRocks、PostgreSQL 四种类型，敏感信息加密存储
- 提供运行环境的创建（版本 + 连接组合），含适配器兼容性校验
- 提供环境与项目的多对多绑定
- 所有新代码遵循已有的 Repository → Service → Route 三层模式和命名规范

**Non-Goals:**
- 不涉及 dbt Cloud 版本管理
- 不涉及实际的 dbt 命令执行或调度运行
- 不涉及前端页面实现（后续排期）
- 不涉及连接池管理或 SSH 隧道等高级连接配置
- 不涉及环境的容器化隔离或沙箱执行
- 不支持 MySQL 5/8 以外的 MySQL 分支、也不支持其他数据库类型

## Decisions

### D1: 数据库表设计 — 4 表模型

新增 4 张表，与已有 `dbt_projects` 等表保持一致的命名和字段规范：

```
dbt_versions              -- 公共：dbt Core 版本
  ├── id (PK, serial)
  ├── name (varchar 255, unique)        -- 版本名称，如 "dbt-core-1.8.0"
  ├── version (varchar 50)              -- 版本号，如 "1.8.0" 或 "latest"
  ├── adapter_packages (json)           -- 适配器包清单 [{"name":"dbt-mysql","version":"1.8.0"|"latest","supportedDatabases":["mysql5","mysql8"]}]
  ├── dependencies (json)               -- Python 依赖清单 [{"name":"dbt-core","version":"1.8.0"|"latest"},{"name":"dbt-mysql","version":"1.8.0"|"latest"}]
  ├── status (enum: active/inactive)
  ├── created_at, updated_at, deleted_at

dbt_database_connections  -- 公共：数据库连接
  ├── id (PK, serial)
  ├── name (varchar 255, unique)        -- 连接名称
  ├── database_type (enum: mysql5/mysql8/starrocks/postgresql)
  ├── host (varchar 255)
  ├── port (int)
  ├── database_name (varchar 255)
  ├── schema_name (varchar 255, nullable)
  ├── username (varchar 255)
  ├── encrypted_password (text)         -- AES-256-GCM 加密
  ├── extra_config (json, nullable)     -- 额外连接参数
  ├── status (enum: active/inactive)
  ├── created_at, updated_at, deleted_at

dbt_runtime_environments -- 公共：运行环境
  ├── id (PK, serial)
  ├── name (varchar 255, unique)        -- 环境名称
  ├── version_id (FK → dbt_versions.id)
  ├── connection_id (FK → dbt_database_connections.id)
  ├── status (enum: active/inactive)
  ├── created_at, updated_at, deleted_at

dbt_project_environments -- 项目侧：环境绑定
  ├── id (PK, serial)
  ├── project_id (FK → dbt_projects.id)
  ├── environment_id (FK → dbt_runtime_environments.id)
  ├── environment_alias (varchar 255, nullable)  -- 别名，如 "dev"/"staging"/"prod"
  ├── created_at, updated_at, deleted_at
  └── UNIQUE(project_id, environment_id)
```

**理由**：版本和连接作为独立公共资源，运行环境是二者的组合实体，绑定关系归属项目域。`adapter_packages` 使用 JSON 而非独立表，因为包信息是版本的附属元数据，不需要独立查询。

**备选方案**：将适配器包拆为独立表。拒绝原因——增加 JOIN 复杂度但查询场景仅为"校验版本是否支持某数据库"，JSON 字段足够。

### D1.1: version 字段与 "latest" 语义

`version` 字段为 `varchar(50)`，取值有两种：
- **具体版本号**：如 `"1.8.0"`、`"1.7.4"` — 表示固定版本
- **`"latest"`**：表示追踪最新版本，适配器包和依赖的 version 同样支持 `"latest"`

`"latest"` 版本记录的意义：用户创建运行环境时可选择 `"latest"` 版本，系统在实际执行时解析为当时最新的具体版本。`adapter_packages` 和 `dependencies` 中的 version 值也遵循相同规则。

API 行为：
- `GET /api/dbt/versions?version=latest` — 查询参数过滤，返回 version 为 "latest" 的记录
- 创建版本时 `version` 字段校验：允许 `"latest"` 或 semver 格式
- `name` 字段（如 `"dbt-core-1.8.0"`）保持唯一约束，同一 version 值可有多条记录（不同 name）
- `version` + `name` 组合无额外约束，`"latest"` 仅作为版本标识不是互斥标记

**理由**：`version` 字段直接承载 "latest" 语义，无需额外的布尔标记或互斥逻辑。`adapter_packages` 和 `dependencies` 的 version 字段统一支持 `"latest"`，保持概念一致。

### D2: 适配器兼容性校验 — 配置驱动

在 `constants.ts` 中维护数据库类型到 dbt 适配器包名的静态映射表：

```typescript
export const DB_TYPE_ADAPTER_MAP = {
  mysql5: { adapterPackage: "dbt-mysql", minAdapterVersion: "1.0.0" },
  mysql8: { adapterPackage: "dbt-mysql", minAdapterVersion: "1.0.0" },
  starrocks: { adapterPackage: "dbt-starrocks", minAdapterVersion: "1.0.0" },
  postgresql: { adapterPackage: "dbt-postgres", minAdapterVersion: "1.0.0" },
} as const;

export const SUPPORTED_DATABASE_TYPES = Object.keys(DB_TYPE_ADAPTER_MAP) as (keyof typeof DB_TYPE_ADAPTER_MAP)[];
```

创建运行环境时的校验流程：
1. 查询 `dbt_versions.adapter_packages`，找到与目标 `database_type` 匹配的适配器包
2. 如未找到对应适配器 → 返回 400 错误
3. 校验通过 → 允许创建

**理由**：静态映射 + 动态 JSON 校验的组合，既保证数据库类型的有限枚举，又允许不同版本声明不同的适配器支持范围。

### D3: 敏感字段加密 — AES-256-GCM

使用 Node.js 内置 `crypto` 模块，AES-256-GCM 对称加密：

- 加密密钥来源：环境变量 `DBT_ENCRYPTION_KEY`（32 字节 hex 字符串）
- 存储：`encrypted_password` 字段存储 `iv:authTag:ciphertext` 格式的 base64 字符串
- 读取：解密后仅在内存中使用，API 响应中不返回密码原文，仅返回 `hasPassword: boolean`

**备选方案**：
- bcrypt：不可逆，无法用于实际数据库连接场景 → 拒绝
- 应用层 KMS：当前规模过重 → 拒绝，但接口预留 `encryptor` 抽象，未来可替换为 KMS

### D4: API 路由设计

```
# 公共配置 — 版本管理
GET    /api/dbt/versions                      # 列表
POST   /api/dbt/versions                      # 创建
GET    /api/dbt/versions/[id]                 # 详情
PUT    /api/dbt/versions/[id]                 # 更新
DELETE /api/dbt/versions/[id]                 # 删除

# 公共配置 — 数据库连接管理
GET    /api/dbt/connections                   # 列表
POST   /api/dbt/connections                   # 创建
GET    /api/dbt/connections/[id]              # 详情
PUT    /api/dbt/connections/[id]              # 更新
DELETE /api/dbt/connections/[id]              # 删除

# 公共配置 — 运行环境管理
GET    /api/dbt/environments                  # 列表
POST   /api/dbt/environments                  # 创建
GET    /api/dbt/environments/[id]             # 详情
PUT    /api/dbt/environments/[id]             # 更新
DELETE /api/dbt/environments/[id]             # 删除

# 项目侧 — 环境绑定（嵌套在 projects 路径下）
GET    /api/dbt/projects/[id]/environments    # 查看项目绑定的环境列表
POST   /api/dbt/projects/[id]/environments    # 绑定环境
DELETE /api/dbt/projects/[id]/environments/[envId]  # 解绑
```

**理由**：版本、连接、环境作为公共资源放在 `/api/dbt/` 一级路径下；绑定关系从属于项目，嵌套在 `/api/dbt/projects/[id]/environments/` 下，体现归属差异。

### D5: 文件组织 — 遵循现有模式

```
src/app/db/schema/
  ├── dbt-version.ts                  # 新增
  ├── dbt-database-connection.ts      # 新增
  ├── dbt-runtime-environment.ts      # 新增
  ├── dbt-project-environment.ts      # 新增
  └── index.ts                        # 追加 re-export

src/app/db/relations/
  └── dbt.ts                          # 追加新表的 relations

src/app/server/repositories/dbt/
  ├── version.repository.ts           # 新增
  ├── connection.repository.ts        # 新增
  ├── environment.repository.ts       # 新增
  └── project-environment.repository.ts  # 新增

src/app/server/services/dbt/
  ├── version.service.ts              # 新增
  ├── connection.service.ts           # 新增（含加密/解密）
  ├── environment.service.ts          # 新增（含适配器校验）
  └── project-environment.service.ts  # 新增

src/app/server/schemas/dbt/
  ├── version.schema.ts               # 新增
  ├── connection.schema.ts            # 新增
  ├── environment.schema.ts           # 新增
  └── project-environment.schema.ts   # 新增

src/app/server/configs/dbt/
  └── constants.ts                    # 追加新常量

src/app/server/lib/
  └── crypto.ts                       # 新增：加密/解密工具函数

src/app/api/dbt/
  ├── versions/
  │   ├── route.ts                    # GET 列表 / POST 创建
  │   └── [id]/route.ts              # GET/PUT/DELETE 详情
  ├── connections/
  │   ├── route.ts
  │   └── [id]/route.ts
  ├── environments/
  │   ├── route.ts
  │   └── [id]/route.ts
  └── projects/[id]/environments/
      ├── route.ts                    # GET 绑定列表 / POST 绑定
      └── [envId]/route.ts           # DELETE 解绑
```

**理由**：完全遵循已有的 feature-based 组织和命名规范，无例外。

## Risks / Trade-offs

**[加密密钥管理]** → 密钥通过环境变量 `DBT_ENCRYPTION_KEY` 注入，缺失时启动报错。未来可平滑迁移到 KMS，接口已预留抽象层。

**[适配器兼容性数据准确性]** → `adapter_packages` JSON 数据依赖管理员手动录入，存在版本号写错的风险。→ 缓解：在创建/更新版本时用 Zod schema 校验 JSON 结构；未来可对接 PyPI API 自动校验包是否存在。

**[JSON 字段查询性能]** → `adapter_packages` 和 `dependencies` 使用 JSON 类型，在 MySQL 中无法直接建立索引。→ 缓解：当前数据量极小（版本数量有限），性能不构成问题。若未来需要按适配器反查版本，再抽取为独立表。

**[运行环境删除级联]** → 删除版本或连接时需检查是否有运行环境引用。→ 缓解：在 service 层做引用检查，存在引用时拒绝删除并返回 409。

## Migration Plan

1. **新增环境变量**：在 `.env` 中添加 `DBT_ENCRYPTION_KEY`
2. **执行迁移**：`drizzle-kit generate` + `drizzle-kit migrate` 生成并执行 4 张新表的 migration
4. **部署**：正常部署流程，无破坏性变更
5. **回滚**：删除 4 张新表即可，不影响已有功能
