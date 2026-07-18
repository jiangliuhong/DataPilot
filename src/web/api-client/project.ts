import { request, buildQuery, requestBlob, uploadFile } from "./request";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  PaginatedResponse,
  PaginationParams,
} from "@/web/types/dbt";

export const projectApi = {
  list(params?: PaginationParams & { status?: string }) {
    return request<PaginatedResponse<Project>>(
      `/projects${buildQuery(params ?? {})}`,
    );
  },

  get(id: number) {
    return request<Project>(`/projects/${id}`);
  },

  create(data: CreateProjectInput) {
    return request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id: number, data: UpdateProjectInput) {
    return request<Project>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(id: number) {
    return request<{ success: boolean }>(`/projects/${id}`, {
      method: "DELETE",
    });
  },

  exportProject(id: number) {
    return requestBlob(`/projects/${id}/export`);
  },

  importProject(id: number, file: File) {
    return uploadFile<{ directories: number; files: number }>(
      `/projects/${id}/import`,
      file,
    );
  },
};
