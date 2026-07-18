## Why

DataPilot 已完成 dbt 项目管理模块（项目、目录、文件的 CRUD 和导入导出），但项目目前无法关联具体的运行环境。用户需要在平台上管理 dbt Core 的不同版本、配置数据库连接，并将二者组合为可运行的 dbt 执行环境后绑定到项目，才能开展后续的 dbt 编译、测试和运行任务。

## What Changes

- 新增 **dbt Core 版本管理**：支持注册和维护多个 dbt Core 版本，每个版本记录其支持适配器列表（如 dbt-mysql、dbt-postgres、dbt-starrocks），用于创建环境时的兼容性校验。
- 新增 **dbt Core 依赖管理**：每个版本下可声明所需的 Python 包及其版本约束（如 `dbt-core==1.8.0`、`dbt-mysql==1.8.0`），作为环境创建和依赖安装的依据。
- 新增 **数据库连接管理**：支持创建和管理数据库连接配置（host、port、database、schema、credentials），覆盖 MySQL 5、MySQL 8、StarRocks、PostgreSQL 四种数据库类型。连接信息加密存储敏感字段。
- 新增 **运行环境管理**：将一个 dbt Core 版本与一个数据库连接组合为运行环境，创建时校验该版本的适配器包是否支持目标数据库类型。运行环境具备独立状态（active/inactive）。
- 新增 **环境-项目绑定**：支持将运行环境绑定到 dbt 项目，一个项目可绑定多个环境（用于 dev/staging/prod 等场景），一个环境也可被多个项目复用。

## Capabilities

### New Capabilities

- `dbt-version`: dbt Core 版本管理——版本的注册、查询、更新、删除，每个版本维护其适配器包列表和 Python 依赖清单。
- `dbt-database-connection`: 数据库连接管理——连接的创建、查询、更新、删除，支持 MySQL 5、MySQL 8、StarRocks、PostgreSQL 四种数据库，敏感信息加密存储。连通性测试（通过 dbt debug 命令）不在本次 scope 内，后续随 dbt 任务执行功能一起实现。
- `dbt-runtime-environment`: 运行环境管理——基于 dbt 版本 + 数据库连接组合创建运行环境，创建时执行适配器兼容性校验，环境状态生命周期管理。
- `dbt-project-environment`: 项目环境绑定——运行环境与 dbt 项目的多对多绑定关系管理，属于项目域而非公共配置。

### Modified Capabilities

（无——本次变更不修改已有 spec 的需求层面）

## Impact

- **数据库 Schema**：新增 `dbt_versions`、`dbt_database_connections`、`dbt_runtime_environments` 三张公共配置表，以及 `dbt_project_environments` 项目侧绑定表。
- **API 路由**：在 `app/api/dbt/` 下新增版本、连接、环境三组公共端点，以及 `app/api/dbt/projects/[id]/environments/` 项目侧绑定端点。
- **Repository 层**：在 `app/server/repositories/dbt/` 下新增版本、连接、环境三个公共 repository，项目绑定逻辑复用已有的 project.repository.ts。
- **Service 层**：在 `app/server/services/dbt/` 下新增对应 service 文件，环境创建 service 包含适配器兼容性校验逻辑，项目环境绑定 service 归入项目域。
- **Validation 层**：在 `app/server/schemas/dbt/` 下新增对应 Zod schema 文件。
- **Config 层**：在 `app/server/configs/dbt/` 中补充数据库类型枚举、适配器兼容性映射表等常量。
- **前端（后续）**：需在 `web/features/dbt/` 下新增对应页面和组件（本次变更 scope 为后端 + spec，前端另排）。
- **依赖**：可能需要引入加密库（如 `crypto` 内置模块或 `bcryptjs`）用于敏感字段加密。
