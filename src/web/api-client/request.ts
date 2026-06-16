const BASE_URL = "/api/dbt";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(
      (body.error as string) ?? `API error ${status}`,
    );
    this.name = "ApiError";
  }
}

/**
 * 底层 JSON 请求封装，接收完整 baseUrl（如 "/api/dbt" 或 "/api/auth"）。
 * 抽出后各 api-client 模块可按需指向不同前缀，错误模型统一为 `ApiError`。
 */
async function fetchJson<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const hasBody = options.body !== undefined;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await res.json();
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return res.json();
}

/**
 * 指向 `/api/dbt` 前缀的请求封装（dbt 模块专用）。
 * 保留原签名以兼容现有 dbt 客户端调用。
 */
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return fetchJson<T>(BASE_URL, path, options);
}

/** 导出底层封装，供指向其他前缀的 api-client 复用（如 auth）。 */
export { fetchJson as fetchJsonRequest };


export async function requestBlob(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body);
  }
  return res.blob();
}

export async function uploadFile<T>(
  path: string,
  file: File,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export function buildQuery(
  params: { [key: string]: string | number | boolean | undefined | null },
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}
