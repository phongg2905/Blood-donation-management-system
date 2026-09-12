import type { ApiResponse } from '@blood/shared-types';
const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(
  /\/$/,
  '',
);
export async function apiGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<ApiResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: signal ?? AbortSignal.timeout(8000),
  });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    throw new Error(body.message || `HTTP ${response.status}`);
  }
  return body;
}
