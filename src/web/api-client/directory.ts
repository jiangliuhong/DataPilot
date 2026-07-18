import { request, buildQuery } from "./request";
import type {
  Directory,
  DirectoryTreeNode,
  CreateDirectoryInput,
  UpdateDirectoryInput,
} from "@/web/types/dbt";

export const directoryApi = {
  list(projectId: number, params?: { parentId?: number | null }) {
    const query: Record<string, string | number> = {};
    if (params?.parentId !== undefined && params.parentId !== null) {
      query.parentId = params.parentId;
    }
    return request<Directory[]>(
      `/projects/${projectId}/directories${buildQuery(query)}`,
    );
  },

  getTree(projectId: number) {
    return request<DirectoryTreeNode[]>(`/projects/${projectId}/tree`);
  },

  create(projectId: number, data: CreateDirectoryInput) {
    return request<Directory>(`/projects/${projectId}/directories`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(
    projectId: number,
    dirId: number,
    data: UpdateDirectoryInput,
  ) {
    return request<Directory>(
      `/projects/${projectId}/directories/${dirId}`,
      { method: "PUT", body: JSON.stringify(data) },
    );
  },

  delete(projectId: number, dirId: number) {
    return request<{ success: boolean }>(
      `/projects/${projectId}/directories/${dirId}`,
      { method: "DELETE" },
    );
  },
};
