"use client";

import { useState, useCallback } from "react";
import { conversationApi } from "@/web/api-client";
import type { AgentMessage } from "@/web/types/agent";

interface UseConversationMessagesResult {
  messages: AgentMessage[];
  loading: boolean;
  error: string | null;
  load: (conversationId: number) => Promise<void>;
  clear: () => void;
  clearError: () => void;
}

/**
 * 管理单会话历史消息加载。
 *
 * 切换会话时调用 load(conversationId) 拉取历史消息。
 */
export function useConversationMessages(): UseConversationMessagesResult {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (conversationId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await conversationApi.getMessages(conversationId);
      setMessages(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载消息失败");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { messages, loading, error, load, clear, clearError };
}
