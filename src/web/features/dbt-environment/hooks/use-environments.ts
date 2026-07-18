"use client";

import { useState, useEffect, useCallback } from "react";
import { environmentApi, versionApi, connectionApi } from "@/web/api-client";
import type {
  Environment,
  Version,
  Connection,
  PaginatedResponse,
} from "@/web/types/dbt";

interface UseEnvironmentsParams {
  limit?: number;
  offset?: number;
  status?: string;
}

export function useEnvironments(initialParams?: UseEnvironmentsParams) {
  const [data, setData] = useState<PaginatedResponse<Environment> | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<UseEnvironmentsParams>({
    limit: 20,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [envResult, verResult, connResult] = await Promise.all([
        environmentApi.list(params),
        versionApi.list({ limit: 100 }),
        connectionApi.list({ limit: 100 }),
      ]);
      setData(envResult);
      setVersions(verResult.items);
      setConnections(connResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setFilters = (newParams: Partial<UseEnvironmentsParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  };

  const setPage = (offset: number) => {
    setParams((prev) => ({ ...prev, offset }));
  };

  return {
    data,
    versions,
    connections,
    loading,
    error,
    params,
    setFilters,
    setPage,
    refresh: fetch,
  };
}
