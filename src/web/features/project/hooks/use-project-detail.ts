"use client";

import { useState, useEffect, useCallback } from "react";
import { projectApi } from "@/web/api-client";
import type { Project } from "@/web/types/dbt";

export function useProjectDetail(projectId: number | null) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await projectApi.get(projectId);
      setProject(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { project, loading, error, refresh: fetch };
}
