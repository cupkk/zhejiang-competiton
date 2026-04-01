export const runtimeDefineConstants = {
  'process.env.TARO_APP_API_BASE_URL': JSON.stringify('http://127.0.0.1:8080/api'),
  'process.env.TARO_APP_PREFER_REMOTE': JSON.stringify('true'),
  'process.env.TARO_APP_ENABLE_MOCK_FALLBACK': JSON.stringify('true'),
} as const;
