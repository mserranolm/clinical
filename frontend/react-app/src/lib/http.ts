import type { ApiError, HttpMethod } from "../types";
import { getApiBaseUrl } from "./config";

type RequestConfig = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
};

/**
 * Generic HTTP client that wraps fetch with JSON serialization, auth headers,
 * and error normalization. Throws an Error with the API error message on non-2xx responses.
 */
export async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const method = config.method ?? "GET";
  const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) ?? "XW4dlwowLE8aEkT2Ix5im5oXqjGZxFFJ3C3fr11C";
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
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
