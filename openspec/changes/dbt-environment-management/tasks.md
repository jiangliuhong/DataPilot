## 1. 基础设施

- [x] 1.1 创建 `src/app/server/lib/crypto.ts` — AES-256-GCM 加密/解密工具函数（`encrypt`、`decrypt`），密钥从 `DBT_ENCRYPTION_KEY` 环境变量读取，密钥缺失时抛出明确错误
- [x] 1.2 在 `src/app/server/configs/dbt/constants.ts` 中追加新常量：`DB_TYPE_ADAPTER_MAP`（数据库类型到适配器包的静态映射表）、`SUPPORTED_DATABASE_TYPES`（支持的数据库类型数组）
- [x] 1.3 在 `.env.example` 中添加 `DBT_ENCRYPTION_KEY` 说明

## 2. 数据库 Schema

- [x] 2.1 创建 `src/app/db/schema/dbt-version.ts` — `dbt_versions` 表定义（id、name、version、adapter_packages JSON、dependencies JSON、status enum、时间戳），导出 `DbtVersion` 和 `NewDbtVersion` 类型
- [x] 2.2 创建 `src/app/db/schema/dbt-database-connection.ts` — `dbt_database_connections` 表定义（id、name、database_type enum、host、port、database_name、schema_name、username、encrypted_password、extra_config JSON、status enum、时间戳），导出类型
- [x] 2.3 创建 `src/app/db/schema/dbt-runtime-environment.ts` — `dbt_runtime_environments` 表定义（id、name、version_id FK、connection_id FK、status enum、时间戳），导出类型
- [x] 2.4 创建 `src/app/db/schema/dbt-project-environment.ts` — `dbt_project_environments` 表定义（id、project_id FK、environment_id FK、environment_alias、时间戳、唯一约束），导出类型
- [x] 2.5 在 `src/app/db/schema/index.ts` 中追加 4 个新 schema 的 re-export
- [x] 2.6 在 `src/app/db/relations/dbt.ts` 中追加 4 张新表的 relations 定义（版本→环境、连接→环境、环境→项目绑定、项目→项目绑定）
- [x] 2.7 执行 `drizzle-kit generate` 生成 migration 文件，检查生成的 SQL 正确性

## 3. Zod Validation Schema

- [x] 3.1 创建 `src/app/server/schemas/dbt/version.schema.ts` — `createVersionSchema`（name、version、adapterPackages JSON 数组校验含 name/version/supportedDatabases、dependencies JSON 数组校验含 name/version）、`updateVersionSchema`、`versionIdSchema`、`listVersionsQuerySchema`（支持 version 和 status 过滤）
- [x] 3.2 创建 `src/app/server/schemas/dbt/connection.schema.ts` — `createConnectionSchema`（name、databaseType 枚举校验、host、port 1-65535、databaseName、username、password）、`updateConnectionSchema`（password 可选）、`connectionIdSchema`、`listConnectionsQuerySchema`
- [x] 3.3 创建 `src/app/server/schemas/dbt/environment.schema.ts` — `createEnvironmentSchema`（name、versionId、connectionId）、`updateEnvironmentSchema`、`environmentIdSchema`、`listEnvironmentsQuerySchema`
- [x] 3.4 创建 `src/app/server/schemas/dbt/project-environment.schema.ts` — `bindEnvironmentSchema`（environmentId 必填、environmentAlias 可选）、`unbindEnvironmentSchema`

## 4. Repository 层

- [x] 4.1 创建 `src/app/server/repositories/dbt/version.repository.ts` — CRUD 函数：`createVersion`、`findById`、`findByName`、`findList`（支持 version 和 status 过滤、分页）、`updateById`、`softDeleteById`
- [x] 4.2 创建 `src/app/server/repositories/dbt/connection.repository.ts` — CRUD 函数：`createConnection`、`findById`、`findByName`、`findList`（支持 databaseType 和 status 过滤、分页）、`updateById`、`softDeleteById`
- [x] 4.3 创建 `src/app/server/repositories/dbt/environment.repository.ts` — CRUD 函数：`createEnvironment`、`findById`（含关联的版本和连接摘要）、`findByName`、`findList`（支持 status 过滤、分页）、`updateById`、`softDeleteById`、`existsByVersionId`、`existsByConnectionId`（引用检查用）
- [x] 4.4 创建 `src/app/server/repositories/dbt/project-environment.repository.ts` — 绑定操作：`createBinding`、`findBinding`（按 projectId + environmentId 查重）、`findListByProjectId`（含环境详情）、`softDeleteById`、`existsByEnvironmentId`（引用检查用）

## 5. Service 层

- [x] 5.1 创建 `src/app/server/services/dbt/version.service.ts` — 转发 repository 的 CRUD 操作；`deleteVersion` 增加引用检查（存在关联运行环境时拒绝删除返回 409）
- [x] 5.2 创建 `src/app/server/services/dbt/connection.service.ts` — 创建/更新时调用 `crypto.encrypt` 加密 password 后存入 `encryptedPassword`；查询时移除 `encryptedPassword` 并附加 `hasPassword: boolean`；`deleteConnection` 增加引用检查
- [x] 5.3 创建 `src/app/server/services/dbt/environment.service.ts` — 创建/更新时调用适配器兼容性校验函数（从版本的 `adapterPackages` 中查找匹配连接 `databaseType` 的适配器包，未找到抛出错误）；`deleteEnvironment` 增加引用检查（存在项目绑定时拒绝删除）
- [x] 5.4 创建 `src/app/server/services/dbt/project-environment.service.ts` — 绑定前校验项目和环境存在性、绑定去重；解绑前校验绑定关系存在性；查询绑定列表含环境详情

## 6. API Route 层

- [x] 6.1 创建 `src/app/api/dbt/versions/route.ts` — GET 列表（解析 listVersionsQuerySchema、调用 service）+ POST 创建（解析 createVersionSchema、检查 name 去重、调用 service）
- [x] 6.2 创建 `src/app/api/dbt/versions/[id]/route.ts` — GET 详情 + PUT 更新 + DELETE 删除
- [x] 6.3 创建 `src/app/api/dbt/connections/route.ts` — GET 列表 + POST 创建
- [x] 6.4 创建 `src/app/api/dbt/connections/[id]/route.ts` — GET 详情 + PUT 更新 + DELETE 删除
- [x] 6.5 创建 `src/app/api/dbt/environments/route.ts` — GET 列表 + POST 创建
- [x] 6.6 创建 `src/app/api/dbt/environments/[id]/route.ts` — GET 详情 + PUT 更新 + DELETE 删除
- [x] 6.7 创建 `src/app/api/dbt/projects/[id]/environments/route.ts` — GET 绑定列表 + POST 绑定环境
- [x] 6.8 创建 `src/app/api/dbt/projects/[id]/environments/[envId]/route.ts` — DELETE 解绑

## 7. 验证

- [x] 7.1 启动应用，确认无编译错误
- [x] 7.2 使用 API 工具验证版本管理完整 CRUD 流程（创建→查询→更新→删除）
- [x] 7.3 验证 `version` 字段支持 `"latest"` 值，可创建多条 latest 版本
- [x] 7.4 验证数据库连接 CRUD，确认密码加密存储且 API 响应不含密码原文
- [x] 7.5 验证 4 种数据库类型（mysql5/mysql8/starrocks/postgresql）均能创建连接
- [x] 7.6 验证运行环境创建时的适配器兼容性校验：兼容通过和不通过两种情况
- [x] 7.7 验证更新运行环境的版本或连接时触发重新校验
- [x] 7.8 验证环境绑定/解绑流程，确认多对多关系正常
- [x] 7.9 验证引用保护：版本/连接被环境引用时删除返回 409，环境被项目绑定时删除返回 409
- [x] 7.10 验证所有输入校验：缺少必填字段、类型错误、超长字段均返回 400
