"use client";

import { useState } from "react";
import { Card, Button, Chip, Input, ListBox, Select } from "@heroui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { versionApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import Pagination from "@/web/components/shared/pagination";
import ConfirmModal from "@/web/components/shared/confirm-modal";
import VersionFormModal from "./version-form-modal";
import VersionDetailPanel from "./version-detail-panel";
import { useVersions } from "../hooks/use-versions";
import type { Version, AdapterPackage, Dependency } from "@/web/types/dbt";

export default function VersionList() {
  const { data, loading, params, setFilters, setPage, refresh } = useVersions();
  const [formOpen, setFormOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Version | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleCreate = async (formData: {
    name: string;
    version: string;
    adapterPackages: AdapterPackage[];
    dependencies: Dependency[];
  }) => {
    await versionApi.create(formData);
    showSuccess("版本创建成功");
    refresh();
  };

  const handleUpdate = async (formData: {
    name: string;
    version: string;
    adapterPackages: AdapterPackage[];
    dependencies: Dependency[];
    status?: "active" | "inactive";
  }) => {
    if (!editingVersion) return;
    await versionApi.update(editingVersion.id, formData);
    showSuccess("版本更新成功");
    setEditingVersion(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await versionApi.delete(deleteTarget.id);
      showSuccess("版本删除成功");
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
          <h2 className="text-2xl font-bold">dbt 版本管理</h2>
          <p className="text-default-500 mt-1">管理 dbt Core 版本及适配器</p>
        </div>
        <Button variant="primary" size="sm" onPress={() => { setEditingVersion(null); setFormOpen(true); }}>
          + 新建版本
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          fullWidth
          placeholder="版本号搜索"
          value={params.version ?? ""}
          onChange={(e) => setFilters({ version: e.target.value || undefined })}
        />
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
              <ListBox.Item id="inactive" textValue="停用">停用</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-default-400">加载中...</div>
      ) : !data?.items.length ? (
        <Card>
          <Card.Content className="py-12 text-center text-default-400">
            暂无版本，点击右上角新建
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.items.map((v) => (
            <Card key={v.id}>
              <Card.Content className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    >
                      {expandedId === v.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </Button>
                    <span className="font-medium">{v.name}</span>
                    <Chip size="sm" variant="secondary">v{v.version}</Chip>
                    <Chip
                      color={v.status === "active" ? "accent" : "default"}
                      variant="soft"
                      size="sm"
                    >
                      {v.status === "active" ? "活跃" : "停用"}
                    </Chip>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onPress={() => { setEditingVersion(v); setFormOpen(true); }}>
                      编辑
                    </Button>
                    <Button variant="danger" size="sm" onPress={() => setDeleteTarget(v)}>
                      删除
                    </Button>
                  </div>
                </div>
                {expandedId === v.id && <VersionDetailPanel version={v} />}
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {data && (
        <Pagination total={data.total} limit={params.limit ?? 20} offset={params.offset ?? 0} onChange={setPage} />
      )}

      <VersionFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingVersion(null); }}
        onSubmit={editingVersion ? handleUpdate : handleCreate}
        version={editingVersion}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除版本"
        message={`确认删除版本 "${deleteTarget?.name}"？如果被运行环境引用则无法删除。`}
      />
    </div>
  );
}
