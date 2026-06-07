import { request, buildQuery } from "./request";
import type {
  Version,
  CreateVersionInput,
  UpdateVersionInput,
  PaginatedResponse,
  PaginationParams,
} from "@/web/types/dbt";

export const versionApi = {
  list(params?: PaginationParams & { version?: string; status?: string }) {
    return request<PaginatedResponse<Version>>(
      `/versions${buildQuery(params ?? {})}`,
    );
  },

  get(id: number) {
    return request<Version>(`/versions/${id}`);
  },

  create(data: CreateVersionInput) {
    return request<Version>("/versions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id: number, data: UpdateVersionInput) {
    return request<Version>(`/versions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(id: number) {
    return request<{ success: boolean }>(`/versions/${id}`, {
      method: "DELETE",
    });
  },
};
