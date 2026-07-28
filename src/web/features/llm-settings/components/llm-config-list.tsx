"use client";

import { useState } from "react";
import { Card, Button, Chip, Select, ListBox } from "@heroui/react";
import { llmSettingsApi } from "@/web/api-client";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import Pagination from "@/web/components/shared/pagination";
import ConfirmModal from "@/web/components/shared/confirm-modal";
import LlmConfigFormModal from "./llm-config-form-modal";
import { useLlmSettings } from "../hooks/use-llm-settings";
import { LLM_PROVIDER_OPTIONS } from "@/web/types/settings";
import type {
  LlmProviderConfigItem,
  CreateLlmConfigInput,
  UpdateLlmConfigInput,
} from "@/web/types/settings";

const PROVIDER_LABEL: Record<string, string> = Object.fromEntries(
  LLM_PROVIDER_OPTIONS.map((o) => [o.value, o.label]),
);

export default function LlmConfigList() {
  const { data, loading, params, setFilters, setPage, refresh } =
    useLlmSettings();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LlmProviderConfigItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LlmProviderConfigItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  const handleCreate = async (formData: UpdateLlmConfigInput) => {
    // 新建场景必填字段由表单校验保证存在
    await llmSettingsApi.create(formData as CreateLlmConfigInput);
    showSuccess("配置创建成功");
    refresh();
  };

  const handleUpdate = async (formData: UpdateLlmConfigInput) => {
    if (!editing) return;
    await llmSettingsApi.update(editing.id, formData);
    showSuccess("配置更新成功");
    setEditing(null);
    refresh();
  };

  const handleActivate = async (config: LlmProviderConfigItem) => {
    if (config.isDefault) return;
    setActivatingId(config.id);
    try {
      await llmSettingsApi.activate(config.id);
      showSuccess(`已将「${config.name}」设为生效配置`);
      refresh();
    } catch (err) {
      showError(err);
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await llmSettingsApi.delete(deleteTarget.id);
      showSuccess("配置删除成功");
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
          <h2 className="text-2xl font-bold">大模型配置</h2>
          <p className="text-default-500 mt-1">
            管理 AI 助手的大模型供应商配置，支持多套预设，选择一项设为生效
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + 新建配置
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          className="w-[200px]"
          placeholder="全部供应商"
          selectedKey={params.provider ?? "__all__"}
          onChange={(key) => {
            const val = key as string;
            setFilters({
              provider: val === "__all__" ? undefined : (val as never),
            });
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__all__" textValue="全部供应商">
                全部供应商
              </ListBox.Item>
              {LLM_PROVIDER_OPTIONS.map((opt) => (
                <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                  {opt.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          className="w-[160px]"
          placeholder="全部状态"
          selectedKey={params.status ?? "__all__"}
          onChange={(key) => {
            const val = key as string;
            setFilters({
              status: val === "__all__" ? undefined : (val as never),
            });
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__all__" textValue="全部状态">
                全部状态
              </ListBox.Item>
              <ListBox.Item id="active" textValue="启用">
                启用
              </ListBox.Item>
              <ListBox.Item id="inactive" textValue="停用">
                停用
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-default-400">加载中...</div>
      ) : !data?.items.length ? (
        <Card>
          <Card.Content className="py-12 text-center text-default-400">
            暂无配置，点击右上角新建。需至少添加一项并设为生效，AI 助手方可使用。
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.items.map((c) => (
            <Card key={c.id}>
              <Card.Content className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium">{c.name}</span>
                    <Chip size="sm" variant="secondary">
                      {PROVIDER_LABEL[c.provider] ?? c.provider}
                    </Chip>
                    <Chip size="sm" variant="soft">
                      {c.model}
                    </Chip>
                    {c.isDefault && (
                      <Chip color="accent" variant="soft" size="sm">
                        当前生效
                      </Chip>
                    )}
                    <Chip
                      color={c.status === "active" ? "accent" : "default"}
                      variant="soft"
                      size="sm"
                    >
                      {c.status === "active" ? "启用" : "停用"}
                    </Chip>
                    {c.hasApiKey ? (
                      <span className="text-xs text-default-400">已配置 Key</span>
                    ) : (
                      <span className="text-xs text-warning">未配置 Key</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={
                        c.isDefault || c.status === "inactive" || activatingId === c.id
                      }
                      onPress={() => handleActivate(c)}
                    >
                      {activatingId === c.id ? "切换中…" : c.isDefault ? "已生效" : "设为生效"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        setEditing(c);
                        setFormOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onPress={() => setDeleteTarget(c)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {data && (
        <Pagination
          total={data.total}
          limit={params.limit ?? 50}
          offset={params.offset ?? 0}
          onChange={setPage}
        />
      )}

      <LlmConfigFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(formData) =>
          editing ? handleUpdate(formData) : handleCreate(formData)
        }
        config={editing}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除配置"
        message={`确认删除大模型配置「${deleteTarget?.name}」？${
          deleteTarget?.isDefault ? "该项为当前生效配置，删除后 AI 助手将不可用。" : ""
        }`}
      />
    </div>
  );
}
