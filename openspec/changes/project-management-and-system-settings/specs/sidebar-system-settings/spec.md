## ADDED Requirements

### Requirement: Hierarchical menu support
系统 SHALL 支持 MenuItem 类型中的 `group` 字段用于菜单分组，以及 `children` 字段用于子菜单。侧边栏 SHALL 按 group 分组渲染，同一 group 下的菜单项归为一组，组间显示分隔线。

#### Scenario: Render grouped menu items
- **WHEN** MenuItem 包含 `group: "system-settings"` 的多个子菜单项
- **THEN** 侧边栏 SHALL 在"系统设置"分组标题下渲染这些子菜单项，缩进显示

### Requirement: System settings menu group
侧边栏 SHALL 在"项目管理"和"用户"之间新增"系统设置"分组，包含 3 个子菜单项："dbt 版本管理"、"数据库连接管理"、"运行环境管理"。

#### Scenario: Navigate to dbt version management
- **WHEN** 用户点击侧边栏"dbt 版本管理"
- **THEN** 系统 SHALL 设置 activeKey 为 "dbt-version-list" 并在内容区渲染版本管理页面

#### Scenario: Navigate to database connection management
- **WHEN** 用户点击侧边栏"数据库连接管理"
- **THEN** 系统 SHALL 设置 activeKey 为 "dbt-connection-list" 并在内容区渲染连接管理页面

#### Scenario: Navigate to runtime environment management
- **WHEN** 用户点击侧边栏"运行环境管理"
- **THEN** 系统 SHALL 设置 activeKey 为 "dbt-environment-list" 并在内容区渲染环境管理页面

### Requirement: Content panel routing
ContentPanel SHALL 在 contentMap 中增加以下 activeKey 到页面组件的映射：`dbt-version-list` → 版本管理页、`dbt-connection-list` → 连接管理页、`dbt-environment-list` → 环境管理页。项目列表页 SHALL 使用真实 API 数据替换 mock 数据。

#### Scenario: Project list uses real API
- **WHEN** 用户切换到"项目管理"
- **THEN** ContentPanel SHALL 渲染调用真实 `/api/dbt/projects` 的项目列表组件，而非硬编码 mock 数据

### Requirement: Collapsed sidebar shows icons only
侧边栏折叠时，分组标题 SHALL 隐藏，子菜单项 SHALL 仅显示图标。系统设置分组 SHALL 有一个 Settings2 图标作为分组标识。

#### Scenario: Collapsed sidebar with system settings
- **WHEN** 侧边栏处于折叠状态
- **THEN** 系统设置下的子菜单项 SHALL 仅显示对应图标，不显示文字标签
