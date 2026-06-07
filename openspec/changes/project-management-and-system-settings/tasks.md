## 1. 基础设施

- [x] 1.1 扩展 MenuItem 类型定义（`src/web/types/menu.ts`），增加 `group?: string` 和 `children?: MenuItem[]` 字段
- [x] 1.2 创建 `src/web/api-client/request.ts` 基础请求工具：封装 fetch、JSON 序列化/反序列化、错误处理
- [x] 1.3 创建前端共享类型定义文件（`src/web/types/dbt.ts`），定义 Project、Directory、File、Version、Connection、Environment 等接口类型

## 2. API Client 层

- [x] 2.1 创建 `src/web/api-client/project.ts`：封装项目 CRUD + 导入导出 API
- [x] 2.2 创建 `src/web/api-client/directory.ts`：封装目录 CRUD + 树查询 API
- [x] 2.3 创建 `src/web/api-client/file.ts`：封装文件 CRUD + 分页过滤 API
- [x] 2.4 创建 `src/web/api-client/version.ts`：封装版本 CRUD + 分页过滤 API
- [x] 2.5 创建 `src/web/api-client/connection.ts`：封装连接 CRUD + 分页过滤 API
- [x] 2.6 创建 `src/web/api-client/environment.ts`：封装环境 CRUD + 分页过滤 API
- [x] 2.7 创建 `src/web/api-client/project-environment.ts`：封装项目环境绑定/解绑 API
- [x] 2.8 创建 `src/web/api-client/index.ts`：统一导出所有 API client

## 3. 侧边栏与导航

- [x] 3.1 更新 `src/web/constants/menu-config.ts`：增加系统设置分组及 3 个子菜单项（dbt 版本管理、数据库连接管理、运行环境管理）
- [x] 3.2 更新 `src/web/components/layout/sidebar.tsx`：支持 group 分组渲染和 children 子菜单缩进显示，折叠时仅显示图标
- [x] 3.3 更新侧边栏 iconMap：增加新菜单项所需的 lucide-react 图标（如 GitBranch、Database、Server 等）
- [x] 3.4 重构 `src/web/components/layout/content-panel.tsx`：移除 mock 数据和内联组件，改为从 contentMap 映射到各功能页面组件

## 4. 项目管理页面

- [x] 4.1 创建 `src/web/features/project/hooks/use-projects.ts`：项目列表数据获取 hook（含分页、过滤、loading/error 状态）
- [x] 4.2 创建 `src/web/features/project/components/project-list.tsx`：项目列表页组件（分页表格 + 状态筛选 + 新建按钮）
- [x] 4.3 创建 `src/web/features/project/components/project-form-modal.tsx`：项目创建/编辑 Modal 表单组件
- [x] 4.4 创建 `src/web/features/project/components/delete-confirm-modal.tsx`：通用删除确认弹窗组件
- [x] 4.5 创建 `src/web/features/project/hooks/use-project-detail.ts`：项目详情数据获取 hook
- [x] 4.6 创建 `src/web/features/project/components/project-detail.tsx`：项目详情页组件（基本信息展示 + 目录树 + 文件列表 + 环境绑定 + 导入导出）
- [x] 4.7 创建 `src/web/features/project/components/directory-tree.tsx`：目录树展示组件（可折叠嵌套树）
- [x] 4.8 创建 `src/web/features/project/components/project-file-list.tsx`：项目文件列表组件（分页 + 类型/目录过滤）
- [x] 4.9 创建 `src/web/features/project/components/environment-binding.tsx`：项目环境绑定管理组件（绑定列表 + 绑定/解绑操作）
- [x] 4.10 创建 `src/web/features/project/components/import-export.tsx`：ZIP 导入导出组件（文件上传 + 导出下载）
- [x] 4.11 更新 AppLayout 支持项目详情视图切换（activeKey 含项目 ID 参数）

## 5. dbt 版本管理页面

- [x] 5.1 创建 `src/web/features/dbt-version/hooks/use-versions.ts`：版本列表数据获取 hook（含分页、过滤）
- [x] 5.2 创建 `src/web/features/dbt-version/components/version-list.tsx`：版本列表页组件（分页表格 + 状态/版本号筛选）
- [x] 5.3 创建 `src/web/features/dbt-version/components/version-form-modal.tsx`：版本创建/编辑 Modal 表单（含动态适配器包和依赖列表表单行）
- [x] 5.4 创建 `src/web/features/dbt-version/components/version-detail-panel.tsx`：版本详情展开面板（显示适配器包和依赖列表）

## 6. 数据库连接管理页面

- [x] 6.1 创建 `src/web/features/dbt-connection/hooks/use-connections.ts`：连接列表数据获取 hook（含分页、过滤）
- [x] 6.2 创建 `src/web/features/dbt-connection/components/connection-list.tsx`：连接列表页组件（分页表格 + 类型/状态筛选）
- [x] 6.3 创建 `src/web/features/dbt-connection/components/connection-form-modal.tsx`：连接创建/编辑 Modal 表单（含数据库类型下拉、密码输入、端口验证）

## 7. 运行环境管理页面

- [x] 7.1 创建 `src/web/features/dbt-environment/hooks/use-environments.ts`：环境列表数据获取 hook（含分页、过滤、关联数据加载）
- [x] 7.2 创建 `src/web/features/dbt-environment/components/environment-list.tsx`：环境列表页组件（分页表格 + 显示版本名和连接名）
- [x] 7.3 创建 `src/web/features/dbt-environment/components/environment-form-modal.tsx`：环境创建/编辑 Modal 表单（含版本下拉选择器、连接下拉选择器）

## 8. 共享组件

- [x] 8.1 创建 `src/web/components/shared/pagination.tsx`：通用分页控件组件（上一页/下一页 + 页码显示）
- [x] 8.2 创建 `src/web/components/shared/confirm-modal.tsx`：通用确认弹窗组件（标题 + 内容 + 确认/取消按钮）
- [x] 8.3 创建 `src/web/components/shared/empty-state.tsx`：空状态占位组件
- [x] 8.4 创建 `src/web/components/shared/error-toast.tsx`：错误提示组件（用于展示 API 错误信息）

## 9. 集成与验证

- [x] 9.1 将所有页面组件注册到 ContentPanel 的 contentMap，确认侧边栏导航到各页面正常工作
- [ ] 9.2 验证项目管理完整流程：创建项目 → 查看详情 → 创建目录 → 上传文件 → 绑定环境 → 导出 ZIP
- [ ] 9.3 验证系统设置 3 个子页面：版本 CRUD、连接 CRUD、环境 CRUD 完整流程
- [ ] 9.4 验证错误处理：重复名称、引用删除、参数验证等场景的错误提示正常展示
- [ ] 9.5 验证侧边栏折叠/展开状态下所有菜单项正常显示和交互
