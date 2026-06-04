## 1. 基础设施

- [x] 1.1 创建 dbt 域目录结构（repositories/dbt/、services/dbt/、schemas/dbt/、configs/dbt/）
- [x] 1.2 创建业务常量配置文件 `src/app/server/configs/dbt/constants.ts`（MAX_IMPORT_FILE_SIZE、SUPPORTED_FILE_TYPES、SKIP_IMPORT_FILES、DEFAULT_PAGE_SIZE、MAX_PAGE_SIZE）
- [x] 1.3 创建通用分页 Zod schema `src/app/server/schemas/dbt/pagination.schema.ts`（limit、offset、status 过滤参数验证）

## 2. 数据库 Schema

- [x] 2.1 创建 `src/app/db/schema/dbt-project.ts`（dbt_projects 表定义：id、name、description、status、createdAt、updatedAt、deletedAt）
- [x] 2.2 创建 `src/app/db/schema/dbt-directory.ts`（dbt_directories 表定义：id、projectId、parentId、name、path、depth、sortOrder、createdAt、updatedAt、deletedAt）
- [x] 2.3 创建 `src/app/db/schema/dbt-file.ts`（dbt_files 表定义：id、projectId、directoryId、name、path、content、fileType、size、createdAt、updatedAt、deletedAt）
- [x] 2.4 创建 `src/app/db/relations/dbt.ts`（dbt_projects → dbt_directories 一对多、dbt_projects → dbt_files 一对多、dbt_directories 自引用、dbt_directories → dbt_files 一对多）
- [x] 2.5 更新 `src/app/db/schema/index.ts` 和 `src/app/db/relations/index.ts` 导出新增的 schema 和 relations
- [x] 2.6 运行 `drizzle-kit generate` 生成迁移文件

## 3. Repository 层

- [x] 3.1 实现 `src/app/server/repositories/dbt/project.repository.ts`（create、findById、findList 含分页/状态过滤、updateById、softDeleteById、cascadeSoftDelete）
- [x] 3.2 实现 `src/app/server/repositories/dbt/directory.repository.ts`（create、findById、findByProjectId、findByParentId、buildTree、updateById、softDeleteById、softDeleteByPathPrefix、findByPathPrefix）
- [x] 3.3 实现 `src/app/server/repositories/dbt/file.repository.ts`（create、findById、findByProjectId 含分页/类型过滤、findByDirectoryId、updateById、softDeleteById、softDeleteByDirectoryIds）

## 4. Zod 验证 Schema

- [x] 4.1 实现 `src/app/server/schemas/dbt/project.schema.ts`（createProjectSchema：name 必填、description 可选；updateProjectSchema：name/description/status 可选；projectIdSchema：id 必填）
- [x] 4.2 实现 `src/app/server/schemas/dbt/directory.schema.ts`（createDirectorySchema：name 必填、parentId 可选；updateDirectorySchema：name/parentId 可选；directoryIdSchema）
- [x] 4.3 实现 `src/app/server/schemas/dbt/file.schema.ts`（createFileSchema：name 必填、directoryId 可选、content 必填；updateFileSchema：name/content/directoryId 可选；fileIdSchema；fileType 检测和校验逻辑）

## 5. Service 层

- [x] 5.1 实现 `src/app/server/services/dbt/project.service.ts`（createProject、getProject、listProjects、updateProject、deleteProject 含级联软删除目录和文件）
- [x] 5.2 实现 `src/app/server/services/dbt/directory.service.ts`（createDirectory 含 path/depth 计算、listDirectories、getDirectoryTree、renameDirectory 含级联 path 更新、moveDirectory 含循环检测和级联 path 更新、deleteDirectory 含级联递归软删除）
- [x] 5.3 实现 `src/app/server/services/dbt/file.service.ts`（createFile 含 fileType 自动检测、size 计算、path 生成；getFile、listFiles 含分页和类型过滤、updateFile 含 path 重算、deleteFile）
- [x] 5.4 实现 `src/app/server/services/dbt/import-export.service.ts`（importProject：解析 ZIP、跳过系统配置文件、创建目录和文件、事务包裹；exportProject：查询目录树和文件、按 path 重建 ZIP）

## 6. API 路由

- [x] 6.1 实现 `src/app/api/dbt/projects/route.ts`（GET 项目列表 + POST 创建项目）
- [x] 6.2 实现 `src/app/api/dbt/projects/[id]/route.ts`（GET 项目详情 + PUT 更新项目 + DELETE 软删除项目）
- [x] 6.3 实现 `src/app/api/dbt/projects/[id]/tree/route.ts`（GET 完整目录树）
- [x] 6.4 实现 `src/app/api/dbt/projects/[id]/directories/route.ts`（GET 目录列表 + POST 创建目录）
- [x] 6.5 实现 `src/app/api/dbt/projects/[id]/directories/[dirId]/route.ts`（PUT 重命名/移动目录 + DELETE 删除目录）
- [x] 6.6 实现 `src/app/api/dbt/projects/[id]/files/route.ts`（GET 文件列表含分页/类型过滤 + POST 创建文件）
- [x] 6.7 实现 `src/app/api/dbt/projects/[id]/files/[fileId]/route.ts`（GET 文件详情 + PUT 更新文件 + DELETE 删除文件）
- [x] 6.8 实现 `src/app/api/dbt/projects/[id]/import/route.ts`（POST 导入 ZIP 文件）
- [x] 6.9 实现 `src/app/api/dbt/projects/[id]/export/route.ts`（GET 导出为 ZIP）

## 7. 文档

- [x] 7.1 创建 `docs/api.html` 接口文档，覆盖全部 16 个 API 端点（含中文说明、请求/响应示例、错误码说明、目录导航）
