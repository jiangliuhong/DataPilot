"use client";

import { Table, Card, Button, Chip } from "@heroui/react";

interface ContentPanelProps {
  activeKey: string;
}

const mockProjects = [
  {
    id: "1",
    name: "电商数据分析平台",
    status: "进行中",
    createdAt: "2026-05-20",
    description: "基于用户行为数据的电商分析平台",
  },
  {
    id: "2",
    name: "IoT 设备监控系统",
    status: "已完成",
    createdAt: "2026-04-15",
    description: "实时监控 IoT 设备状态与异常告警",
  },
  {
    id: "3",
    name: "用户画像引擎",
    status: "进行中",
    createdAt: "2026-05-28",
    description: "多维度用户标签与画像构建系统",
  },
  {
    id: "4",
    name: "供应链优化系统",
    status: "暂停",
    createdAt: "2026-03-10",
    description: "供应链全链路数据分析与优化建议",
  },
];

const statusColorMap: Record<string, "primary" | "success" | "default"> = {
  进行中: "primary",
  已完成: "success",
  暂停: "default",
};

function DashboardContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">仪表盘</h2>
        <p className="text-default-500 mt-1">欢迎使用 DataPilot 数据管理平台</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "项目总数", value: "4", desc: "2 个进行中" },
          { title: "数据源", value: "12", desc: "3 个异常" },
          { title: "今日任务", value: "8", desc: "5 已完成" },
        ].map((stat) => (
          <Card key={stat.title}>
            <Card.Content className="p-4">
              <p className="text-sm text-default-500">{stat.title}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-default-400 mt-1">{stat.desc}</p>
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProjectListContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">项目列表</h2>
          <p className="text-default-500 mt-1">管理所有数据项目</p>
        </div>
        <Button variant="primary" size="sm">
          + 新建项目
        </Button>
      </div>

      <Card>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="项目列表" className="min-w-[600px]">
                <Table.Header>
                  <Table.Column isRowHeader>项目名称</Table.Column>
                  <Table.Column>状态</Table.Column>
                  <Table.Column>描述</Table.Column>
                  <Table.Column>创建时间</Table.Column>
                  <Table.Column>操作</Table.Column>
                </Table.Header>
                <Table.Body>
                  {mockProjects.map((project) => (
                    <Table.Row key={project.id} id={project.id}>
                      <Table.Cell>
                        <span className="font-medium">{project.name}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip color={statusColorMap[project.status] ?? "default"} variant="soft" size="sm">
                          {project.status}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-default-500 text-sm">{project.description}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-default-400 text-sm">{project.createdAt}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <Button variant="light" size="sm">
                          查看
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
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
        <Card.Content className="flex flex-col items-center justify-center py-12">
          <p className="text-default-400">功能开发中，敬请期待...</p>
        </Card.Content>
      </Card>
    </div>
  );
}

const contentMap: Record<string, React.ReactNode> = {
  dashboard: <DashboardContent />,
  "project-list": <ProjectListContent />,
  "system-settings": <PlaceholderContent title="设置" description="系统配置与参数管理" />,
  "system-users": <PlaceholderContent title="用户" description="用户管理与权限配置" />,
};

export default function ContentPanel({ activeKey }: ContentPanelProps) {
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
