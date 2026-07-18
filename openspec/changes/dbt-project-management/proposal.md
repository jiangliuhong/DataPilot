## Why

dbt（data build tool）项目包含多种资源文件（models、snapshots、seeds、tests、macros、analyses 等），这些文件通常散布在文件系统中，缺乏统一的管理、版本追踪和协作能力。`dbt_project.yml` 和 `packages.yml` 属于系统级配置，由系统单独管理，不纳入项目文件管理范围。DataPilot 需要将 dbt 工程的目录结构和资源文件内容持久化到数据库中，通过后端 API 对项目进行增删改查、目录浏览和文件管理，为后续的可视化编辑、版本对比和团队协作奠定基础。

本次改动仅聚焦后端 API 层，暂不涉及前端界面。

## What Changes

- 新增数据库表结构，用于存储 dbt 项目元数据、目录树和文件内容
- 新增项目 CRUD API：创建、查询、更新、删除 dbt 项目
- 新增目录管理 API：在项目内创建、重命名、删除、移动目录
- 新增文件管理 API：在目录内创建、读取、更新、删除文件
- 新增项目导入 API：接收上传的 dbt 工程压缩包，解析后存入数据库
- 新增项目导出 API：将数据库中的项目导出为标准 dbt 工程目录结构
- 新增 Zod 验证 schema，确保 API 入参和出参的类型安全
- 新增 `docs/api.html` 接口文档，说明所有新增 API 的用法
- 生成 Drizzle 迁移文件

## Capabilities

### New Capabilities

- `dbt-project-crud`: dbt 项目的创建、查询（单个/列表/分页）、更新（名称/描述）、删除（软删除），以及项目级别的状态管理。`dbt_project.yml` 中的连接信息作为系统级配置单独存储，不属于项目文件管理范围
- `dbt-directory-management`: dbt 项目内的目录树管理，包括目录的创建、重命名、移动、删除，支持递归目录结构（对应 dbt 的 models/、snapshots/、seeds/、macros/ 等标准目录）
- `dbt-file-management`: dbt 项目内的文件管理，包括文件的创建、读取、更新、删除，支持 SQL、YAML、Markdown、Python 等文件类型，记录文件内容、路径和元数据
- `dbt-project-import-export`: dbt 工程的批量导入（解析压缩包写入数据库）和导出（从数据库重建标准 dbt 目录结构并打包下载）
- `api-documentation`: 在 `docs/api.html` 中提供所有新增 API 的完整说明文档，包含请求示例和响应格式

### Modified Capabilities

（无现有能力需要修改，此为首个功能开发）

## Impact

- **数据库**: 新增 3 张核心表（`dbt_projects`、`dbt_directories`、`dbt_files`），以及系统级连接配置存储，需要运行 Drizzle 迁移
- **API 路由**: 在 `src/app/api/` 下新增约 10+ 个端点
- **服务层**: 新增项目、目录、文件三个领域的 service 和 repository
- **验证层**: 新增 Zod schema 定义
- **文档**: 新增 `docs/api.html` 接口文档
- **依赖**: 无新增外部依赖，使用现有的 Drizzle ORM、Zod 和 Next.js API Routes
