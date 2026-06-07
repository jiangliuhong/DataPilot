"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  Label,
  ListBox,
  Select,
  useOverlayState,
} from "@heroui/react";
import type { Environment, Version, Connection } from "@/web/types/dbt";

interface EnvironmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    versionId: number;
    connectionId: number;
    status?: "active" | "inactive";
  }) => Promise<void>;
  environment?: Environment | null;
  versions: Version[];
  connections: Connection[];
}

export default function EnvironmentFormModal({
  isOpen,
  onClose,
  onSubmit,
  environment,
  versions,
  connections,
}: EnvironmentFormModalProps) {
  const [name, setName] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  useEffect(() => {
    if (environment) {
      setName(environment.name);
      setVersionId(String(environment.versionId));
      setConnectionId(String(environment.connectionId));
    } else {
      setName("");
      setVersionId(null);
      setConnectionId(null);
    }
  }, [environment, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim() || !versionId || !connectionId) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        versionId: Number(versionId),
        connectionId: Number(connectionId),
        ...(environment?.status ? { status: environment.status } : {}),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const activeVersions = versions.filter((v) => v.status === "active");
  const activeConnections = connections.filter((c) => c.status === "active");

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.Header>{environment ? "编辑运行环境" : "新建运行环境"}</Modal.Header>
            <Modal.Body className="gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="env-name">环境名称 *</Label>
                <Input
                  id="env-name"
                  fullWidth
                  placeholder="如 production"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Select
                fullWidth
                placeholder="选择版本"
                value={versionId}
                onChange={(key) => setVersionId(key as string)}
              >
                <Label>dbt 版本</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {activeVersions.map((v) => (
                      <ListBox.Item key={String(v.id)} id={String(v.id)} textValue={`${v.name} (v${v.version})`}>
                        {v.name} (v{v.version})
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Select
                fullWidth
                placeholder="选择连接"
                value={connectionId}
                onChange={(key) => setConnectionId(key as string)}
              >
                <Label>数据库连接</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {activeConnections.map((c) => (
                      <ListBox.Item key={String(c.id)} id={String(c.id)} textValue={`${c.name} (${c.databaseType})`}>
                        {c.name} ({c.databaseType})
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>取消</Button>
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={!name.trim() || !versionId || !connectionId}
              >
                {environment ? "保存" : "创建"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
