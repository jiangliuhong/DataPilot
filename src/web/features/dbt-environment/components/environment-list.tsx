"use client";

import { useState } from "react";
import { Button, Chip, ListBox, Select, Table } from "@heroui/react";
import { environmentApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import Pagination from "@/web/components/shared/pagination";
import ConfirmModal from "@/web/components/shared/confirm-modal";
import EnvironmentFormModal from "./environment-form-modal";
import { useEnvironments } from "../hooks/use-environments";
import type { Environment } from "@/web/types/dbt";

export default function EnvironmentList() {
  const { data, versions, connections, loading, params, setFilters, setPage, refresh } = useEnvironments();
  const [formOpen, setFormOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getVersionName = (versionId: number) => {
    const v = versions.find((v) => v.id === versionId);
    return v ? `${v.name} (v${v.version})` : `版本 #${versionId}`;
  };

  const getConnectionName = (connectionId: number) => {
    const c = connections.find((c) => c.id === connectionId);
    return c ? `${c.name} (${c.databaseType})` : `连接 #${connectionId}`;
  };

  const handleCreate = async (formData: { name: string; versionId: number; connectionId: number }) => {
    await environmentApi.create(formData);
    showSuccess("环境创建成功");
    refresh();
  };

  const handleUpdate = async (formData: { name: string; versionId: number; connectionId: number; status?: "active" | "inactive" }) => {
    if (!editingEnv) return;
    await environmentApi.update(editingEnv.id, formData);
    showSuccess("环境更新成功");
    setEditingEnv(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await environmentApi.delete(deleteTarget.id);
      showSuccess("环境删除成功");
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
          <h2 className="text-2xl font-bold">运行环境管理</h2>
          <p className="text-default-500 mt-1">管理 dbt 运行环境（版本 + 数据库连接）</p>
        </div>
        <Button variant="primary" size="sm" onPress={() => { setEditingEnv(null); setFormOpen(true); }}>
          + 新建环境
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          className="w-[160px]"
          placeholder="全部状态"
          selectedKey={params.status ?? "__all__"}
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
              <ListBox.Item id="inactive" textValue="停用">停用</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-default-400">加载中...</div>
      ) : !data?.items.length ? (
        <div className="py-12 text-center text-default-400">
          暂无环境，点击右上角新建
        </div>
      ) : (
        <Table>
          <Table.Content aria-label="环境列表">
            <Table.Header>
              <Table.Column isRowHeader>名称</Table.Column>
              <Table.Column>dbt 版本</Table.Column>
              <Table.Column>数据库连接</Table.Column>
              <Table.Column>状态</Table.Column>
              <Table.Column>操作</Table.Column>
            </Table.Header>
            <Table.Body>
              {data.items.map((env) => (
                <Table.Row key={env.id}>
                  <Table.Cell>
                    <span className="font-medium">{env.name}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-default-500">{getVersionName(env.versionId)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-default-500">{getConnectionName(env.connectionId)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip color={env.status === "active" ? "accent" : "default"} variant="soft" size="sm">
                      {env.status === "active" ? "活跃" : "停用"}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onPress={() => { setEditingEnv(env); setFormOpen(true); }}>编辑</Button>
                      <Button variant="danger" size="sm" onPress={() => setDeleteTarget(env)}>删除</Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table>
      )}

      {data && (
        <Pagination total={data.total} limit={params.limit ?? 20} offset={params.offset ?? 0} onChange={setPage} />
      )}

      <EnvironmentFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingEnv(null); }}
        onSubmit={editingEnv ? handleUpdate : handleCreate}
        environment={editingEnv}
        versions={versions}
        connections={connections}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除环境"
        message={`确认删除环境 "${deleteTarget?.name}"？如果已被项目绑定则无法删除。`}
      />
    </div>
  );
}
