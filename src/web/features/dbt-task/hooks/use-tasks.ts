"use client";

import { useState, useEffect, useCallback } from "react";
import { taskApi } from "@/web/api-client";
import type { Task, PaginatedResponse, TaskCommand } from "@/web/types/dbt";

interface UseTasksParams {
  projectId: number;
  limit?: number;
  offset?: number;
  environmentId?: number;
  command?: TaskCommand;
}

/**
 * 项目内任务列表 hook。
 * 强制 projectId 作用域（任务强属于项目）。
 */
export function useTasks(projectId: number, initialParams?: Omit<UseTasksParams, "projectId">) {
  const [data, setData] = useState<PaginatedResponse<Task> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<UseTasksParams>({
    projectId,
    limit: 20,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await taskApi.list(params);
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

  const setFilters = (newParams: Partial<UseTasksParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  };

  const setPage = (offset: number) => {
    setParams((prev) => ({ ...prev, offset }));
  };

  return { data, loading, error, params, setFilters, setPage, refresh: fetch };
}
