"use client";

import ProjectList from "@/web/features/project/components/project-list";
import ProjectDetail from "@/web/features/project/components/project-detail";
import VersionList from "@/web/features/dbt-version/components/version-list";
import ConnectionList from "@/web/features/dbt-connection/components/connection-list";
import EnvironmentList from "@/web/features/dbt-environment/components/environment-list";
import { Card } from "@heroui/react";

interface ContentPanelProps {
  activeKey: string;
  onViewChange?: (key: string, params?: Record<string, unknown>) => void;
  viewParams?: Record<string, unknown>;
}

function DashboardContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">仪表盘</h2>
        <p className="text-default-500 mt-1">欢迎使用 DataPilot 数据管理平台</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "项目总数", value: "—", desc: "加载中" },
          { title: "数据源", value: "—", desc: "" },
          { title: "运行环境", value: "—", desc: "" },
        ].map((stat) => (
          <Card key={stat.title}>
            <div className="p-4">
              <p className="text-sm text-default-500">{stat.title}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-default-400 mt-1">{stat.desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PlaceholderContent({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-default-500 mt-1">{description}</p>
      </div>
      <Card>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-default-400">功能开发中，敬请期待...</p>
        </div>
      </Card>
    </div>
  );
}

export default function ContentPanel({
  activeKey,
  onViewChange,
  viewParams,
}: ContentPanelProps) {
  const handleViewDetail = (projectId: number) => {
    onViewChange?.("project-detail", { projectId });
  };

  const handleBackToList = () => {
    onViewChange?.("project-list");
  };

  if (activeKey === "project-detail") {
    const projectId = viewParams?.projectId as number;
    if (!projectId) return null;
    return (
      <div className="p-6">
        <ProjectDetail projectId={projectId} onBack={handleBackToList} />
      </div>
    );
  }

  const contentMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardContent />,
    "project-list": <ProjectList onViewDetail={handleViewDetail} />,
    "dbt-version-list": <VersionList />,
    "dbt-connection-list": <ConnectionList />,
    "dbt-environment-list": <EnvironmentList />,
    "system-settings": <PlaceholderContent title="设置" description="系统配置与参数管理" />,
    "system-users": <PlaceholderContent title="用户" description="用户管理与权限配置" />,
  };

  return (
    <div className="p-6">
      {contentMap[activeKey] ?? (
        <div className="flex items-center justify-center h-full">
          <p className="text-default-400">请从左侧菜单选择功能</p>
        </div>
      )}
    </div>
  );
}
