"use client";

import { Button } from "@heroui/react";
import { X } from "lucide-react";
import type { EditorTab } from "../../hooks/use-editor-state";

interface EditorTabsProps {
  tabs: EditorTab[];
  activeFileId: number | null;
  onSelect: (fileId: number) => void;
  onClose: (fileId: number) => void;
}

export default function EditorTabs({
  tabs,
  activeFileId,
  onSelect,
  onClose,
}: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-default-200 bg-default-50 overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.fileId === activeFileId;
        return (
          <div
            key={tab.fileId}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-default-200 cursor-pointer select-none whitespace-nowrap ${
              isActive
                ? "bg-white text-foreground border-b-2 border-b-primary-500"
                : "text-default-500 hover:bg-white/60"
            }`}
            onClick={() => onSelect(tab.fileId)}
          >
            {tab.dirty && (
              <span className="text-warning-500 text-xs">●</span>
            )}
            <span>{tab.name}</span>
            <div
              className="ml-1"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.fileId);
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-auto px-0.5 min-w-0 h-5"
                onPress={() => onClose(tab.fileId)}
              >
                <X size={12} />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
