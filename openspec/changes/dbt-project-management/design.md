## Context

DataPilot 是一个基于 Next.js App Router 的数据管理平台，采用严格的前后端分离架构。当前项目处于早期阶段，数据库 schema、API 路由、service 和 repository 层均为空白，本次是首个功能开发。

dbt（data build tool）项目的标准目录结构如下：

```
my_dbt_project/
├── dbt_project.yml        # 系统级配置（单独管理，不在本次范围内）
├── packages.yml           # 包依赖配置（同上，单独管理）
├── models/
│   ├── staging/
│   │   ├── stg_users.sql
│   │   └── _staging__models.yml
│   └── marts/
│       ├── dim_customers.sql
│       └── _marts__models.yml
├── snapshots/
│   └── snapshot_orders.sql
├── seeds/
│   └── country_codes.csv
├── tests/
│   └── unique_user_id.sql
├── macros/
│   └── generate_surrogate_key.sql
└── analyses/
    └── revenue_analysis.sql
```

本次设计需将这些目录和文件完整映射到数据库中，通过 API 进行管理。`dbt_project.yml` 和 `packages.yml` 属于系统级配置，由系统单独管理，不纳入项目文件管理范围。

## Goals / Non-Goals

**Goals:**

- 将 dbt 工程的目录结构和文件内容持久化到关系型数据库
- 提供完整的 RESTful API，覆盖项目、目录、文件的 CRUD 操作
- 支持项目的批量导入（压缩包）和导出（重建目录结构）
- 提供 `docs/api.html` 接口文档
- 遵循项目已有的分层架构（Route → Service → Repository → Drizzle）
- 支持软删除和分页

**Non-Goals:**

- 前端界面（本次不涉及）
- dbt_project.yml 中的连接信息管理（系统级配置，单独处理）
- dbt 编译和执行能力
- 文件版本控制和 diff 对比
- 用户认证和权限控制
- WebSocket 实时协作

## Decisions

### Decision 1: 三表数据模型

**选择**: 使用 `dbt_projects` + `dbt_directories` + `dbt_files` 三张表，目录通过 `parentId` 自引用实现树形结构。

**理由**: dbt 项目本质上是树形文件系统。三表模型清晰分离关注点：项目元数据、目录结构、文件内容。自引用外键天然支持任意深度的目录嵌套。

**备选方案**:
- *单表（邻接表存储所有节点）*: 查询时需要区分文件和目录，逻辑复杂，违反单一职责
- *闭包表（closure table）*: 查询性能更优但增加复杂度，当前阶段不必要

**表结构设计**:

```
dbt_projects
├── id            BIGINT PK AUTO_INCREMENT
├── name          VARCHAR(255) UNIQUE NOT NULL
├── description   TEXT
├── status        ENUM('active', 'archived') DEFAULT 'active'
├── createdAt     TIMESTAMP DEFAULT NOW()
├── updatedAt     TIMESTAMP ON UPDATE NOW()
└── deletedAt     TIMESTAMP NULL          -- 软删除

dbt_directories
├── id            BIGINT PK AUTO_INCREMENT
├── projectId     BIGINT FK → dbt_projects.id NOT NULL
├── parentId      BIGINT FK → dbt_directories.id NULL  -- 自引用，NULL=根目录
├── name          VARCHAR(255) NOT NULL
├── path          VARCHAR(1024) NOT NULL   -- 如 "models/staging"
├── depth         INT NOT NULL DEFAULT 0   -- 目录层级，根=0
├── sortOrder     INT NOT NULL DEFAULT 0
├── createdAt     TIMESTAMP DEFAULT NOW()
├── updatedAt     TIMESTAMP ON UPDATE NOW()
└── deletedAt     TIMESTAMP NULL

dbt_files
├── id            BIGINT PK AUTO_INCREMENT
├── projectId     BIGINT FK → dbt_projects.id NOT NULL
├── directoryId   BIGINT FK → dbt_directories.id NULL  -- NULL=项目根目录下的文件
├── name          VARCHAR(255) NOT NULL
├── path          VARCHAR(1024) NOT NULL   -- 如 "models/staging/stg_users.sql"
├── content       TEXT NOT NULL DEFAULT ''  -- 文件内容
├── fileType      VARCHAR(20) NOT NULL     -- sql, yml, md, py, csv, json, txt
├── size          INT NOT NULL DEFAULT 0   -- 文件大小（字节）
├── createdAt     TIMESTAMP DEFAULT NOW()
├── updatedAt     TIMESTAMP ON UPDATE NOW()
└── deletedAt     TIMESTAMP NULL
```

### Decision 2: path 字段的冗余存储

**选择**: 在 `dbt_directories` 和 `dbt_files` 中均存储 `path` 冗余字段。

**理由**: 避免每次查询文件路径时递归 JOIN 父目录。dbt 文件路径是高频访问字段，冗余存储用空间换时间。

**一致性保证**: path 由 service 层在创建/移动时计算并写入，不接受前端直接传入。

### Decision 3: API 路由结构

**选择**: 以项目为核心资源的嵌套路由设计。

```
src/app/api/
└── dbt/
    ├── projects/
    │   ├── route.ts                          # GET (列表), POST (创建)
    │   └── [id]/
    │       ├── route.ts                      # GET (详情), PUT (更新), DELETE (删除)
    │       ├── tree/
    │       │   └── route.ts                  # GET (完整目录树)
    │       ├── directories/
    │       │   ├── route.ts                  # GET (列表), POST (创建)
    │       │   └── [dirId]/
    │       │       └── route.ts              # PUT (重命名/移动), DELETE (删除)
    │       ├── files/
    │       │   ├── route.ts                  # GET (列表), POST (创建)
    │       │   └── [fileId]/
    │       │       └── route.ts              # GET (详情), PUT (更新), DELETE (删除)
    │       ├── import/
    │       │   └── route.ts                  # POST (导入压缩包)
    │       └── export/
    │           └── route.ts                  # GET (导出为压缩包)
```

**理由**: RESTful 嵌套资源路径清晰表达隶属关系。将 directories、files、import、export 挂在项目下，确保所有操作都在项目上下文中。

### Decision 4: 按业务域组织代码（dbt 域）

**选择**: 所有新增代码按 `dbt` 业务域组织到对应子目录下，而非平铺在根目录。

```
src/app/server/repositories/
└── dbt/
    ├── project.repository.ts      # dbt_projects 表操作
    ├── directory.repository.ts    # dbt_directories 表操作
    └── file.repository.ts         # dbt_files 表操作

src/app/server/services/
└── dbt/
    ├── project.service.ts         # 项目 CRUD、状态管理
    ├── directory.service.ts       # 目录树操作、path 计算、级联删除
    ├── file.service.ts            # 文件 CRUD、fileType 检测、size 计算
    └── import-export.service.ts   # 压缩包解析、目录重建、事务编排

src/app/server/schemas/
└── dbt/
    ├── project.schema.ts          # 项目相关 Zod 验证
    ├── directory.schema.ts        # 目录相关 Zod 验证
    ├── file.schema.ts             # 文件相关 Zod 验证
    └── pagination.schema.ts       # 分页参数验证
```

**理由**: 遵循 AGENTS.md 的 Feature-based organization 原则。按业务域组织便于后续扩展其他域（如 `scheduler`、`connection` 等），避免所有文件混在一个目录。API 路由已在 `/api/dbt/` 下天然按域隔离，service/repository/schema 层应保持一致。

### Decision 6: 导入导出使用 ZIP 格式

**选择**: 项目导入接受 `.zip` 文件，导出生成 `.zip` 文件。

**理由**: ZIP 是 dbt 项目分发的标准格式，Next.js 可通过 Node.js 内置的 `zlib` 或第三方库处理。文件内容存储在数据库中，导出时按 path 重建目录树。

### Decision 7: 分页使用 limit/offset 模式

**选择**: 使用 `limit` + `offset` 分页。

**理由**: 遵循 AGENTS.md 的 Pagination Rules。项目列表场景数据量可控，offset 分页足够且实现简单。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 大型 dbt 项目（数千文件）导入性能 | 导入接口可能超时 | 使用数据库事务批量写入，后续可改为异步任务 |
| 文件内容存储在数据库 | 数据库体积增长快 | 当前阶段可接受，后续可迁移到对象存储 |
| path 冗余字段一致性 | 移动目录时需级联更新所有子路径 | 在 service 层事务中统一更新，禁止前端直接修改 path |
| SQLite 的递归查询限制 | 树形查询性能较差 | MySQL 为主要数据库，SQLite 仅用于开发环境 |

### Decision 8: 业务配置集中管理

**选择**: 将 ZIP 大小上限、支持的文件类型等可调参数集中到配置文件中管理。

```
src/app/server/configs/
└── dbt/
    └── constants.ts              # dbt 域业务常量
```

配置项示例：
- `MAX_IMPORT_FILE_SIZE`: ZIP 导入文件大小上限（默认 50MB）
- `SUPPORTED_FILE_TYPES`: 支持的文件类型列表 `['sql', 'yml', 'yaml', 'md', 'py', 'csv', 'json', 'txt']`
- `SKIP_IMPORT_FILES`: 导入时跳过的文件名列表 `['dbt_project.yml', 'packages.yml']`
- `DEFAULT_PAGE_SIZE`: 默认分页大小（默认 20）
- `MAX_PAGE_SIZE`: 最大分页大小（默认 100）

**理由**: 避免在 service/repository 中硬编码魔法值，后续调整只需改配置文件，无需改动业务逻辑。

### Decision 9: 文件编码统一 UTF-8

**选择**: 所有文件内容统一使用 UTF-8 编码，数据库中不额外存储编码字段。

**理由**: dbt 项目文件（SQL、YAML、Python、Markdown）标准编码均为 UTF-8，无需支持多编码。简化数据模型和文件处理逻辑。

## Open Questions

- dbt_project.yml 的系统级连接配置存储方案（后续单独设计，不在本次范围内）
