import { fetchJsonRequest, buildQuery } from "./request";
import type {
  LlmProviderConfigItem,
  CreateLlmConfigInput,
  UpdateLlmConfigInput,
  LlmConfigListResponse,
  ListLlmConfigsParams,
} from "@/web/types/settings";

/** 大模型配置接口前缀（区别于 dbt 的 /api/dbt） */
const BASE_URL = "/api/settings";

export const llmSettingsApi = {
  /** GET /api/settings/llm — 配置列表 */
  list(params?: ListLlmConfigsParams) {
    return fetchJsonRequest<LlmConfigListResponse>(
      BASE_URL,
      `/llm${buildQuery(params ?? {})}`,
    );
  },

  /** GET /api/settings/llm/[id] — 配置详情 */
  get(id: number) {
    return fetchJsonRequest<LlmProviderConfigItem>(BASE_URL, `/llm/${id}`);
  },

  /** POST /api/settings/llm — 创建配置 */
  create(data: CreateLlmConfigInput) {
    return fetchJsonRequest<LlmProviderConfigItem>(BASE_URL, "/llm", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /** PUT /api/settings/llm/[id] — 更新配置 */
  update(id: number, data: UpdateLlmConfigInput) {
    return fetchJsonRequest<LlmProviderConfigItem>(BASE_URL, `/llm/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /** DELETE /api/settings/llm/[id] — 删除配置 */
  delete(id: number) {
    return fetchJsonRequest<{ success: boolean }>(BASE_URL, `/llm/${id}`, {
      method: "DELETE",
    });
  },

  /** POST /api/settings/llm/[id]/activate — 设为当前生效配置 */
  activate(id: number) {
    return fetchJsonRequest<LlmProviderConfigItem>(
      BASE_URL,
      `/llm/${id}/activate`,
      { method: "POST" },
    );
  },
};
