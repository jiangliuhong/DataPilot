"use client";

import { useState, useEffect, useCallback } from "react";
import { llmSettingsApi } from "@/web/api-client";
import type {
  LlmConfigListResponse,
  ListLlmConfigsParams,
} from "@/web/types/settings";

interface UseLlmSettingsParams {
  limit?: number;
  offset?: number;
  provider?: "openai" | "anthropic";
  status?: "active" | "inactive";
}

export function useLlmSettings(initialParams?: UseLlmSettingsParams) {
  const [data, setData] = useState<LlmConfigListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<UseLlmSettingsParams>({
    limit: 50,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await llmSettingsApi.list(params as ListLlmConfigsParams);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setFilters = (newParams: Partial<UseLlmSettingsParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  };

  const setPage = (offset: number) => {
    setParams((prev) => ({ ...prev, offset }));
  };

  return { data, loading, error, params, setFilters, setPage, refresh: fetch };
}
