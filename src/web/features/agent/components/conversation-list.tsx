"use client";

import { Plus, Trash2, MessageSquare } from "lucide-react";
import { useState } from "react";
import ConfirmModal from "@/web/components/shared/confirm-modal";
import type { AgentConversation } from "@/web/types/agent";

interface ConversationListProps {
  conversations: AgentConversation[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

/** 会话列表面板（新建按钮、会话项、删除按钮、选中高亮） */
export default function ConversationList({
  conversations,
  selectedId,
  loading,
  onSelect,
  onCreate,
  onDelete,
}: ConversationListProps) {
  const [deleteTarget, setDeleteTarget] = useState<AgentConversation | null>(null);

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-default-200 px-3 py-3">
        <span className="text-sm font-semibold text-default-700">会话</span>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary-600 hover:bg-primary-50"
          onClick={onCreate}
        >
          <Plus size={14} />
          新建
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-8 text-center text-xs text-default-400">
            加载中…
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-default-400">
            暂无会话，点击&ldquo;新建&rdquo;开始
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <div
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm ${
                    selectedId === conv.id
                      ? "bg-primary-50 text-primary-700"
                      : "text-default-700 hover:bg-default-50"
                  }`}
                  onClick={() => onSelect(conv.id)}
                >
                  <MessageSquare size={14} className="shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-default-400 opacity-0 transition-opacity hover:bg-danger-50 hover:text-danger-500 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(conv);
                    }}
                    aria-label="删除会话"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="删除会话"
        message={`确认删除会话"${deleteTarget?.title}"？此操作不可撤销。`}
      />
    </div>
  );
}
