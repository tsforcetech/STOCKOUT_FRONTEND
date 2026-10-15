import type { Tokens } from './types';
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://stockout.flowb.io').replace(
  /\/$/,
  '',
);
const STORAGE_KEY = 'stockout.seller.session';
export function getSession(): Tokens | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
export function setSession(tokens: Tokens | null) {
  if (tokens) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  else sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('stockout-session'));
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string[]>,
    public correlationId?: string,
  ) {
    super(message);
  }
}
// Only normalize the first character of API property names. Dictionary keys (headers/errors) stay intact.
export function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k.charAt(0).toLowerCase() + k.slice(1),
        k === 'requiredHeaders' || k === 'RequiredHeaders' || k === 'errors' || k === 'Errors'
          ? v
          : normalize(v),
      ]),
    );
  return value;
}
export function unwrap(value: unknown): unknown {
  const obj = value as Record<string, unknown> | null;
  return obj && typeof obj === 'object' && !Array.isArray(obj) && 'data' in obj ? obj.data : value;
}
async function decode(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return normalize(JSON.parse(text));
  } catch {
    if (response.ok)
      throw new ApiError(502, 'The service returned an unexpected response. Please try again.');
    return null;
  }
}
let refreshing: Promise<Tokens> | null = null;
async function refresh(): Promise<Tokens> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const current = getSession();
    if (!current?.refreshToken)
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    const response = await fetch(`${API_BASE}/api/v1/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
      signal: AbortSignal.timeout(30000),
    });
    const data = unwrap(await decode(response)) as Tokens;
    if (!response.ok)
      throw new ApiError(
        response.status,
        response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'Unable to refresh your session while the service is unavailable. Please try again.',
      );
    if (!data?.accessToken || !data.refreshToken)
      throw new ApiError(502, 'The service returned an incomplete session. Please try again.');
    if (getSession()?.refreshToken !== current.refreshToken)
      throw new ApiError(401, 'This session has been signed out.');
    const next = { ...current, ...data };
    setSession(next);
    return next;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
};
export async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const { method = 'GET', body, auth = true, idempotencyKey, signal } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && getSession()?.accessToken
          ? { Authorization: `Bearer ${getSession()!.accessToken}` }
          : {}),
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal || AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Unable to connect. Check your connection and try again.');
  }
  if (response.status === 401 && auth && !retried && getSession()?.refreshToken) {
    try {
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setSession(null);
      throw e;
    }
    return request(path, options, true);
  }
  const data = (await decode(response)) as Record<string, unknown> | null;
  if (!response.ok || data?.success === false) {
    const status = response.status;
    const error = typeof data?.error === 'object' ? (data.error as Record<string, unknown>) : null;
    const fallback =
      status >= 500
        ? 'The service is temporarily unavailable. Please try again.'
        : status === 409
          ? 'This record has changed. Refresh to review the latest version before saving.'
          : status === 403
            ? 'Your account does not have permission for this action.'
            : status === 429
              ? 'Too many requests. Please wait before trying again.'
              : status === 401
                ? 'Please sign in to continue.'
                : 'The request could not be completed.';
    throw new ApiError(
      status,
      String(data?.detail || data?.message || error?.message || fallback),
      String(data?.code || error?.code || data?.error || ''),
      data?.errors as Record<string, string[]>,
      response.headers.get('x-correlation-id') || undefined,
    );
  }
  return unwrap(data) as T;
}
export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown, idempotencyKey?: string) =>
  request<T>(path, { method: 'POST', body, idempotencyKey });
export const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body });
export const del = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'DELETE', body });
export const sellerPath = (sellerId: string) =>
  `/api/v1/marketplace/sellers/${encodeURIComponent(sellerId)}`;
export const listingPath = (sellerId: string, listingId?: string) =>
  `${sellerPath(sellerId)}/listings${listingId ? `/${encodeURIComponent(listingId)}` : ''}`;
export function safeUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' &&
    !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
  )
    throw new Error('The server returned an unsupported file URL.');
  return u.href;
}
export async function downloadFile(fileId: string) {
  const data = await post<{ downloadUrl?: string; url?: string }>(
    `/api/v1/files/${encodeURIComponent(fileId)}/download-url`,
  );
  const a = document.createElement('a');
  a.href = safeUrl(data.downloadUrl || data.url || '');
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
}
export async function uploadFile(
  file: File,
  purpose: string,
  onProgress: (n: number) => void,
): Promise<string> {
  const image =
    purpose === 'LISTING_IMAGE' ||
    purpose === 'SELLER_PROFILE_LOGO' ||
    purpose === 'USER_PROFILE_PHOTO';
  const max = purpose === 'LISTING_IMAGE' ? 10 : image ? 5 : 20;
  if (file.size > max * 1024 * 1024) throw new Error(`File must be ${max} MB or smaller.`);
  const allowed = image
    ? ['image/jpeg', 'image/png', 'image/webp']
    : ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowed.includes(file.type))
    throw new Error(image ? 'Choose a JPG, PNG or WebP image.' : 'Choose a PDF, JPG or PNG file.');
  const data = await post<{
    fileId: string;
    uploadUrl: string;
    httpMethod: string;
    requiredHeaders: Record<string, string>;
  }>('/api/v1/files/upload-requests', {
    originalFileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    purpose,
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(data.httpMethod || 'PUT', safeUrl(data.uploadUrl));
    Object.entries(data.requiredHeaders || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error('Storage upload failed. Please select the file to retry.'));
    xhr.onerror = () => reject(new Error('Storage connection failed. Please try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    xhr.send(file);
  });
  await post(`/api/v1/files/${data.fileId}/complete`);
  onProgress(100);
  return data.fileId;
}
