"use client";

import { useEffect, useState } from "react";
import { Modal, Button, ListBox, Spinner, useOverlayState } from "@heroui/react";
import { projectApi } from "@/web/api-client";
import type { Project } from "@/web/types/dbt";

interface WorkspaceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 选中某个 dbt project 后回调（由 layout 触发 createConversation） */
  onSelect: (project: { id: number; name: string }) => void;
}

/**
 * 「选择工作空间开聊」对话框。
 *
 * 当前仅支持选 dbt project。选中后由父组件触发
 * conversationApi.create({ type: "dbt_project", refId, name })。
 */
export default function WorkspaceSelectModal({
  isOpen,
  onClose,
  onSelect,
}: WorkspaceSelectModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    projectApi
      .list({ status: "active", limit: 100, offset: 0 })
      .then((res) => setProjects(res.items))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "加载项目失败"),
      )
      .finally(() => setLoading(false));
  }, [isOpen]);

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open: boolean) => {
      if (!open) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>选择工作空间</Modal.Header>
            <Modal.Body>
              <p className="mb-2 text-sm text-default-500">
                选择一个 dbt 项目作为 Agent 的工作空间。Agent 将能读写该项目下的文件。
              </p>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : error ? (
                <p className="py-4 text-center text-sm text-danger-500">
                  {error}
                </p>
              ) : projects.length === 0 ? (
                <p className="py-8 text-center text-sm text-default-400">
                  暂无可用项目，请先创建 dbt 项目
                </p>
              ) : (
                <ListBox
                  aria-label="选择 dbt 项目"
                  selectionMode="single"
                  onAction={(key) => {
                    const p = projects.find((x) => String(x.id) === String(key));
                    if (p) {
                      onSelect({ id: p.id, name: p.name });
                    }
                  }}
                >
                  {projects.map((p) => (
                    <ListBox.Item key={p.id} id={p.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        {p.description && (
                          <span className="text-xs text-default-400">
                            {p.description}
                          </span>
                        )}
                      </div>
                    </ListBox.Item>
                  ))}
                </ListBox>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onPress={onClose}>
                取消
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
