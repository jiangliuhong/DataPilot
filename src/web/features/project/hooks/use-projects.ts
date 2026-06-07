"use client";

import { useState, useEffect, useCallback } from "react";
import { projectApi } from "@/web/api-client";
import type { Project, PaginatedResponse } from "@/web/types/dbt";

interface UseProjectsParams {
  limit?: number;
  offset?: number;
  status?: string;
}

export function useProjects(initialParams?: UseProjectsParams) {
  const [data, setData] = useState<PaginatedResponse<Project> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<UseProjectsParams>({
    limit: 20,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await projectApi.list(params);
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

  const setFilters = (newParams: Partial<UseProjectsParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  };

  const setPage = (offset: number) => {
    setParams((prev) => ({ ...prev, offset }));
  };

  return { data, loading, error, params, setFilters, setPage, refresh: fetch };
}
