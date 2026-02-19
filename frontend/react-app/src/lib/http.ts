import type { ApiError, HttpMethod } from "../types";
import { getApiBaseUrl } from "./config";

type RequestConfig = {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
};

const isDev = import.meta.env.DEV;

function getEffectiveBase(): string {
  if (isDev) {
    return "/api";
  }
  return getApiBaseUrl();
}

export async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const method = config.method ?? "GET";
  const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
  const base = getEffectiveBase();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(isDev ? {} : apiKey ? { "x-api-key": apiKey } : {}),
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
