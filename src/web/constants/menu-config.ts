import type { MenuItem } from "@/web/types/menu";

export const menuItems: MenuItem[] = [
  { key: "dashboard", label: "仪表盘", icon: "LayoutDashboard" },
  { key: "project-list", label: "项目管理", icon: "FolderKanban" },
  { key: "agent-chat", label: "AI 助手", icon: "Bot" },
  {
    key: "system-settings",
    label: "系统设置",
    icon: "Settings2",
    group: "system-settings",
    children: [
      { key: "llm-config-list", label: "大模型配置", icon: "Cpu" },
      { key: "dbt-version-list", label: "dbt 版本管理", icon: "GitBranch" },
      { key: "dbt-connection-list", label: "数据库连接管理", icon: "Database" },
      { key: "dbt-environment-list", label: "运行环境管理", icon: "Server" },
    ],
  },
  { key: "system-users", label: "用户", icon: "Users" },
];
