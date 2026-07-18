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
import type { Connection } from "@/web/types/dbt";

const DB_TYPES = [
  { id: "mysql5", label: "MySQL 5" },
  { id: "mysql8", label: "MySQL 8" },
  { id: "starrocks", label: "StarRocks" },
  { id: "postgresql", label: "PostgreSQL" },
];

interface ConnectionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    databaseType: "mysql5" | "mysql8" | "starrocks" | "postgresql";
    host: string;
    port: number;
    databaseName: string;
    schemaName?: string;
    username: string;
    password?: string;
    status?: string;
  }) => Promise<void>;
  connection?: Connection | null;
}

export default function ConnectionFormModal({
  isOpen,
  onClose,
  onSubmit,
  connection,
}: ConnectionFormModalProps) {
  const [name, setName] = useState("");
  const [databaseType, setDatabaseType] = useState<string>("mysql8");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3306");
  const [databaseName, setDatabaseName] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [portError, setPortError] = useState("");

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  useEffect(() => {
    if (connection) {
      setName(connection.name);
      setDatabaseType(connection.databaseType);
      setHost(connection.host);
      setPort(String(connection.port));
      setDatabaseName(connection.databaseName);
      setSchemaName(connection.schemaName ?? "");
      setUsername(connection.username);
      setPassword("");
    } else {
      setName("");
      setDatabaseType("mysql8");
      setHost("");
      setPort("3306");
      setDatabaseName("");
      setSchemaName("");
      setUsername("");
      setPassword("");
    }
    setPortError("");
  }, [connection, isOpen]);

  const validatePort = (value: string) => {
    const num = Number(value);
    if (!value || isNaN(num) || num < 1 || num > 65535) {
      setPortError("端口号范围 1-65535");
      return false;
    }
    setPortError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !host.trim() || !databaseName.trim() || !username.trim()) return;
    if (!validatePort(port)) return;
    if (!connection && !password.trim()) return;

    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        name: name.trim(),
        databaseType,
        host: host.trim(),
        port: Number(port),
        databaseName: databaseName.trim(),
        username: username.trim(),
      };
      if (schemaName.trim()) data.schemaName = schemaName.trim();
      if (password.trim()) data.password = password.trim();
      if (connection?.status) data.status = connection.status;

      await onSubmit(data as Parameters<typeof onSubmit>[0]);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              {connection ? "编辑连接" : "新建连接"}
            </Modal.Header>
            <Modal.Body className="gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="conn-name">连接名称 *</Label>
                <Input
                  id="conn-name"
                  fullWidth
                  placeholder="如 prod_mysql"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Select
                fullWidth
                placeholder="选择数据库类型"
                value={databaseType}
                onChange={(key) => setDatabaseType(key as string)}
              >
                <Label>数据库类型 *</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {DB_TYPES.map((t) => (
                      <ListBox.Item key={t.id} id={t.id} textValue={t.label}>
                        {t.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1 col-span-2">
                  <Label htmlFor="conn-host">主机 *</Label>
                  <Input
                    id="conn-host"
                    fullWidth
                    placeholder="10.0.0.1"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="conn-port">端口 *</Label>
                  <Input
                    id="conn-port"
                    fullWidth
                    placeholder="3306"
                    value={port}
                    onChange={(e) => {
                      setPort(e.target.value);
                      validatePort(e.target.value);
                    }}
                  />
                  {portError && (
                    <span className="text-xs text-danger">{portError}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="conn-db">数据库名 *</Label>
                  <Input
                    id="conn-db"
                    fullWidth
                    placeholder="analytics"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="conn-schema">Schema</Label>
                  <Input
                    id="conn-schema"
                    fullWidth
                    placeholder="选填"
                    value={schemaName}
                    onChange={(e) => setSchemaName(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="conn-user">用户名 *</Label>
                <Input
                  id="conn-user"
                  fullWidth
                  placeholder="dbt_user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="conn-pwd">
                  {connection ? "新密码（留空不修改）" : "密码 *"}
                </Label>
                <Input
                  id="conn-pwd"
                  type="password"
                  fullWidth
                  placeholder={connection ? "留空不修改" : "请输入密码"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                取消
              </Button>
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={
                  !name.trim() ||
                  !host.trim() ||
                  !databaseName.trim() ||
                  !username.trim() ||
                  (!connection && !password.trim())
                }
              >
                {connection ? "保存" : "创建"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
