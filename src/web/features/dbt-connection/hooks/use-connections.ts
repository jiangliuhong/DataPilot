"use client";

import { useState, useEffect, useCallback } from "react";
import { connectionApi } from "@/web/api-client";
import type { Connection, PaginatedResponse } from "@/web/types/dbt";

interface UseConnectionsParams {
  limit?: number;
  offset?: number;
  databaseType?: string;
  status?: string;
}

export function useConnections(initialParams?: UseConnectionsParams) {
  const [data, setData] = useState<PaginatedResponse<Connection> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<UseConnectionsParams>({
    limit: 20,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectionApi.list(params);
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

  const setFilters = (newParams: Partial<UseConnectionsParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  };

  const setPage = (offset: number) => {
    setParams((prev) => ({ ...prev, offset }));
  };

  return { data, loading, error, params, setFilters, setPage, refresh: fetch };
}
