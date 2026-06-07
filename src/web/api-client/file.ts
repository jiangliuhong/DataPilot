import { request, buildQuery } from "./request";
import type {
  ProjectFile,
  CreateFileInput,
  UpdateFileInput,
  PaginatedResponse,
  PaginationParams,
} from "@/web/types/dbt";

export const fileApi = {
  list(
    projectId: number,
    params?: PaginationParams & {
      fileType?: string;
      directoryId?: number;
    },
  ) {
    return request<PaginatedResponse<ProjectFile>>(
      `/projects/${projectId}/files${buildQuery(params ?? {})}`,
    );
  },

  get(projectId: number, fileId: number) {
    return request<ProjectFile>(`/projects/${projectId}/files/${fileId}`);
  },

  create(projectId: number, data: CreateFileInput) {
    return request<ProjectFile>(`/projects/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(
    projectId: number,
    fileId: number,
    data: UpdateFileInput,
  ) {
    return request<ProjectFile>(
      `/projects/${projectId}/files/${fileId}`,
      { method: "PUT", body: JSON.stringify(data) },
    );
  },

  delete(projectId: number, fileId: number) {
    return request<{ success: boolean }>(
      `/projects/${projectId}/files/${fileId}`,
      { method: "DELETE" },
    );
  },
};
