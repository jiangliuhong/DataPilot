import { request, buildQuery } from "./request";
import type {
  ProjectEnvironment,
  BindEnvironmentInput,
  PaginatedResponse,
  PaginationParams,
} from "@/web/types/dbt";

export const projectEnvironmentApi = {
  list(projectId: number, params?: PaginationParams) {
    return request<PaginatedResponse<ProjectEnvironment>>(
      `/projects/${projectId}/environments${buildQuery(params ?? {})}`,
    );
  },

  bind(projectId: number, data: BindEnvironmentInput) {
    return request<ProjectEnvironment>(
      `/projects/${projectId}/environments`,
      { method: "POST", body: JSON.stringify(data) },
    );
  },

  unbind(projectId: number, envId: number) {
    return request<{ success: boolean }>(
      `/projects/${projectId}/environments/${envId}`,
      { method: "DELETE" },
    );
  },
};
