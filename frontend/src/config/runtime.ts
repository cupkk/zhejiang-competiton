export const runtimeConfig = {
  apiBaseUrl: process.env.TARO_APP_API_BASE_URL || '',
  preferRemoteApi: process.env.TARO_APP_PREFER_REMOTE === 'true',
  enableMockFallback: process.env.TARO_APP_ENABLE_MOCK_FALLBACK !== 'false',
};

export function shouldUseRemoteApi() {
  return runtimeConfig.preferRemoteApi && Boolean(runtimeConfig.apiBaseUrl);
}

export function getRuntimeModeLabel() {
  if (!shouldUseRemoteApi()) {
    return '本地 Mock';
  }

  if (runtimeConfig.enableMockFallback) {
    return '远程优先 / Mock 回退';
  }

  return '仅远程接口';
}
