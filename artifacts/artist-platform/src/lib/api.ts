/**
 * Thin typed API client for endpoints not covered by generated hooks.
 * Uses customFetch (from api-client-react) which already injects the Clerk
 * Bearer token automatically via the ClerkTokenBridge.
 */
import { customFetch } from "@workspace/api-client-react";

const BASE = "/api";

export const api = {
  get: <T>(path: string) =>
    customFetch<T>(`${BASE}${path}`),

  post: <T>(path: string, body?: unknown) =>
    customFetch<T>(`${BASE}${path}`, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    customFetch<T>(`${BASE}${path}`, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    customFetch<T>(`${BASE}${path}`, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    customFetch<T>(`${BASE}${path}`, { method: "DELETE" }),
};
