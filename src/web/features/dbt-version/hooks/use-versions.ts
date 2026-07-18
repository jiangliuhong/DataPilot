"use client";

import { useState, useEffect, useCallback } from "react";
import { versionApi } from "@/web/api-client";
import type { Version, PaginatedResponse } from "@/web/types/dbt";

interface UseVersionsParams {
  limit?: number;
  offset?: number;
  version?: string;
  status?: string;
}

export function useVersions(initialParams?: UseVersionsParams) {
  const [data, setData] = useState<PaginatedResponse<Version> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<UseVersionsParams>({
    limit: 20,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await versionApi.list(params);
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

  const setFilters = (newParams: Partial<UseVersionsParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  };

  const setPage = (offset: number) => {
    setParams((prev) => ({ ...prev, offset }));
  };

  return { data, loading, error, params, setFilters, setPage, refresh: fetch };
}
