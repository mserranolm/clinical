import type { ApiError, HttpMethod } from "../types";
import { getApiBaseUrl } from "./config";

type RequestConfig = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
};

export async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const method = config.method ?? "GET";
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
    },
    ...(config.body !== undefined ? { body: JSON.stringify(config.body) } : {})
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = json as ApiError;
    throw new Error(e.error || e.message || `HTTP ${res.status}`);
  }

  return json as T;
}
