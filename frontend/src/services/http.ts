import Taro from '@tarojs/taro';
import { runtimeConfig } from '../config/runtime';
import type { ApiResult } from '../types/api';
import { RequestError } from '../utils/request-error';
import { clearStoredSession, getAuthToken } from './session';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TData> {
  url: string;
  method?: HttpMethod;
  data?: TData;
  auth?: boolean;
}

export async function request<TResponse, TData = Record<string, unknown>>({
  url,
  method = 'GET',
  data,
  auth = false,
}: RequestOptions<TData>): Promise<TResponse> {
  if (!runtimeConfig.apiBaseUrl) {
    throw new RequestError({
      kind: 'unknown',
      message: 'API Base URL 未配置，暂时无法请求远程接口。',
    });
  }

  const header: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (auth) {
    const token = getAuthToken();
    if (token) {
      header.Authorization = `Bearer ${token}`;
    }
  }

  let response;

  try {
    response = await Taro.request<ApiResult<TResponse>>({
      url: `${runtimeConfig.apiBaseUrl}${url}`,
      method,
      data,
      header,
    });
  } catch {
    throw new RequestError({
      kind: 'network',
      message: '网络连接异常，请检查后重试。',
    });
  }

  if (response.statusCode === 401) {
    clearStoredSession();
    throw new RequestError({
      kind: 'auth_expired',
      statusCode: 401,
      message: '登录状态已失效，请重新登录。',
    });
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new RequestError({
      kind: 'response',
      statusCode: response.statusCode,
      message: `接口请求失败，状态码 ${response.statusCode}。`,
    });
  }

  if (!response.data) {
    throw new RequestError({
      kind: 'response',
      statusCode: response.statusCode,
      message: '接口未返回有效数据。',
    });
  }

  if (response.data.code !== 0) {
    throw new RequestError({
      kind: 'business',
      statusCode: response.statusCode,
      message: response.data.message || '接口请求失败。',
    });
  }

  return response.data.data;
}
