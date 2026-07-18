import { request, buildQuery } from "./request";
import type {
  Environment,
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
  PaginatedResponse,
  PaginationParams,
} from "@/web/types/dbt";

export const environmentApi = {
  list(params?: PaginationParams & { status?: string }) {
    return request<PaginatedResponse<Environment>>(
      `/environments${buildQuery(params ?? {})}`,
    );
  },

  get(id: number) {
    return request<Environment>(`/environments/${id}`);
  },

  create(data: CreateEnvironmentInput) {
    return request<Environment>("/environments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id: number, data: UpdateEnvironmentInput) {
    return request<Environment>(`/environments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(id: number) {
    return request<{ success: boolean }>(`/environments/${id}`, {
      method: "DELETE",
    });
  },

  initialize(id: number) {
    return request<{ initializationStatus: "running" }>(
      `/environments/${id}/initialize`,
      { method: "POST" },
    );
  },
};
