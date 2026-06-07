"use client";

import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";

interface EditorToolbarProps {
  projectName: string;
  hasDirty: boolean;
  saving: boolean;
  onSave: () => void;
}

export default function EditorToolbar({
  projectName,
  hasDirty,
  saving,
  onSave,
}: EditorToolbarProps) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-default-200 bg-white px-4 shrink-0">
      <div className="flex items-center gap-3">
        <a
          href="/"
          className="flex items-center gap-1 text-sm text-default-500 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span>返回 DataPilot</span>
        </a>
        <span className="text-default-300">/</span>
        <span className="text-sm font-medium">{projectName}</span>
      </div>
      <Button
        variant="primary"
        size="sm"
        isDisabled={!hasDirty || saving}
        onPress={onSave}
      >
        {saving ? "保存中..." : "保存"}
      </Button>
    </div>
  );
}
