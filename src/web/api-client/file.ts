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
      // undefined = 不过滤目录；null = 仅项目根目录；number = 指定目录
      directoryId?: number | null;
    },
  ) {
    const { directoryId, ...rest } = params ?? {};
    // null 表示「项目根目录」，后端 schema 接受字面量 "null"/"root"。
    const query: Parameters<typeof buildQuery>[0] = { ...rest };
    if (directoryId === null) {
      query.directoryId = "null";
    } else if (directoryId !== undefined) {
      query.directoryId = directoryId;
    }
    return request<PaginatedResponse<ProjectFile>>(
      `/projects/${projectId}/files${buildQuery(query)}`,
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
