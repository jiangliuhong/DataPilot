"use client";

import { useState } from "react";
import { Button, Chip, ListBox, Select, Table } from "@heroui/react";
import { connectionApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import Pagination from "@/web/components/shared/pagination";
import ConfirmModal from "@/web/components/shared/confirm-modal";
import ConnectionFormModal from "./connection-form-modal";
import { useConnections } from "../hooks/use-connections";
import type { Connection } from "@/web/types/dbt";

export default function ConnectionList() {
  const { data, loading, params, setFilters, setPage, refresh } = useConnections();
  const [formOpen, setFormOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (formData: Record<string, unknown>) => {
    await connectionApi.create(formData as never);
    showSuccess("连接创建成功");
    refresh();
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editingConn) return;
    await connectionApi.update(editingConn.id, formData as never);
    showSuccess("连接更新成功");
    setEditingConn(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await connectionApi.delete(deleteTarget.id);
      showSuccess("连接删除成功");
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
          <h2 className="text-2xl font-bold">数据库连接管理</h2>
          <p className="text-default-500 mt-1">管理数据库连接配置</p>
        </div>
        <Button variant="primary" size="sm" onPress={() => { setEditingConn(null); setFormOpen(true); }}>
          + 新建连接
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          className="w-[180px]"
          placeholder="全部类型"
          value={params.databaseType ?? "__all__"}
          onChange={(key) => setFilters({ databaseType: key === "__all__" ? undefined : (key as string) })}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__all__" textValue="全部类型">
                全部类型
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="mysql5" textValue="MySQL 5">
                MySQL 5
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="mysql8" textValue="MySQL 8">
                MySQL 8
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="starrocks" textValue="StarRocks">
                StarRocks
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="postgresql" textValue="PostgreSQL">
                PostgreSQL
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          className="w-[160px]"
          placeholder="全部状态"
          value={params.status ?? "__all__"}
          onChange={(key) => setFilters({ status: key === "__all__" ? undefined : (key as string) })}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__all__" textValue="全部状态">
                全部状态
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="active" textValue="活跃">
                活跃
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="inactive" textValue="停用">
                停用
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-default-400">加载中...</div>
      ) : !data?.items.length ? (
        <div className="py-12 text-center text-default-400">
          暂无连接，点击右上角新建
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="数据库连接列表">
              <Table.Header>
                <Table.Column isRowHeader>名称</Table.Column>
                <Table.Column>类型</Table.Column>
                <Table.Column>主机</Table.Column>
                <Table.Column>数据库</Table.Column>
                <Table.Column>状态</Table.Column>
                <Table.Column>操作</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.items.map((conn) => (
                  <Table.Row key={conn.id}>
                    <Table.Cell>{conn.name}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="secondary">{conn.databaseType}</Chip>
                    </Table.Cell>
                    <Table.Cell>{conn.host}:{conn.port}</Table.Cell>
                    <Table.Cell>{conn.databaseName}</Table.Cell>
                    <Table.Cell>
                      <Chip color={conn.status === "active" ? "accent" : "default"} variant="secondary" size="sm">
                        {conn.status === "active" ? "活跃" : "停用"}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onPress={() => { setEditingConn(conn); setFormOpen(true); }}>编辑</Button>
                        <Button variant="danger" size="sm" onPress={() => setDeleteTarget(conn)}>删除</Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {data && (
        <Pagination total={data.total} limit={params.limit ?? 20} offset={params.offset ?? 0} onChange={setPage} />
      )}

      <ConnectionFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingConn(null); }}
        onSubmit={editingConn ? handleUpdate : handleCreate}
        connection={editingConn}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除连接"
        message={`确认删除连接 "${deleteTarget?.name}"？如果被运行环境引用则无法删除。`}
      />
    </div>
  );
}
