"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Chip, Modal, Input, Label, ListBox, Select, useOverlayState } from "@heroui/react";
import { projectEnvironmentApi, environmentApi } from "@/web/api-client";
import type { ProjectEnvironment, Environment } from "@/web/types/dbt";
import { showError, showSuccess } from "@/web/components/shared/error-toast";
import ConfirmModal from "@/web/components/shared/confirm-modal";

interface EnvironmentBindingProps {
  projectId: number;
}

export default function EnvironmentBinding({
  projectId,
}: EnvironmentBindingProps) {
  const [bindings, setBindings] = useState<ProjectEnvironment[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [binding, setBinding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectEnvironment | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const formState = useOverlayState({
    isOpen: formOpen,
    onOpenChange: (open) => {
      if (!open) {
        setFormOpen(false);
        setSelectedEnvId(null);
        setAlias("");
      }
    },
  });

  const fetchBindings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await projectEnvironmentApi.list(projectId);
      setBindings(result.items);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBindings();
  }, [fetchBindings]);

  useEffect(() => {
    if (formOpen) {
      environmentApi.list({ limit: 100 }).then((res) => {
        setEnvironments(res.items);
      });
    }
  }, [formOpen]);

  const handleBind = async () => {
    if (!selectedEnvId) return;
    setBinding(true);
    try {
      await projectEnvironmentApi.bind(projectId, {
        environmentId: Number(selectedEnvId),
        environmentAlias: alias.trim() || undefined,
      });
      showSuccess("环境绑定成功");
      setFormOpen(false);
      setSelectedEnvId(null);
      setAlias("");
      fetchBindings();
    } catch (err) {
      showError(err);
    } finally {
      setBinding(false);
    }
  };

  const handleUnbind = async () => {
    if (!deleteTarget) return;
    try {
      await projectEnvironmentApi.unbind(projectId, deleteTarget.id);
      showSuccess("已解除绑定");
      fetchBindings();
    } catch (err) {
      showError(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-sm text-default-400">加载中...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-default-500">
          已绑定 {bindings.length} 个环境
        </span>
        <Button size="sm" variant="primary" onPress={() => setFormOpen(true)}>
          绑定环境
        </Button>
      </div>

      {bindings.length === 0 ? (
        <div className="py-8 text-center text-sm text-default-400">
          暂未绑定环境
        </div>
      ) : (
        <div className="space-y-2">
          {bindings.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-3 rounded-lg border border-default-200"
            >
              <div className="flex items-center gap-3">
                <Chip size="sm" variant="secondary">
                  环境 #{b.environmentId}
                </Chip>
                {b.environmentAlias && (
                  <span className="text-sm font-medium">{b.environmentAlias}</span>
                )}
                <span className="text-xs text-default-400">
                  {new Date(b.createdAt).toLocaleString()}
                </span>
              </div>
              <Button
                size="sm"
                variant="danger"
                onPress={() => setDeleteTarget(b)}
              >
                解绑
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Bind modal */}
      <Modal state={formState}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>绑定运行环境</Modal.Header>
              <Modal.Body className="gap-4">
                <Select
                  fullWidth
                  placeholder="请选择运行环境"
                  value={selectedEnvId}
                  onChange={(key) => setSelectedEnvId(key as string)}
                >
                  <Label>选择环境</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {environments.map((env) => (
                        <ListBox.Item key={String(env.id)} id={String(env.id)} textValue={env.name}>
                          {env.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="env-alias">环境别名</Label>
                  <Input
                    id="env-alias"
                    fullWidth
                    placeholder="选填"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setFormOpen(false);
                    setSelectedEnvId(null);
                    setAlias("");
                  }}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  onPress={handleBind}
                  isDisabled={!selectedEnvId}
                >
                  绑定
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleUnbind}
        title="解除绑定"
        message={`确认解除环境${deleteTarget?.environmentAlias ? ` "${deleteTarget.environmentAlias}"` : ` #${deleteTarget?.environmentId}`} 的绑定？`}
      />
    </div>
  );
}
