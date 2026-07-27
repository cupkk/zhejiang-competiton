import type { ApiResult } from '../../types/api';
import { clearStoredAdminSession, getAdminAuthToken } from './admin-session';
import { clearDataCache } from './query-cache';
import { RequestError } from './request-error';
import { clearStoredSession, getAuthToken } from './session';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TData> {
  url: string;
  method?: HttpMethod;
  data?: TData;
  auth?: boolean;
  adminAuth?: boolean;
  headers?: Record<string, string>;
  contentType?: 'json' | 'form';
  timeoutMs?: number;
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const inFlightGetRequests = new Map<string, Promise<Response>>();
const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildQueryString(data?: Record<string, unknown>) {
  if (!data) {
    return '';
  }

  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export async function request<TResponse, TData = Record<string, unknown>>({
  url,
  method = 'GET',
  data,
  auth = false,
  adminAuth = false,
  headers: customHeaders,
  contentType = 'json',
  timeoutMs,
}: RequestOptions<TData>): Promise<TResponse> {
  const headers: Record<string, string> = customHeaders ? { ...customHeaders } : {};

  if (contentType === 'json' && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (adminAuth) {
    const token = getAdminAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const requestUrl =
    method === 'GET'
      ? `${apiBaseUrl}${url}${buildQueryString(data as Record<string, unknown> | undefined)}`
      : `${apiBaseUrl}${url}`;

  const resolvedTimeoutMs = timeoutMs ?? (contentType === 'form' ? 60_000 : method === 'GET' ? 12_000 : 20_000);
  const maxAttempts = method === 'GET' ? 3 : 1;
  const requestKey = method === 'GET' ? `${requestUrl}|${headers.Authorization ?? ''}` : '';

  const execute = async () => {
    let response: Response | null = null;
    let timedOut = false;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      timedOut = false;
      const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, resolvedTimeoutMs);

      try {
        response = await fetch(requestUrl, {
          method,
          headers,
          signal: controller.signal,
          cache: auth || adminAuth || Boolean(headers.Authorization) ? 'no-store' : 'default',
          body:
            method === 'GET'
              ? undefined
              : contentType === 'form'
                ? (data as BodyInit | undefined)
                : JSON.stringify(data ?? {}),
        });
      } catch {
        response = null;
      } finally {
        window.clearTimeout(timer);
      }

      const shouldRetry = attempt < maxAttempts - 1 && (!response || retryableStatusCodes.has(response.status));
      if (!shouldRetry) break;
      await delay(attempt === 0 ? 250 : 700);
    }

    if (!response) {
      throw new RequestError({
        kind: 'network',
        message: timedOut ? '网络响应较慢，请重试。' : '网络连接异常，请检查后重试。',
      });
    }

    return response;
  };

  const existingRequest = requestKey ? inFlightGetRequests.get(requestKey) : undefined;
  const responsePromise = existingRequest ?? execute();
  if (requestKey && !existingRequest) {
    inFlightGetRequests.set(requestKey, responsePromise);
    const clearInFlightRequest = () => {
      if (inFlightGetRequests.get(requestKey) === responsePromise) {
        inFlightGetRequests.delete(requestKey);
      }
    };
    void responsePromise.then(clearInFlightRequest, clearInFlightRequest);
  }

  const response = await responsePromise;

  if (response.status === 401) {
    if (adminAuth) {
      clearStoredAdminSession();
    } else if (auth) {
      clearDataCache();
      clearStoredSession();
    }
    throw new RequestError({
      kind: 'auth_expired',
      statusCode: 401,
      message: '登录状态已失效，请重新登录。',
    });
  }

  if (!response.ok) {
    throw new RequestError({
      kind: 'response',
      statusCode: response.status,
      message: `接口请求失败，状态码 ${response.status}。`,
    });
  }

  const payload = (await response.json()) as ApiResult<TResponse>;

  if (!payload || typeof payload !== 'object') {
    throw new RequestError({
      kind: 'response',
      message: '接口未返回有效数据。',
    });
  }

  if (payload.code !== 0) {
    throw new RequestError({
      kind: 'business',
      message: payload.message || '接口请求失败。',
    });
  }

  return payload.data;
}
