## Why

后端 17 个 dbt API 端点（项目管理、目录/文件管理、版本管理、数据库连接管理、运行环境管理、项目环境绑定、导入导出）已全部实现，但前端没有任何对应的 UI 页面。当前侧边栏仅包含仪表盘占位和硬编码的 mock 数据，无法对 dbt 资源进行实际操作。需要构建完整的前端管理界面，让用户可以通过 Web 界面对 dbt 项目和系统配置进行 CRUD 管理。

## What Changes

- 新增**项目管理页面**：项目列表（带分页、状态过滤）、创建/编辑/删除项目、查看项目详情、项目内目录树浏览、文件管理（创建/编辑/删除）、ZIP 导入导出、项目环境绑定管理
- 新增**系统设置侧边栏分组**，包含 3 个子页面：
  - **dbt 版本管理**：版本列表（带分页、版本号/状态过滤）、创建/编辑/删除版本、展示适配器包和依赖详情
  - **数据库连接管理**：连接列表（带分页、类型/状态过滤）、创建/编辑/删除连接、连接详情查看（密码字段脱敏）
  - **运行环境管理**：环境列表（带分页、状态过滤）、创建/编辑/删除环境、展示关联的版本和连接信息
- 新增 `api-client` 层：封装所有 `/api/dbt/*` 的 HTTP 请求，提供类型安全的调用接口
- 更新侧边栏导航菜单配置：增加"系统设置"分组及子菜单项，将"项目管理"接入真实 API
- 更新 `ContentPanel`：根据 activeKey 路由到各功能页面组件

## Capabilities

### New Capabilities
- `project-management-ui`: 项目管理前端页面——项目列表、创建/编辑弹窗、删除确认、目录树浏览、文件编辑器、ZIP 导入导出、项目环境绑定管理
- `dbt-version-ui`: dbt 版本管理前端页面——版本列表、创建/编辑弹窗（含动态适配器包和依赖表单）、删除确认
- `database-connection-ui`: 数据库连接管理前端页面——连接列表、创建/编辑弹窗（含密码输入、数据库类型选择）、删除确认
- `runtime-environment-ui`: 运行环境管理前端页面——环境列表、创建/编辑弹窗（含版本和连接选择器）、删除确认
- `dbt-api-client`: 前端 API 客户端层——封装所有 `/api/dbt/*` 端点，提供类型安全的请求函数
- `sidebar-system-settings`: 侧边栏系统设置导航——新增分组菜单、子菜单项、activeKey 路由映射

### Modified Capabilities
<!-- 无现有 spec 需要修改，前端为全新构建 -->

## Impact

- **前端代码**：`src/web/` 下新增 api-client（~10 文件）、features（4 个功能模块，各含 components 和 hooks）、更新 components/layout（sidebar 菜单配置、content-panel 路由）
- **前端依赖**：可能需要新增 `@heroui/modal`、`@heroui/form`、`@heroui/select`、`@heroui/tabs`、`@heroui/dropdown` 等 HeroUI 组件（需检查当前 bundle 是否已全量引入）
- **后端代码**：无变更，所有 17 个 API 端点已就绪
- **数据库**：无变更，7 张表及 migration 已就绪
- **API 接口**：无变更，前端对接现有 `/api/dbt/*` 端点
