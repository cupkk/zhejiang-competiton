import 'dotenv/config';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type { AdminPermission, AdminRole, AiBootstrapQuery, OrderRefundPayload, SearchQuery, TeamQuery } from '../frontend/src/types/api';
import { getCurrentAdmin, loginAdminWithPassword, logoutAdminByToken } from './admin-auth-service.ts';
import {
  createAdminCompetition,
  createAdminPublishedResource,
  createSchoolAdmin,
  archiveAdminTeamExamples,
  getAdminDashboardSummary,
  getAdminSchoolHomeConfig,
  ensureAdminResourceAssetUser,
  listAdminAuditEntries,
  listAdminCompetitions,
  listAdminSchools,
  listAdminTeamExamples,
  updateAdminSchool,
  updateAdminCompetition,
  updateAdminSchoolHomeConfig,
  updateSchoolAdmin,
} from './admin-management-service.ts';
import { loginWithWechatCode } from './auth-service.ts';
import {
  createCompetitionEnrollment,
  createResourceAcquire,
  createResourceSubmission,
  createTeamApplication,
  createTeamRecruit,
  getCompetitionDetail,
  getCurrentUser,
  getHomeFeed,
  getHomeFeedConfig,
  getOrderDetail,
  getResourceDetail,
  getSearchSuggestions,
  getTeamDetail,
  getUserActivity,
  listCompetitionResources,
  listCompetitionTeams,
  listCompetitions,
  listFavorites,
  listMyResourceSubmissions,
  listNotifications,
  listOrders,
  listOwnedResources,
  listResources,
  listTeamApplications,
  listTeams,
  markNotificationRead,
  markNotificationsRead,
  patchCompetitionFavorite,
  patchResourceFavorite,
  revealTeamContact,
  reviewTeamApplication,
  searchAll,
  updateCurrentUser,
  updateCurrentUserIdentity,
  updateHomeFeedConfig,
} from './catalog-service.ts';
import { checkinToday, getCheckinState } from './checkin-service.ts';
import {
  getSchoolLogoSource,
  listCurrentUserSchoolMemberships,
  listSchools,
  requestSchoolVerificationCode,
  selectCurrentUserSchool,
  verifySchoolVerificationCode,
} from './school-service.ts';
import {
  acceptPostAnswer,
  createPost,
  createPostComment,
  createReport,
  getAiBootstrap,
  getPostDetail,
  listModerationTasks,
  listPostComments,
  listPosts,
  listReports,
  patchPostFavorite,
  replyAi,
  reviewModerationTask,
  toggleCommentLike,
  togglePostLike,
} from './community-service.ts';
import { serverConfig } from './config.ts';
import {
  getDownloadFilePayload,
  getDownloadGrant,
  createOrderPayment,
  createOrderRefund,
  createResourceDownload,
  handleWechatPaymentNotify,
  handleWechatRefundCallback,
  handleWechatTransactionCallback,
} from './payment-service.ts';
import { createAdminAuditLog, getOne, resolveAdminSession, resolveSession, run } from './helpers.ts';
import {
  createUserAvatarImage,
  createHomeFeedImage,
  createResourceAsset,
  getAvatarImageRoot,
  getHomeFeedImageRoot,
  readAvatarImageContent,
  readHomeFeedImageContent,
} from './storage-service.ts';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const basePath = serverConfig.basePath;

const genericUploadMimeTypes = new Set(['', 'application/octet-stream', 'binary/octet-stream']);
const homeFeedImageFileTypes: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};
const resourceFileTypes: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
  '.zip': ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

const homeFeedImageUpload = createUploadMiddleware({
  allowedTypes: homeFeedImageFileTypes,
  maxFileSizeBytes: 5 * 1024 * 1024,
  typeErrorCode: 'upload_image_type_not_allowed',
});
const avatarImageUpload = createUploadMiddleware({
  allowedTypes: homeFeedImageFileTypes,
  maxFileSizeBytes: 3 * 1024 * 1024,
  typeErrorCode: 'upload_avatar_type_not_allowed',
});
const resourceFileUpload = createUploadMiddleware({
  allowedTypes: resourceFileTypes,
  allowGenericMimeTypes: true,
  maxFileSizeBytes: 30 * 1024 * 1024,
  typeErrorCode: 'upload_resource_type_not_allowed',
});
const wechatLoginLimiter = createRateLimiter({
  keyPrefix: 'auth:wechat-login',
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: '登录请求过于频繁，请稍后再试。',
});
const adminLoginLimiter = createRateLimiter({
  keyPrefix: 'auth:admin-login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: '管理员登录尝试过于频繁，请 15 分钟后再试。',
});
const verificationCodeLimiter = createRateLimiter({
  keyPrefix: 'school-verification:send',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: '验证码发送过于频繁，请稍后再试。',
  key: (req, res) =>
    [
      res.locals.userId || getRateLimitIp(req),
      req.body?.channel,
      req.body?.target,
    ]
      .map(rateLimitKeyPart)
      .join(':'),
});
const verificationVerifyLimiter = createRateLimiter({
  keyPrefix: 'school-verification:verify',
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: '验证码校验过于频繁，请稍后再试。',
  key: (req, res) =>
    [
      res.locals.userId || getRateLimitIp(req),
      req.body?.channel,
      req.body?.target,
    ]
      .map(rateLimitKeyPart)
      .join(':'),
});

type UploadTypeMap = Record<string, string[]>;

function createUploadMiddleware(options: {
  allowedTypes: UploadTypeMap;
  allowGenericMimeTypes?: boolean;
  maxFileSizeBytes: number;
  typeErrorCode: string;
}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: options.maxFileSizeBytes,
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      const extension = getUploadExtension(file.originalname);
      const allowedMimeTypes = extension ? options.allowedTypes[extension] : undefined;
      const mimeType = normalizeMimeType(file.mimetype);

      if (
        !allowedMimeTypes ||
        (!allowedMimeTypes.includes(mimeType) &&
          !(options.allowGenericMimeTypes && genericUploadMimeTypes.has(mimeType)))
      ) {
        cb(new Error(options.typeErrorCode));
        return;
      }

      cb(null, true);
    },
  });
}

function getUploadExtension(fileName: string) {
  const extension = extname(fileName || '').toLowerCase();
  if (!extension || extension.length > 16 || /[^a-z0-9.]/.test(extension)) {
    return '';
  }
  return extension;
}

function normalizeMimeType(value: string | undefined) {
  return String(value || '').trim().toLowerCase();
}

function resolveUploadContentType(file: Express.Multer.File, allowedTypes: UploadTypeMap) {
  const extension = getUploadExtension(file.originalname);
  const mimeType = normalizeMimeType(file.mimetype);
  if (extension && allowedTypes[extension]?.includes(mimeType)) {
    return mimeType;
  }
  return extension ? allowedTypes[extension]?.[0] || 'application/octet-stream' : 'application/octet-stream';
}

function hasBytes(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function assertSupportedImageContent(file: Express.Multer.File) {
  const extension = getUploadExtension(file.originalname);
  const buffer = file.buffer;
  const valid =
    (['.jpg', '.jpeg'].includes(extension) && hasBytes(buffer, [0xff, 0xd8, 0xff])) ||
    (extension === '.png' && hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (extension === '.webp' &&
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP');

  if (!valid) {
    throw new Error('upload_image_invalid');
  }
}

let rateLimitRequestCount = 0;

function rateLimitKeyPart(value: unknown) {
  return String(value || 'none')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .slice(0, 128);
}

function getRateLimitIp(req: Request) {
  return req.ip || getRequestIp(req) || 'unknown';
}

function createRateLimiter(options: {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message: string;
  key?: (req: Request, res: Response) => string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const identity = options.key ? options.key(req, res) : getRateLimitIp(req);
    const key = createHash('sha256').update(`${options.keyPrefix}:${identity}`).digest('hex');
    const resetAt = now + options.windowMs;
    const updatedAt = new Date(now).toISOString();
    run(
      `INSERT INTO rate_limit_buckets (bucket_key, count, reset_at, updated_at)
       VALUES (@key, 1, @resetAt, @updatedAt)
       ON CONFLICT (bucket_key) DO UPDATE SET
         count = CASE WHEN rate_limit_buckets.reset_at <= @now THEN 1 ELSE rate_limit_buckets.count + 1 END,
         reset_at = CASE WHEN rate_limit_buckets.reset_at <= @now THEN @resetAt ELSE rate_limit_buckets.reset_at END,
         updated_at = @updatedAt`,
      { key, now, resetAt, updatedAt },
    );
    const bucket = getOne<{ count: number; reset_at: number }>(
      'SELECT count, reset_at FROM rate_limit_buckets WHERE bucket_key = @key',
      { key },
    );

    rateLimitRequestCount += 1;
    if (rateLimitRequestCount % 500 === 0) {
      run('DELETE FROM rate_limit_buckets WHERE reset_at < @expiredBefore', { expiredBefore: now - 86_400_000 });
    }

    if (bucket && bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.reset_at - now) / 1000))));
      fail(res, 429, options.message);
      return;
    }

    next();
  };
}

interface RawBodyRequest extends Request {
  rawBody?: string;
}

app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString('utf8');
    },
  })
);
const homeFeedImageRoot = getHomeFeedImageRoot();
if (homeFeedImageRoot) {
  app.use(`${basePath}/uploads/home-feed`, express.static(homeFeedImageRoot));
}

function assertSupportedResourceContent(file: Express.Multer.File) {
  const extension = getUploadExtension(file.originalname);
  const buffer = file.buffer;
  const zipBased = ['.zip', '.docx', '.pptx', '.xlsx'].includes(extension);
  const legacyOffice = ['.doc', '.ppt', '.xls'].includes(extension);
  const textBased = ['.txt', '.csv', '.md'].includes(extension);
  const valid =
    (extension === '.pdf' && buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') ||
    (zipBased && buffer.length >= 4 && hasBytes(buffer, [0x50, 0x4b, 0x03, 0x04])) ||
    (legacyOffice && buffer.length >= 8 && hasBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) ||
    (textBased && buffer.length > 0 && !buffer.subarray(0, 4096).includes(0)) ||
    (['.jpg', '.jpeg', '.png', '.webp'].includes(extension) && (() => {
      try {
        assertSupportedImageContent(file);
        return true;
      } catch {
        return false;
      }
    })());
  if (!valid) throw new Error('upload_resource_invalid');
}
const avatarImageRoot = getAvatarImageRoot();
if (avatarImageRoot) {
  app.use(`${basePath}/uploads/avatars`, express.static(avatarImageRoot));
}
app.get(`${basePath}/uploads/home-feed/:fileName`, asyncRoute(async (req, res) => {
  const file = await readHomeFeedImageContent(req.params.fileName);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(file.content);
}));
app.get(`${basePath}/uploads/avatars/:fileName`, asyncRoute(async (req, res) => {
  const file = await readAvatarImageContent(req.params.fileName);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(file.content);
}));
app.use((req, res, next) => {
  const origin = req.header('Origin') || '';
  if (origin && serverConfig.allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Signature');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    if (origin && !serverConfig.allowedOrigins.includes(origin)) {
      res.status(403).end();
      return;
    }
    res.status(204).end();
    return;
  }

  next();
});
const clientErrorLimiter = createRateLimiter({
  keyPrefix: 'client-error',
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: '错误上报过于频繁。',
});

app.use((req, res, next) => {
  const sensitivePath =
    req.path.startsWith(`${basePath}/auth/`) ||
    req.path.startsWith(`${basePath}/users/`) ||
    req.path.startsWith(`${basePath}/admin/`);
  if (sensitivePath || req.header('authorization')) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.append('Vary', 'Authorization');
  }
  next();
});

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (res.statusCode >= 500 || durationMs >= 2_000) {
      console.warn(JSON.stringify({
        event: 'api_request_issue',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      }));
    }
  });
  next();
});

function sanitizeClientErrorText(value: unknown, maxLength: number) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

app.post(`${basePath}/client-errors`, clientErrorLimiter, (req, res) => {
  const kind = ['runtime', 'promise', 'route'].includes(req.body?.kind) ? req.body.kind : 'runtime';
  const path = sanitizeClientErrorText(req.body?.path, 300);
  const safePath = path.startsWith('/') && !path.includes('?') ? path : '/';
  console.error(JSON.stringify({
    event: 'client_error',
    kind,
    path: safePath,
    message: sanitizeClientErrorText(req.body?.message, 500),
    source: sanitizeClientErrorText(req.body?.source, 200),
    stack: sanitizeClientErrorText(req.body?.stack, 2_000),
    client: createHash('sha256').update(getRateLimitIp(req)).digest('hex').slice(0, 12),
    userAgent: sanitizeClientErrorText(req.header('User-Agent'), 200),
  }));
  res.status(204).end();
});

function ok<T>(res: Response, data: T) {
  res.json({
    code: 0,
    message: 'ok',
    data,
  });
}

function fail(res: Response, status: number, message: string) {
  res.status(status).json({
    code: status,
    message,
    data: null,
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.header('Authorization') || '';
  return authHeader.replace(/^Bearer\s+/i, '');
}

function getRequestSession(req: Request) {
  return resolveSession(getBearerToken(req));
}

function getAdminRequestSession(req: Request) {
  return resolveAdminSession(getBearerToken(req));
}

function getOptionalUserId(req: Request) {
  return getRequestSession(req)?.userId;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getRequestSession(req);
  if (!session) {
    fail(res, 401, '登录状态已失效，请重新登录。');
    return;
  }

  res.locals.userId = session.userId;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getAdminRequestSession(req);
  if (!session) {
    fail(res, 401, '管理员登录状态已失效，请重新登录。');
    return;
  }

  res.locals.adminUserId = session.adminUserId;
  res.locals.adminRole = session.role;
  res.locals.adminSchoolId = session.schoolId;
  res.locals.adminSchoolName = session.schoolName;
  next();
}

function requireAdminPermission(...permissions: AdminPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = getAdminRequestSession(req);
    if (!session) {
      fail(res, 401, '管理员登录状态已失效，请重新登录。');
      return;
    }

    const rolePermissions = serverConfig.adminPermissions[session.role] || [];
    const allowed = permissions.every((permission) => rolePermissions.includes(permission));
    if (!allowed) {
      fail(res, 403, '当前管理员没有执行该操作的权限。');
      return;
    }

    res.locals.adminUserId = session.adminUserId;
    res.locals.adminRole = session.role;
    res.locals.adminSchoolId = session.schoolId;
    res.locals.adminSchoolName = session.schoolName;
    next();
  };
}

function authedUserId(res: Response) {
  return String(res.locals.userId || '');
}

function authedAdminUserId(res: Response) {
  return String(res.locals.adminUserId || '');
}

function authedAdminScope(res: Response) {
  return {
    role: (res.locals.adminRole || 'operator') as AdminRole,
    schoolId: res.locals.adminSchoolId ? String(res.locals.adminSchoolId) : null,
  };
}

function getRequestIp(req: Request) {
  const forwarded = req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || req.ip || null;
  }

  return req.ip || null;
}

function getCompetitionViewerKey(req: Request) {
  const userId = getOptionalUserId(req);
  if (userId) return `user:${userId}`;

  const browserId = (req.header('x-viewer-id') || '').trim().slice(0, 80);
  const rawValue = browserId || getRequestIp(req) || 'anonymous';
  return `anon:${createHash('sha256').update(rawValue).digest('hex').slice(0, 32)}`;
}

function createAdminAuditLogFromRequest(
  req: Request,
  adminUserId: string,
  action: string,
  options: {
    targetType?: string | null;
    targetId?: string | null;
    detail?: unknown;
  } = {}
) {
  createAdminAuditLog({
    adminUserId,
    action,
    targetType: options.targetType,
    targetId: options.targetId,
    detail: options.detail,
    ip: getRequestIp(req),
    userAgent: req.header('user-agent') || null,
  });
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get(`${basePath}/health`, (_req, res) => {
  ok(res, {
    name: 'campus-growth-api',
    status: 'ok',
    dbPath: serverConfig.dbPath,
    databaseProvider: serverConfig.databaseProvider,
    storageProvider: serverConfig.storageProvider,
    wechatLoginMode: serverConfig.wechat.loginMode,
    paymentsEnabled: serverConfig.paymentsEnabled,
    teamShowcaseSchoolId: serverConfig.teamShowcaseSchoolId,
    teamApplicationsEnabled: serverConfig.teamApplicationsEnabled,
  });
});

app.post(
  `${basePath}/auth/wechat/login`,
  wechatLoginLimiter,
  asyncRoute(async (req, res) => {
    const code = String(req.body?.code || '').trim();
    if (!code) {
      fail(res, 400, '缺少登录 code。');
      return;
    }

    ok(res, await loginWithWechatCode(code));
  })
);

app.post(
  `${basePath}/admin/auth/login`,
  adminLoginLimiter,
  asyncRoute(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    if (!username || !password) {
      fail(res, 400, '请输入管理员账号和密码。');
      return;
    }

    const session = loginAdminWithPassword({ username, password });
    createAdminAuditLogFromRequest(req, session.admin.id, 'admin.login', {
      detail: {
        username: session.admin.username,
        role: session.admin.role,
      },
    });
    ok(res, session);
  })
);

app.get(`${basePath}/admin/me`, requireAdmin, (_req, res) => {
  ok(res, getCurrentAdmin(authedAdminUserId(res)));
});

app.get(`${basePath}/admin/dashboard`, requireAdmin, (_req, res) => {
  ok(res, getAdminDashboardSummary(authedAdminScope(res)));
});

app.post(`${basePath}/admin/auth/logout`, requireAdmin, (req, res) => {
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'admin.logout');
  logoutAdminByToken(getBearerToken(req));
  ok(res, { success: true });
});

app.get(`${basePath}/users/me`, requireAuth, (_req, res) => {
  ok(res, getCurrentUser(authedUserId(res)));
});

app.patch(`${basePath}/users/me`, requireAuth, (req, res) => {
  ok(res, updateCurrentUser(authedUserId(res), req.body));
});

app.patch(`${basePath}/users/me/identity`, requireAuth, (req, res) => {
  ok(res, updateCurrentUserIdentity(authedUserId(res), req.body));
});

app.post(`${basePath}/uploads/avatar`, requireAuth, avatarImageUpload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) {
    fail(res, 400, '未收到头像图片。');
    return;
  }

  assertSupportedImageContent(req.file);
  ok(
    res,
    await createUserAvatarImage({
      userId: authedUserId(res),
      originalName: req.file.originalname,
      contentType: resolveUploadContentType(req.file, homeFeedImageFileTypes),
      buffer: req.file.buffer,
    })
  );
}));

app.patch(`${basePath}/users/me/school`, requireAuth, (req, res) => {
  ok(res, selectCurrentUserSchool(authedUserId(res), req.body));
});

app.get(`${basePath}/schools`, (req, res) => {
  ok(
    res,
    listSchools({
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      hotOnly: req.query.hotOnly === 'true',
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
  );
});

app.get(`${basePath}/users/me/school-memberships`, requireAuth, (_req, res) => {
  ok(res, listCurrentUserSchoolMemberships(authedUserId(res)));
});

app.post(`${basePath}/users/me/school-verification/code`, requireAuth, verificationCodeLimiter, (req, res) => {
  ok(res, requestSchoolVerificationCode(authedUserId(res), req.body));
});

app.post(`${basePath}/users/me/school-verification/verify`, requireAuth, verificationVerifyLimiter, (req, res) => {
  ok(res, verifySchoolVerificationCode(authedUserId(res), req.body));
});

app.get(`${basePath}/users/activity`, requireAuth, (_req, res) => {
  ok(res, getUserActivity(authedUserId(res)));
});

app.get(`${basePath}/users/me/checkin`, requireAuth, (req, res) => {
  ok(res, getCheckinState(authedUserId(res), req.query.month ? String(req.query.month) : undefined));
});

app.get(
  `${basePath}/schools/:id/logo`,
  asyncRoute(async (req, res) => {
    const source = getSchoolLogoSource(req.params.id);
    if (!source) {
      fail(res, 404, '学校校徽不存在。');
      return;
    }

    if (!/^https:\/\//i.test(source)) {
      fail(res, 400, '该校徽不支持代理加载。');
      return;
    }

    const sourceUrl = new URL(source);
    if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'static-data.gaokao.cn') {
      fail(res, 400, '该校徽不支持代理加载。');
      return;
    }

    const response = await fetch(sourceUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'image/png,image/jpeg,image/webp' },
    });
    const contentType = (response.headers.get('content-type') || '').split(';')[0]?.trim().toLowerCase();
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!response.ok || !contentType || !allowedTypes.has(contentType)) {
      fail(res, 502, '学校校徽加载失败。');
      return;
    }

    const content = Buffer.from(await response.arrayBuffer());
    if (content.length === 0 || content.length > 1024 * 1024) {
      fail(res, 502, '学校校徽文件不符合要求。');
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(content);
  })
);

app.post(`${basePath}/users/me/checkin`, requireAuth, (_req, res) => {
  ok(res, checkinToday(authedUserId(res)));
});

app.get(`${basePath}/feeds/home`, (req, res) => {
  ok(res, getHomeFeed(getOptionalUserId(req)));
});

app.get(`${basePath}/admin/home-config`, requireAdminPermission('home:read'), (_req, res) => {
  ok(res, getHomeFeedConfig());
});

app.get(`${basePath}/admin/school-home-config`, requireAdminPermission('school_home:read'), (req, res) => {
  ok(
    res,
    getAdminSchoolHomeConfig(
      authedAdminScope(res),
      req.query.schoolId ? String(req.query.schoolId) : undefined
    )
  );
});

app.patch(`${basePath}/admin/school-home-config`, requireAdminPermission('school_home:write'), (req, res) => {
  const result = updateAdminSchoolHomeConfig(authedAdminUserId(res), authedAdminScope(res), req.body);
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'school_home.update', {
    targetType: 'school',
    targetId: result.schoolId,
    detail: {
      announcement: result.announcement,
      teamIds: result.teamIds,
      postIds: result.postIds,
    },
  });
  ok(res, result);
});

app.patch(`${basePath}/admin/home-config`, requireAdminPermission('home:write'), (req, res) => {
  const result = updateHomeFeedConfig(req.body);
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'home_config.update', {
    targetType: 'home_feed',
    targetId: 'default',
    detail: {
      publishStatus: result.publishStatus,
      bannerCount: result.banners.length,
      quickLinkCount: result.quickLinks.length,
    },
  });
  ok(res, result);
});

app.post(`${basePath}/admin/home-config/hero-image`, requireAdminPermission('home:write'), homeFeedImageUpload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) {
    fail(res, 400, '未收到首页运营图片文件。');
    return;
  }

  assertSupportedImageContent(req.file);
  const result = await createHomeFeedImage({
    originalName: req.file.originalname,
    contentType: resolveUploadContentType(req.file, homeFeedImageFileTypes),
    buffer: req.file.buffer,
  });
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'home_config.upload_image', {
    targetType: 'home_feed',
    targetId: 'default',
    detail: {
      fileName: result.fileName,
      imageUrl: result.imageUrl,
    },
  });
  ok(res, result);
}));

function parseAdminFormArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    // Accept newline/comma separated values from simple admin forms.
  }
  return text.split(/[\r\n,，、]+/).map((item) => item.trim()).filter(Boolean);
}

app.post(
  `${basePath}/admin/resources/publish`,
  requireAdminPermission('moderation:write'),
  resourceFileUpload.single('file'),
  asyncRoute(async (req, res) => {
    if (!req.file) {
      fail(res, 400, '请选择需要发布的资源文件。');
      return;
    }
    assertSupportedResourceContent(req.file);
    const adminUserId = authedAdminUserId(res);
    const assetUserId = ensureAdminResourceAssetUser(adminUserId);
    const asset = await createResourceAsset({
      userId: assetUserId,
      originalName: req.file.originalname,
      contentType: resolveUploadContentType(req.file, resourceFileTypes),
      buffer: req.file.buffer,
    });
    const result = createAdminPublishedResource(authedAdminScope(res), adminUserId, asset.assetId, {
      title: String(req.body?.title || ''),
      category: String(req.body?.category || ''),
      description: String(req.body?.description || ''),
      suitableFor: String(req.body?.suitableFor || ''),
      tags: parseAdminFormArray(req.body?.tags),
      previewPoints: parseAdminFormArray(req.body?.previewPoints),
      relatedCompetitionIds: parseAdminFormArray(req.body?.relatedCompetitionIds),
    });
    createAdminAuditLogFromRequest(req, adminUserId, 'resource.publish', {
      targetType: 'resource',
      targetId: result.id,
      detail: { title: result.title, contentScope: result.contentScope, schoolId: result.schoolId, fileAssetId: result.fileAssetId },
    });
    ok(res, result);
  }),
);

app.get(`${basePath}/competitions`, (req, res) => {
  ok(res, listCompetitions(req.query, getOptionalUserId(req)));
});

app.get(
  `${basePath}/competitions/:id`,
  asyncRoute(async (req, res) => {
    ok(res, getCompetitionDetail(req.params.id, getOptionalUserId(req), getCompetitionViewerKey(req)));
  })
);

app.get(`${basePath}/competitions/:id/resources`, (req, res) => {
  ok(res, listCompetitionResources(req.params.id, getOptionalUserId(req)));
});

app.get(`${basePath}/competitions/:id/teams`, (req, res) => {
  ok(res, listCompetitionTeams(req.params.id, getOptionalUserId(req)));
});

app.get(`${basePath}/admin/competitions`, requireAdminPermission('competition_management:read'), (req, res) => {
  ok(res, listAdminCompetitions(authedAdminScope(res), {
    keyword: req.query.keyword ? String(req.query.keyword) : undefined,
    publishStatus: req.query.publishStatus ? String(req.query.publishStatus) : undefined,
    limit: req.query.limit,
  }));
});

app.post(`${basePath}/admin/competitions`, requireAdminPermission('competition_management:write'), (req, res) => {
  const result = createAdminCompetition(authedAdminScope(res), req.body || {});
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'competition.create', {
    targetType: 'competition',
    targetId: result.id,
    detail: { title: result.title, publishStatus: result.publishStatus, sourceUrl: result.sourceUrl },
  });
  ok(res, result);
});

app.patch(`${basePath}/admin/competitions/:id`, requireAdminPermission('competition_management:write'), (req, res) => {
  const result = updateAdminCompetition(authedAdminScope(res), req.params.id, req.body || {});
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'competition.update', {
    targetType: 'competition',
    targetId: result.id,
    detail: { title: result.title, publishStatus: result.publishStatus, sourceUrl: result.sourceUrl },
  });
  ok(res, result);
});

app.get(`${basePath}/admin/schools`, requireAdminPermission('school_management:read'), (req, res) => {
  ok(
    res,
    listAdminSchools({
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    })
  );
});

app.patch(`${basePath}/admin/schools/:id`, requireAdminPermission('school_management:write'), (req, res) => {
  const result = updateAdminSchool(req.params.id, req.body || {});
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'school.update', {
    targetType: 'school',
    targetId: req.params.id,
    detail: req.body,
  });
  ok(res, result);
});

app.post(`${basePath}/admin/schools/:id/admins`, requireAdminPermission('school_management:write'), (req, res) => {
  const result = createSchoolAdmin(req.params.id, req.body || {});
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'school_admin.create', {
    targetType: 'admin_user',
    targetId: result?.id,
    detail: { schoolId: req.params.id, username: result?.username },
  });
  ok(res, result);
});

app.patch(`${basePath}/admin/school-admins/:id`, requireAdminPermission('school_management:write'), (req, res) => {
  const result = updateSchoolAdmin(req.params.id, req.body || {});
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'school_admin.update', {
    targetType: 'admin_user',
    targetId: req.params.id,
    detail: {
      displayName: result?.displayName,
      status: result?.status,
      passwordReset: Boolean(req.body?.password),
    },
  });
  ok(res, result);
});

app.get(`${basePath}/admin/audit-logs`, requireAdminPermission('audit:read'), (req, res) => {
  ok(
    res,
    listAdminAuditEntries({
      schoolId: req.query.schoolId ? String(req.query.schoolId) : undefined,
      adminUserId: req.query.adminUserId ? String(req.query.adminUserId) : undefined,
      action: req.query.action ? String(req.query.action) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      limit: req.query.limit,
    })
  );
});

app.get(`${basePath}/competitions/:id/posts`, (req, res) => {
  ok(
    res,
    listPosts(
      { category: '经验贴', relatedCompetitionId: req.params.id },
      getOptionalUserId(req)
    )
  );
});

app.patch(`${basePath}/competitions/:id/favorite`, requireAuth, (req, res) => {
  ok(res, patchCompetitionFavorite(authedUserId(res), req.params.id, req.body));
});

app.post(`${basePath}/competitions/:id/enrollments`, requireAuth, (req, res) => {
  ok(res, createCompetitionEnrollment(authedUserId(res), req.params.id));
});

app.get(`${basePath}/resources`, (req, res) => {
  ok(res, listResources(req.query, getOptionalUserId(req)));
});

app.get(
  `${basePath}/resources/:id`,
  asyncRoute(async (req, res) => {
    ok(res, getResourceDetail(req.params.id, getOptionalUserId(req)));
  })
);

app.patch(`${basePath}/resources/:id/favorite`, requireAuth, (req, res) => {
  ok(res, patchResourceFavorite(authedUserId(res), req.params.id, req.body));
});

app.post(`${basePath}/resources/:id/acquisitions`, requireAuth, (req, res) => {
  ok(res, createResourceAcquire(authedUserId(res), req.params.id, req.body));
});

app.post(`${basePath}/uploads/resource-file`, requireAuth, resourceFileUpload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) {
    fail(res, 400, '未收到上传文件。');
    return;
  }

  assertSupportedResourceContent(req.file);

  ok(
    res,
    await createResourceAsset({
      userId: authedUserId(res),
      originalName: req.file.originalname,
      contentType: resolveUploadContentType(req.file, resourceFileTypes),
      buffer: req.file.buffer,
    })
  );
}));

app.post(`${basePath}/resources`, requireAuth, (req, res) => {
  ok(res, createResourceSubmission(authedUserId(res), req.body));
});

app.post(`${basePath}/resources/:id/downloads`, requireAuth, (req, res) => {
  ok(res, createResourceDownload(authedUserId(res), req.params.id));
});

app.get(`${basePath}/downloads/:grantId`, requireAuth, (req, res) => {
  ok(res, getDownloadGrant(authedUserId(res), req.params.grantId));
});

app.get(`${basePath}/downloads/:grantId/file`, requireAuth, asyncRoute(async (req, res) => {
  const file = await getDownloadFilePayload(authedUserId(res), req.params.grantId);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
  res.status(200).send(file.content);
}));

app.get(`${basePath}/users/resources`, requireAuth, (_req, res) => {
  ok(res, listOwnedResources(authedUserId(res)));
});

app.get(`${basePath}/users/resource-submissions`, requireAuth, (_req, res) => {
  ok(res, listMyResourceSubmissions(authedUserId(res)));
});

app.get(`${basePath}/orders`, requireAuth, (_req, res) => {
  ok(res, listOrders(authedUserId(res)));
});

app.get(`${basePath}/orders/:id`, requireAuth, (req, res) => {
  ok(res, getOrderDetail(authedUserId(res), req.params.id));
});

app.post(
  `${basePath}/orders/:id/pay`,
  requireAuth,
  asyncRoute(async (req, res) => {
    ok(res, await createOrderPayment(authedUserId(res), req.params.id));
  })
);

app.post(
  `${basePath}/orders/:id/refunds`,
  requireAuth,
  asyncRoute(async (req, res) => {
    ok(res, await createOrderRefund(authedUserId(res), req.params.id, req.body as OrderRefundPayload));
  })
);

app.get(`${basePath}/teams`, (req, res) => {
  const userId = getOptionalUserId(req);
  const query = {
    ...req.query,
    mineOnly: req.query.mineOnly === 'true',
    showcase: req.query.showcase === 'true',
    schoolScope:
      req.query.schoolScope === 'current'
        ? 'current'
        : req.query.schoolScope === 'other'
          ? 'other'
          : 'all',
  } as TeamQuery;

  if (query.mineOnly && !userId) {
    fail(res, 401, '登录状态已失效，请重新登录。');
    return;
  }

  ok(res, listTeams(query, userId));
});

app.get(
  `${basePath}/teams/:id`,
  asyncRoute(async (req, res) => {
    ok(res, getTeamDetail(req.params.id, getOptionalUserId(req)));
  })
);

app.post(`${basePath}/teams/:id/contact-views`, requireAuth, (req, res) => {
  ok(res, revealTeamContact(authedUserId(res), req.params.id));
});

app.post(`${basePath}/teams`, requireAuth, (req, res) => {
  ok(res, createTeamRecruit(authedUserId(res), req.body));
});

app.post(`${basePath}/teams/:id/applications`, requireAuth, (req, res) => {
  ok(res, createTeamApplication(authedUserId(res), req.params.id, req.body));
});

app.get(`${basePath}/teams/:id/applications`, requireAuth, (req, res) => {
  ok(res, listTeamApplications(authedUserId(res), req.params.id));
});

app.patch(`${basePath}/team-applications/:id`, requireAuth, (req, res) => {
  ok(res, reviewTeamApplication(authedUserId(res), req.params.id, req.body));
});

app.get(`${basePath}/posts`, (req, res) => {
  ok(res, listPosts(req.query, getOptionalUserId(req)));
});

app.get(
  `${basePath}/posts/:id`,
  asyncRoute(async (req, res) => {
    ok(res, getPostDetail(req.params.id, getOptionalUserId(req)));
  })
);

app.post(`${basePath}/posts`, requireAuth, (req, res) => {
  ok(res, createPost(authedUserId(res), req.body));
});

app.patch(`${basePath}/posts/:id/favorite`, requireAuth, (req, res) => {
  ok(res, patchPostFavorite(authedUserId(res), req.params.id, req.body));
});

app.get(`${basePath}/posts/:id/comments`, (req, res) => {
  ok(res, listPostComments(req.params.id, getOptionalUserId(req)));
});

app.post(`${basePath}/posts/:id/comments`, requireAuth, (req, res) => {
  ok(res, createPostComment(authedUserId(res), req.params.id, req.body));
});

app.patch(`${basePath}/posts/:id/accepted-comment`, requireAuth, (req, res) => {
  ok(res, acceptPostAnswer(authedUserId(res), req.params.id, String(req.body?.commentId || '')));
});

app.patch(`${basePath}/posts/:id/like`, requireAuth, (req, res) => {
  ok(res, togglePostLike(authedUserId(res), req.params.id, Boolean(req.body?.liked)));
});

app.patch(`${basePath}/comments/:id/like`, requireAuth, (req, res) => {
  ok(res, toggleCommentLike(authedUserId(res), req.params.id, Boolean(req.body?.liked)));
});

app.post(`${basePath}/reports`, requireAuth, (req, res) => {
  ok(res, createReport(authedUserId(res), req.body));
});

app.get(`${basePath}/reports`, requireAdminPermission('moderation:read'), (req, res) => {
  ok(
    res,
    listReports(
      {
        schoolId: req.query.schoolId ? String(req.query.schoolId) : undefined,
      },
      authedAdminScope(res)
    )
  );
});

app.get(`${basePath}/moderation/tasks`, requireAdminPermission('moderation:read'), (req, res) => {
  ok(
    res,
    listModerationTasks(
      {
        status: req.query.status as 'pending' | 'processing' | 'approved' | 'rejected' | undefined,
        targetType: req.query.targetType as 'post' | 'comment' | 'team' | 'report' | 'resource' | undefined,
        schoolId: req.query.schoolId ? String(req.query.schoolId) : undefined,
      },
      authedAdminScope(res)
    )
  );
});

app.patch(`${basePath}/moderation/tasks/:id`, requireAdminPermission('moderation:write'), (req, res) => {
  const result = reviewModerationTask(req.params.id, req.body, authedAdminScope(res));
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'moderation.review', {
    detail: {
      taskId: result.taskId,
      status: result.status,
      note: req.body?.note,
    },
  });
  ok(res, result);
});

app.get(`${basePath}/admin/team-examples`, requireAdminPermission('moderation:read'), (req, res) => {
  ok(
    res,
    listAdminTeamExamples(authedAdminScope(res), {
      schoolId: req.query.schoolId ? String(req.query.schoolId) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
    }),
  );
});

app.patch(`${basePath}/admin/team-examples/archive`, requireAdminPermission('moderation:write'), (req, res) => {
  const result = archiveAdminTeamExamples(authedAdminScope(res), req.body?.ids);
  createAdminAuditLogFromRequest(req, authedAdminUserId(res), 'team_examples.archive', {
    detail: { ids: req.body?.ids, archivedCount: result.archivedCount },
  });
  ok(res, result);
});

app.get(`${basePath}/notifications`, requireAuth, (req, res) => {
  ok(res, listNotifications(authedUserId(res), req.query));
});

app.patch(`${basePath}/notifications/:id/read`, requireAuth, (req, res) => {
  ok(res, markNotificationRead(authedUserId(res), req.params.id));
});

app.patch(`${basePath}/notifications/read`, requireAuth, (req, res) => {
  ok(res, markNotificationsRead(authedUserId(res), req.body || {}));
});

app.get(`${basePath}/users/favorites`, requireAuth, (req, res) => {
  ok(res, listFavorites(authedUserId(res), req.query));
});

app.get(`${basePath}/search/suggestions`, (_req, res) => {
  ok(res, getSearchSuggestions());
});

app.get(`${basePath}/search`, (req, res) => {
  ok(
    res,
    searchAll({
      keyword: String(req.query.keyword || ''),
      scope: (req.query.scope as SearchQuery['scope']) || 'all',
    }, getOptionalUserId(req))
  );
});

app.get(`${basePath}/ai/bootstrap`, (req, res) => {
  ok(
    res,
    getAiBootstrap({
      source: req.query.source as AiBootstrapQuery['source'],
      id: req.query.id ? String(req.query.id) : undefined,
    })
  );
});

app.post(`${basePath}/ai/reply`, (req, res) => {
  ok(res, replyAi(req.body));
});

app.post(`${basePath}/payments/wechat/notify`, (req, res, next) => {
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
  try {
    const hasWechatSignature = Boolean(headers['wechatpay-signature']);

    if (hasWechatSignature) {
      handleWechatTransactionCallback((req as RawBodyRequest).rawBody || JSON.stringify(req.body || {}), headers);
    } else {
      handleWechatPaymentNotify(req.body, req.header('X-Payment-Signature') || '');
    }

    res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    next(error);
  }
});

app.post(`${basePath}/payments/wechat/refund-notify`, (req, res, next) => {
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
  try {
    handleWechatRefundCallback((req as RawBodyRequest).rawBody || JSON.stringify(req.body || {}), headers);
    res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    next(error);
  }
});

function mapError(error: unknown) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return { status: 413, message: '上传文件过大，请压缩后再试。' };
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return { status: 400, message: '一次只能上传一个文件。' };
    }
    return { status: 400, message: '文件上传失败，请重新选择文件。' };
  }

  const message = error instanceof Error ? error.message : 'unknown_error';

  switch (message) {
    case 'competition_not_found':
      return { status: 404, message: '竞赛不存在。' };
    case 'admin_competition_invalid':
      return { status: 400, message: '请补全竞赛名称、主办方、参赛对象和简介。' };
    case 'admin_competition_source_invalid':
      return { status: 400, message: '官方来源必须是有效的 HTTP 或 HTTPS 链接。' };
    case 'admin_competition_quality_invalid':
      return { status: 400, message: '发布前请补齐届次、团队人数、赛程、提交材料、官方来源和核验日期，并将质量状态设为已核验。' };
    case 'admin_resource_invalid':
      return { status: 400, message: '请补全资源名称、分类和简介。' };
    case 'resource_not_found':
      return { status: 404, message: '资源不存在。' };
    case 'resource_content_required':
      return { status: 400, message: '请补全资源投稿信息。' };
    case 'resource_asset_invalid':
      return { status: 400, message: '资源文件不能为空。' };
    case 'upload_resource_type_not_allowed':
      return { status: 415, message: '资料仅支持 PDF、Office、图片、TXT、CSV、Markdown 或 ZIP 文件。' };
    case 'upload_resource_invalid':
      return { status: 415, message: '文件内容与扩展名不匹配，请检查后重新上传。' };
    case 'upload_avatar_type_not_allowed':
      return { status: 415, message: '头像仅支持 JPG、PNG 或 WebP 图片。' };
    case 'upload_image_type_not_allowed':
      return { status: 415, message: '首页图片仅支持 JPG、PNG 或 WebP。' };
    case 'upload_image_invalid':
    case 'home_feed_image_invalid':
    case 'avatar_image_invalid':
      return { status: 400, message: '图片文件内容无法识别，请重新选择 JPG、PNG 或 WebP。' };
    case 'avatar_image_not_found':
      return { status: 404, message: '头像图片不存在。' };
    case 'team_not_found':
      return { status: 404, message: '队伍不存在。' };
    case 'team_content_required':
      return { status: 400, message: '请补全组队招募信息。' };
    case 'team_contact_closed':
      return { status: 409, message: '该组队信息已结束，联系方式已关闭。' };
    case 'team_example_contact_unavailable':
      return { status: 409, message: '内测示例不提供真实联系方式。' };
    case 'team_applications_disabled':
      return { status: 403, message: '平台不提供站内组队申请，请通过发布者邮箱联系。' };
    case 'post_not_found':
      return { status: 404, message: '帖子不存在。' };
    case 'post_content_required':
      return { status: 400, message: '请填写帖子标题和正文。' };
    case 'post_answer_forbidden':
      return { status: 403, message: '只有发帖人可以采纳回答。' };
    case 'post_not_question':
      return { status: 409, message: '当前帖子不是问答，不能采纳回答。' };
    case 'post_answer_invalid':
      return { status: 400, message: '该回答不存在或尚未通过审核。' };
    case 'comment_not_found':
      return { status: 404, message: '评论不存在。' };
    case 'order_not_found':
      return { status: 404, message: '订单不存在。' };
    case 'moderation_task_not_found':
      return { status: 404, message: '审核任务不存在。' };
    case 'download_grant_not_found':
      return { status: 404, message: '下载授权不存在。' };
    case 'notification_not_found':
      return { status: 404, message: '消息不存在。' };
    case 'download_grant_expired':
      return { status: 410, message: '下载授权已过期，请重新获取。' };
    case 'resource_not_owned':
      return { status: 403, message: '当前账号没有下载该资源的权限。' };
    case 'resource_payment_pending':
      return { status: 409, message: '资源订单尚未支付完成。' };
    case 'resource_file_missing':
      return { status: 409, message: '该资源暂未提供可下载文件。' };
    case 'external_resource_not_downloadable':
      return { status: 409, message: '该内容来自官网，请打开原文查看。' };
    case 'content_not_available':
      return { status: 403, message: '当前内容暂不可访问。' };
    case 'payment_signature_invalid':
      return { status: 401, message: '支付回调签名校验失败。' };
    case 'payment_notify_invalid':
      return { status: 400, message: '支付回调报文格式不合法。' };
    case 'refund_not_available':
      return { status: 409, message: '当前订单状态不支持退款。' };
    case 'order_not_payable':
      return { status: 409, message: '当前订单状态不支持继续支付。' };
    case 'wechat_pay_not_configured':
      return { status: 503, message: '微信支付环境尚未配置完成。' };
    case 'payments_disabled':
      return { status: 403, message: '当前版本暂未开放在线支付。' };
    case 'wechat_login_not_configured':
      return { status: 503, message: '微信登录环境尚未配置完成。' };
    case 'user_not_found':
      return { status: 404, message: '用户不存在。' };
    case 'user_identity_required':
      return { status: 400, message: '请填写昵称。' };
    case 'user_school_required':
      return { status: 400, message: '请选择学校。' };
    case 'school_verification_required':
      return { status: 403, message: '请先完成教育邮箱和手机号认证。' };
    case 'school_not_found':
      return { status: 404, message: '学校不存在或暂未开通。' };
    case 'verification_channel_invalid':
      return { status: 400, message: '验证码类型不正确。' };
    case 'education_email_invalid':
      return { status: 400, message: '请填写学校教育邮箱。' };
    case 'phone_invalid':
      return { status: 400, message: '请填写有效手机号。' };
    case 'verification_code_invalid':
      return { status: 400, message: '验证码不正确。' };
    case 'verification_code_expired':
      return { status: 410, message: '验证码已过期，请重新获取。' };
    case 'verification_code_locked':
      return { status: 429, message: '验证码错误次数过多，请重新获取。' };
    case 'comment_parent_invalid':
      return { status: 400, message: '评论回复关系不合法。' };
    case 'comment_content_required':
      return { status: 400, message: '评论内容不能为空。' };
    case 'admin_login_failed':
      return { status: 401, message: '管理员账号或密码错误。' };
    case 'admin_login_invalid':
      return { status: 400, message: '管理员账号和密码不能为空。' };
    case 'admin_user_not_found':
      return { status: 404, message: '管理员账号不存在。' };
    case 'admin_scope_forbidden':
      return { status: 403, message: '当前管理员不能处理该学校的内容。' };
    case 'admin_school_required':
      return { status: 400, message: '请选择要管理的学校。' };
    case 'admin_team_examples_required':
      return { status: 400, message: '请选择要归档的内测示例。' };
    case 'admin_team_example_not_found':
      return { status: 404, message: '内测示例不存在或已被删除。' };
    case 'school_home_content_invalid':
      return { status: 400, message: '推荐内容必须来自本校已审核内容。' };
    case 'admin_school_update_invalid':
      return { status: 400, message: '没有可更新的学校字段。' };
    case 'admin_username_invalid':
      return { status: 400, message: '管理员账号需为 4-32 位字母、数字或 ._-。' };
    case 'admin_username_exists':
      return { status: 409, message: '管理员账号已存在。' };
    case 'admin_password_weak':
      return { status: 400, message: '管理员密码至少需要 10 位。' };
    case 'admin_display_name_invalid':
      return { status: 400, message: '请填写 1-40 位管理员名称。' };
    default:
      if (message.startsWith('wechat_pay_request_failed:')) {
        return { status: 502, message: `微信支付请求失败：${message.replace('wechat_pay_request_failed:', '')}` };
      }
      return { status: 400, message };
  }
}

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const mapped = mapError(error);

  if (req.path === `${basePath}/payments/wechat/notify` || req.path === `${basePath}/payments/wechat/refund-notify`) {
    res.status(mapped.status).json({
      code: 'FAIL',
      message: mapped.message,
    });
    return;
  }

  fail(res, mapped.status, mapped.message);
});

app.listen(serverConfig.port, () => {
  console.log(`Campus growth api listening on http://127.0.0.1:${serverConfig.port}${basePath}`);
});
