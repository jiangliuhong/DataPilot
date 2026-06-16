"use client";

import { useState, useEffect, useCallback } from "react";
import { conversationApi } from "@/web/api-client";
import type { AgentConversation } from "@/web/types/agent";

interface UseConversationsResult {
  conversations: AgentConversation[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedId: number | null;
  refresh: () => Promise<void>;
  select: (id: number | null) => void;
  create: () => Promise<AgentConversation | null>;
  remove: (id: number) => Promise<boolean>;
}

/**
 * 管理会话列表状态（加载、新建、删除、刷新、选中）。
 *
 * 参考现有 use-projects.ts 模式，会话列表由后端按当前用户隔离返回。
 */
export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await conversationApi.list({ limit: 50, offset: 0 });
      setConversations(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载会话失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const select = useCallback((id: number | null) => {
    setSelectedId(id);
  }, []);

  const create = useCallback(async () => {
    try {
      const conversation = await conversationApi.create();
      setConversations((prev) => [conversation, ...prev]);
      setSelectedId(conversation.id);
      return conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建会话失败");
      return null;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await conversationApi.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除会话失败");
      return false;
    }
  }, []);

  return {
    conversations,
    total,
    loading,
    error,
    selectedId,
    refresh,
    select,
    create,
    remove,
  };
}
