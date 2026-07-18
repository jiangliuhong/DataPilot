import { request, buildQuery } from "./request";
import type {
  Connection,
  CreateConnectionInput,
  UpdateConnectionInput,
  PaginatedResponse,
  PaginationParams,
} from "@/web/types/dbt";

export const connectionApi = {
  list(
    params?: PaginationParams & {
      databaseType?: string;
      status?: string;
    },
  ) {
    return request<PaginatedResponse<Connection>>(
      `/connections${buildQuery(params ?? {})}`,
    );
  },

  get(id: number) {
    return request<Connection>(`/connections/${id}`);
  },

  create(data: CreateConnectionInput) {
    return request<Connection>("/connections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id: number, data: UpdateConnectionInput) {
    return request<Connection>(`/connections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(id: number) {
    return request<{ success: boolean }>(`/connections/${id}`, {
      method: "DELETE",
    });
  },
};
