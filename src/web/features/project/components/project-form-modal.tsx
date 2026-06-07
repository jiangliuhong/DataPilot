"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  TextArea,
  Label,
  useOverlayState,
} from "@heroui/react";
import type { Project } from "@/web/types/dbt";

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  project?: Project | null;
}

export default function ProjectFormModal({
  isOpen,
  onClose,
  onSubmit,
  project,
}: ProjectFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
  }, [project, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.Header>
              {project ? "编辑项目" : "新建项目"}
            </Modal.Header>
            <Modal.Body className="gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="project-name">项目名称 *</Label>
                <Input
                  id="project-name"
                  fullWidth
                  placeholder="请输入项目名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="project-desc">项目描述</Label>
                <TextArea
                  id="project-desc"
                  fullWidth
                  placeholder="请输入项目描述（选填）"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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
                isDisabled={!name.trim()}
              >
                {project ? "保存" : "创建"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
