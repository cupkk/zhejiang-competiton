import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import type { AdminPermission, AdminRole } from '../frontend/src/types/api';

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
const allowedOrigins = Array.from(
  new Set(
    [
      publicOrigin,
      'https://campusgrow.top',
      'https://www.campusgrow.top',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      ...(process.env.ALLOWED_ORIGINS || '').split(','),
    ]
      .map((item) => item.trim())
      .filter(Boolean)
  )
);

const databaseProvider = process.env.DB_PROVIDER === 'postgres' ? 'postgres' : 'sqlite';
const storageProvider = process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local';
const paymentsEnabled = process.env.PAYMENTS_ENABLED === 'true';
const teamShowcaseSchoolId = process.env.TEAM_SHOWCASE_SCHOOL_ID || 'sch_114';
const teamApplicationsEnabled = process.env.TEAM_APPLICATIONS_ENABLED === 'true';
const verificationDebugCodeVisible =
  process.env.VERIFICATION_DEBUG_CODE_VISIBLE === 'true' ||
  (process.env.VERIFICATION_DEBUG_CODE_VISIBLE !== 'false' && process.env.WECHAT_LOGIN_MODE !== 'real');

const adminPermissions: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'home:read',
    'home:write',
    'school_home:read',
    'school_home:write',
    'moderation:read',
    'moderation:write',
    'school_management:read',
    'school_management:write',
    'competition_management:read',
    'competition_management:write',
    'audit:read',
  ],
  moderator: ['home:read', 'school_home:read', 'moderation:read', 'moderation:write'],
  operator: ['home:read', 'home:write', 'moderation:read', 'competition_management:read', 'competition_management:write'],
  school_admin: ['school_home:read', 'school_home:write', 'moderation:read', 'moderation:write'],
};

export const serverConfig = {
  port,
  basePath,
  publicOrigin,
  allowedOrigins,
  databaseProvider,
  postgresUrl: process.env.POSTGRES_URL || '',
  dbPath: resolve(process.cwd(), process.env.DB_PATH || 'server/data/campus-growth.db'),
  storageProvider,
  paymentsEnabled,
  teamShowcaseSchoolId,
  teamApplicationsEnabled,
  verificationDebugCodeVisible,
  storageRoot: resolve(process.cwd(), process.env.STORAGE_ROOT || 'server/storage'),
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || '',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 7),
  adminSessionTtlDays: Number(process.env.ADMIN_SESSION_TTL_DAYS || 7),
  adminBootstrap: {
    username: process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin',
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'ChangeMe123!',
    displayName: process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || 'Platform Admin',
  },
  adminPermissions,
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
