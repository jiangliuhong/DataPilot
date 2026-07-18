"use client";

import { useState } from "react";
import { Button, Chip, ListBox, Select, Table } from "@heroui/react";
import { projectApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import Pagination from "@/web/components/shared/pagination";
import ConfirmModal from "@/web/components/shared/confirm-modal";
import ProjectFormModal from "./project-form-modal";
import { useProjects } from "../hooks/use-projects";
import type { Project } from "@/web/types/dbt";

const statusColorMap: Record<string, "accent" | "default"> = {
  active: "accent",
  archived: "default",
};

interface ProjectListProps {
  onViewDetail?: (projectId: number) => void;
}

export default function ProjectList({ onViewDetail }: ProjectListProps) {
  const { data, loading, params, setFilters, setPage, refresh } = useProjects();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (formData: {
    name: string;
    description?: string;
  }) => {
    await projectApi.create(formData);
    showSuccess("项目创建成功");
    refresh();
  };

  const handleUpdate = async (formData: {
    name: string;
    description?: string;
  }) => {
    if (!editingProject) return;
    await projectApi.update(editingProject.id, formData);
    showSuccess("项目更新成功");
    setEditingProject(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectApi.delete(deleteTarget.id);
      showSuccess("项目删除成功");
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      showError(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">项目列表</h2>
          <p className="text-default-500 mt-1">管理所有 dbt 项目</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onPress={() => {
            setEditingProject(null);
            setFormOpen(true);
          }}
        >
          + 新建项目
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          className="w-[160px]"
          placeholder="全部状态"
          selectedKey={params.status ?? ""}
          onChange={(key) => {
            const val = key as string;
            setFilters({ status: val === "__all__" ? undefined : val });
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__all__" textValue="全部状态">全部状态</ListBox.Item>
              <ListBox.Item id="active" textValue="活跃">活跃</ListBox.Item>
              <ListBox.Item id="archived" textValue="已归档">已归档</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-default-400">加载中...</div>
      ) : !data?.items.length ? (
        <div className="py-12 text-center text-default-400">
          暂无项目，点击右上角新建
        </div>
      ) : (
        <Table>
          <Table.Content aria-label="项目列表">
            <Table.Header>
              <Table.Column isRowHeader>项目名称</Table.Column>
              <Table.Column>状态</Table.Column>
              <Table.Column>描述</Table.Column>
              <Table.Column>创建时间</Table.Column>
              <Table.Column>操作</Table.Column>
            </Table.Header>
            <Table.Body>
              {data.items.map((project) => (
                <Table.Row key={project.id}>
                  <Table.Cell>
                    <span className="font-medium">{project.name}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip
                      color={statusColorMap[project.status] ?? "default"}
                      variant="soft"
                      size="sm"
                    >
                      {project.status === "active" ? "活跃" : "已归档"}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-default-500">
                      {project.description ?? "-"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-default-400">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => onViewDetail?.(project.id)}
                      >
                        查看
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          window.open(`/editor/projects/${project.id}`, "_blank")
                        }
                      >
                        文件编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setEditingProject(project);
                          setFormOpen(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onPress={() => setDeleteTarget(project)}
                      >
                        删除
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table>
      )}

      {data && (
        <Pagination
          total={data.total}
          limit={params.limit ?? 20}
          offset={params.offset ?? 0}
          onChange={setPage}
        />
      )}

      <ProjectFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingProject(null);
        }}
        onSubmit={editingProject ? handleUpdate : handleCreate}
        project={editingProject}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除项目"
        message={`确认删除项目 "${deleteTarget?.name}"？此操作不可撤销。`}
      />
    </div>
  );
}
