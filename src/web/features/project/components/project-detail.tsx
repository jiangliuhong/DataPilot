"use client";

import { useState } from "react";
import { Button, Chip, Card } from "@heroui/react";
import { projectApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import { useProjectDetail } from "../hooks/use-project-detail";
import DirectoryTree from "./directory-tree";
import ProjectFileList from "./project-file-list";
import EnvironmentBinding from "./environment-binding";
import ImportExport from "./import-export";
import ProjectFormModal from "./project-form-modal";
import type { Project } from "@/web/types/dbt";

interface ProjectDetailProps {
  projectId: number;
  onBack: () => void;
}

export default function ProjectDetail({
  projectId,
  onBack,
}: ProjectDetailProps) {
  const { project, loading, refresh } = useProjectDetail(projectId);
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleUpdate = async (data: {
    name: string;
    description?: string;
  }) => {
    await projectApi.update(projectId, data);
    showSuccess("项目更新成功");
    setEditOpen(false);
    refresh();
  };

  const handleArchive = async () => {
    try {
      await projectApi.update(projectId, {
        status: project?.status === "active" ? "archived" : "active",
      });
      showSuccess(
        project?.status === "active" ? "项目已归档" : "项目已激活",
      );
      refresh();
    } catch (err) {
      showError(err);
    }
  };

  if (loading || !project) {
    return (
      <div className="py-8 text-center text-default-400">加载中...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onPress={onBack}>
            ← 返回
          </Button>
          <h2 className="text-2xl font-bold">{project.name}</h2>
          <Chip
            color={project.status === "active" ? "accent" : "default"}
            variant="soft"
            size="sm"
          >
            {project.status === "active" ? "活跃" : "已归档"}
          </Chip>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onPress={() => setEditOpen(true)}>
            编辑
          </Button>
          <Button size="sm" variant="ghost" onPress={handleArchive}>
            {project.status === "active" ? "归档" : "激活"}
          </Button>
          <ImportExport projectId={projectId} />
        </div>
      </div>

      {/* Info */}
      <Card>
        <Card.Content className="p-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-default-400">描述：</span>
            <span>{project.description ?? "-"}</span>
          </div>
          <div>
            <span className="text-default-400">创建时间：</span>
            <span>{new Date(project.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-default-400">更新时间：</span>
            <span>{new Date(project.updatedAt).toLocaleString()}</span>
          </div>
        </Card.Content>
      </Card>

      {/* Directory Tree + File List */}
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <Card>
          <Card.Content className="p-3">
            <h3 className="text-sm font-semibold mb-2">目录结构</h3>
            <DirectoryTree
              projectId={projectId}
              onSelect={setSelectedDirId}
              selectedDirId={selectedDirId}
            />
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="p-3">
            <h3 className="text-sm font-semibold mb-3">文件列表</h3>
            <ProjectFileList
              projectId={projectId}
              directoryId={selectedDirId}
            />
          </Card.Content>
        </Card>
      </div>

      {/* Environment Binding */}
      <Card>
        <Card.Content className="p-4">
          <h3 className="text-sm font-semibold mb-3">环境绑定</h3>
          <EnvironmentBinding projectId={projectId} />
        </Card.Content>
      </Card>

      <ProjectFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        project={project}
      />
    </div>
  );
}
