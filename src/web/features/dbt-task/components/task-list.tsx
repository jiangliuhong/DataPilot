"use client";

import { useState } from "react";
import { Button, Chip, Table } from "@heroui/react";
import { taskApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import Pagination from "@/web/components/shared/pagination";
import ConfirmModal from "@/web/components/shared/confirm-modal";
import TaskFormModal from "./task-form-modal";
import TaskRunLogPanel from "./task-run-log-panel";
import { useTasks } from "../hooks/use-tasks";
import type { Task, CreateTaskInput, UpdateTaskInput } from "@/web/types/dbt";

interface TaskListProps {
  projectId: number;
  projectName?: string;
}

/** 任务命令中文标签 */
const COMMAND_LABEL: Record<string, string> = {
  run: "run",
  build: "build",
  test: "test",
  compile: "compile",
  seed: "seed",
  snapshot: "snapshot",
};

export default function TaskList({ projectId }: TaskListProps) {
  const { data, loading, params, setPage, refresh } = useTasks(projectId);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [runTarget, setRunTarget] = useState<Task | null>(null);

  const handleCreate = async (
    formData: CreateTaskInput | (UpdateTaskInput & { command: Task["command"] }),
  ) => {
    await taskApi.create(formData as CreateTaskInput);
    showSuccess("任务创建成功");
    refresh();
  };

  const handleUpdate = async (
    formData: CreateTaskInput | (UpdateTaskInput & { command: Task["command"] }),
  ) => {
    if (!editingTask) return;
    await taskApi.update(editingTask.id, formData as UpdateTaskInput);
    showSuccess("任务更新成功");
    setEditingTask(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await taskApi.delete(deleteTarget.id);
      showSuccess("任务删除成功");
      // 清理与被删除任务相关的打开状态（S7）
      if (runTarget?.id === deleteTarget.id) setRunTarget(null);
      if (editingTask?.id === deleteTarget.id) {
        setEditingTask(null);
        setFormOpen(false);
      }
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">任务调度</h2>
          <p className="text-default-500 mt-1">
            管理 dbt 任务（命令 + 参数 + 目标环境），手动触发执行
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onPress={() => {
            setEditingTask(null);
            setFormOpen(true);
          }}
        >
          + 新建任务
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-default-400">加载中...</div>
      ) : !data?.items.length ? (
        <div className="py-12 text-center text-default-400">
          暂无任务，点击右上角新建
        </div>
      ) : (
        <Table>
          <Table.Content aria-label="任务列表">
            <Table.Header>
              <Table.Column isRowHeader>任务名称</Table.Column>
              <Table.Column>环境</Table.Column>
              <Table.Column>命令</Table.Column>
              <Table.Column>选择器</Table.Column>
              <Table.Column>操作</Table.Column>
            </Table.Header>
            <Table.Body>
              {data.items.map((task) => (
                <Table.Row key={task.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="font-medium">{task.name}</span>
                      {task.description && (
                        <span className="text-xs text-default-400">
                          {task.description}
                        </span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="text-default-700 dark:text-default-300">
                        {task.environmentName}
                      </span>
                      <span className="text-xs text-default-400">
                        {task.connectionName} · {task.databaseType}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip variant="soft" size="sm">
                      {COMMAND_LABEL[task.command] ?? task.command}
                    </Chip>
                    {task.fullRefresh && (
                      <Chip
                        variant="soft"
                        size="sm"
                        className="ml-1"
                        title="--full-refresh"
                      >
                        FR
                      </Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col text-xs text-default-500">
                      {task.select && <span>--select {task.select}</span>}
                      {task.exclude && <span>--exclude {task.exclude}</span>}
                      {!task.select && !task.exclude && (
                        <span className="text-default-300">-</span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => setRunTarget(task)}
                      >
                        运行
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setEditingTask(task);
                          setFormOpen(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onPress={() => setDeleteTarget(task)}
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

      <TaskFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(null);
        }}
        onSubmit={editingTask ? handleUpdate : handleCreate}
        task={editingTask}
        projectId={projectId}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除任务"
        message={`确认删除任务 "${deleteTarget?.name}"？此操作不可撤销。`}
      />

      <TaskRunLogPanel
        isOpen={!!runTarget}
        onClose={() => setRunTarget(null)}
        task={runTarget}
        onChanged={refresh}
      />
    </div>
  );
}
