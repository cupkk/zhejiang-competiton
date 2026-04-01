import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

function normalizeMode(value: string | undefined, fallback: 'hybrid' | 'real' | 'mock') {
  if (value === 'hybrid' || value === 'real' || value === 'mock') {
    return value;
  }

  return fallback;
}

function resolveOptionalPath(pathValue: string | undefined) {
  return pathValue ? resolve(process.cwd(), pathValue) : '';
}

function readOptionalFile(pathValue: string | undefined) {
  const resolvedPath = resolveOptionalPath(pathValue);
  if (!resolvedPath) {
    return '';
  }

  return readFileSync(resolvedPath, 'utf8');
}

const port = Number(process.env.API_PORT || 8080);
const basePath = process.env.API_BASE_PATH || '/api';
const publicOrigin = process.env.API_PUBLIC_ORIGIN || `http://127.0.0.1:${port}`;

export const serverConfig = {
  port,
  basePath,
  publicOrigin,
  dbPath: resolve(process.cwd(), process.env.DB_PATH || 'server/data/campus-growth.db'),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 7),
  adminApiKey: process.env.ADMIN_API_KEY || 'dev-admin-key',
  paymentNotifySecret: process.env.WECHAT_PAY_NOTIFY_SECRET || '',
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
    loginMode: normalizeMode(process.env.WECHAT_LOGIN_MODE, 'hybrid'),
  },
  wechatPay: {
    mode: normalizeMode(process.env.WECHAT_PAY_MODE, 'hybrid'),
    appId: process.env.WECHAT_PAY_APP_ID || process.env.WECHAT_APP_ID || '',
    mchId: process.env.WECHAT_PAY_MCH_ID || '',
    serialNo: process.env.WECHAT_PAY_SERIAL_NO || '',
    privateKeyPath: resolveOptionalPath(process.env.WECHAT_PAY_PRIVATE_KEY_PATH),
    privateKey: readOptionalFile(process.env.WECHAT_PAY_PRIVATE_KEY_PATH),
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
    notifyUrl:
      process.env.WECHAT_PAY_NOTIFY_URL || `${publicOrigin}${basePath}/payments/wechat/notify`,
    refundNotifyUrl:
      process.env.WECHAT_PAY_REFUND_NOTIFY_URL ||
      `${publicOrigin}${basePath}/payments/wechat/refund-notify`,
    platformPublicKeyPath: resolveOptionalPath(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH),
    platformPublicKey: readOptionalFile(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH),
    platformCertPath: resolveOptionalPath(process.env.WECHAT_PAY_PLATFORM_CERT_PATH),
    platformCert: readOptionalFile(process.env.WECHAT_PAY_PLATFORM_CERT_PATH),
    platformSerial: process.env.WECHAT_PAY_PLATFORM_SERIAL || '',
  },
} as const;

export function hasWechatCredential() {
  return Boolean(serverConfig.wechat.appId && serverConfig.wechat.appSecret);
}

export function hasWechatPayCredential() {
  return Boolean(
    serverConfig.wechatPay.appId &&
      serverConfig.wechatPay.mchId &&
      serverConfig.wechatPay.serialNo &&
      serverConfig.wechatPay.privateKey &&
      serverConfig.wechatPay.apiV3Key &&
      (serverConfig.wechatPay.platformPublicKey || serverConfig.wechatPay.platformCert)
  );
}
