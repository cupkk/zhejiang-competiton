import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AiBootstrapQuery, OrderRefundPayload, SearchQuery } from '../frontend/src/types/api';
import { serverConfig } from './config.ts';
import { loginWithWechatCode } from './auth-service.ts';
import {
  createCompetitionEnrollment,
  createResourceAcquire,
  createTeamApplication,
  createTeamRecruit,
  getCompetitionDetail,
  getCurrentUser,
  getHomeFeed,
  getOrderDetail,
  getResourceDetail,
  getSearchSuggestions,
  getTeamDetail,
  listFavorites,
  listCompetitionResources,
  listCompetitionTeams,
  listCompetitions,
  listNotifications,
  listOrders,
  listOwnedResources,
  listResources,
  listTeams,
  markNotificationRead,
  markNotificationsRead,
  patchCompetitionFavorite,
  patchResourceFavorite,
  searchAll,
} from './catalog-service.ts';
import {
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
import {
  createOrderPayment,
  createOrderRefund,
  createResourceDownload,
  getDownloadFilePayload,
  getDownloadGrant,
  handleWechatPaymentNotify,
  handleWechatRefundCallback,
  handleWechatTransactionCallback,
} from './payment-service.ts';
import { resolveSession } from './helpers.ts';

const app = express();
const basePath = serverConfig.basePath;

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
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Payment-Signature');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
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

function getAuthToken(req: Request) {
  const authHeader = req.header('Authorization') || '';
  return authHeader.replace(/^Bearer\s+/i, '');
}

function getRequestSession(req: Request) {
  return resolveSession(getAuthToken(req));
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
  if ((req.header('X-Admin-Key') || '') !== serverConfig.adminApiKey) {
    fail(res, 403, '管理员权限校验失败。');
    return;
  }

  next();
}

function authedUserId(res: Response) {
  return String(res.locals.userId || '');
}

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get(`${basePath}/health`, (_req, res) => {
  ok(res, {
    name: 'campus-growth-api',
    status: 'ok',
    dbPath: serverConfig.dbPath,
    wechatLoginMode: serverConfig.wechat.loginMode,
  });
});

app.post(
  `${basePath}/auth/wechat/login`,
  asyncRoute(async (req, res) => {
    const code = String(req.body?.code || '').trim();
    if (!code) {
      fail(res, 400, '缺少登录 code。');
      return;
    }

    ok(res, await loginWithWechatCode(code));
  })
);

app.get(`${basePath}/users/me`, requireAuth, (req, res) => {
  ok(res, getCurrentUser(authedUserId(res)));
});

app.get(`${basePath}/feeds/home`, (req, res) => {
  ok(res, getHomeFeed(getOptionalUserId(req)));
});

app.get(`${basePath}/competitions`, (req, res) => {
  ok(res, listCompetitions(req.query, getOptionalUserId(req)));
});

app.get(
  `${basePath}/competitions/:id`,
  asyncRoute(async (req, res) => {
    ok(res, getCompetitionDetail(req.params.id, getOptionalUserId(req)));
  })
);

app.get(`${basePath}/competitions/:id/resources`, (req, res) => {
  ok(res, listCompetitionResources(req.params.id, getOptionalUserId(req)));
});

app.get(`${basePath}/competitions/:id/teams`, (req, res) => {
  ok(res, listCompetitionTeams(req.params.id, getOptionalUserId(req)));
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

app.post(`${basePath}/resources/:id/downloads`, requireAuth, (req, res) => {
  ok(res, createResourceDownload(authedUserId(res), req.params.id));
});

app.get(`${basePath}/downloads/:grantId`, requireAuth, (req, res) => {
  ok(res, getDownloadGrant(authedUserId(res), req.params.grantId));
});

app.get(`${basePath}/downloads/:grantId/file`, requireAuth, (req, res) => {
  const file = getDownloadFilePayload(authedUserId(res), req.params.grantId);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
  res.status(200).send(file.content);
});

app.get(`${basePath}/users/resources`, requireAuth, (_req, res) => {
  ok(res, listOwnedResources(authedUserId(res)));
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
  };

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

app.post(`${basePath}/teams`, requireAuth, (req, res) => {
  ok(res, createTeamRecruit(authedUserId(res), req.body));
});

app.post(`${basePath}/teams/:id/applications`, requireAuth, (req, res) => {
  ok(res, createTeamApplication(authedUserId(res), req.params.id, req.body));
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

app.patch(`${basePath}/posts/:id/like`, requireAuth, (req, res) => {
  ok(res, togglePostLike(authedUserId(res), req.params.id, Boolean(req.body?.liked)));
});

app.patch(`${basePath}/comments/:id/like`, requireAuth, (req, res) => {
  ok(res, toggleCommentLike(authedUserId(res), req.params.id, Boolean(req.body?.liked)));
});

app.post(`${basePath}/reports`, requireAuth, (req, res) => {
  ok(res, createReport(authedUserId(res), req.body));
});

app.get(`${basePath}/reports`, requireAdmin, (_req, res) => {
  ok(res, listReports());
});

app.get(`${basePath}/moderation/tasks`, requireAdmin, (req, res) => {
  ok(
    res,
    listModerationTasks({
      status: req.query.status as 'pending' | 'processing' | 'approved' | 'rejected' | undefined,
      targetType: req.query.targetType as 'post' | 'comment' | 'team' | 'report' | undefined,
    })
  );
});

app.patch(`${basePath}/moderation/tasks/:id`, requireAdmin, (req, res) => {
  ok(res, reviewModerationTask(req.params.id, req.body));
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
    })
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
  const message = error instanceof Error ? error.message : 'unknown_error';

  switch (message) {
    case 'competition_not_found':
      return { status: 404, message: '竞赛不存在。' };
    case 'resource_not_found':
      return { status: 404, message: '资源不存在。' };
    case 'team_not_found':
      return { status: 404, message: '队伍不存在。' };
    case 'post_not_found':
      return { status: 404, message: '帖子不存在。' };
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
    case 'wechat_login_not_configured':
      return { status: 503, message: '微信登录环境尚未配置完成。' };
    case 'user_not_found':
      return { status: 404, message: '用户不存在。' };
    case 'comment_parent_invalid':
      return { status: 400, message: '评论回复关系不合法。' };
    case 'comment_content_required':
      return { status: 400, message: '评论内容不能为空。' };
    default:
      if (message.startsWith('wechat_pay_request_failed:')) {
        return { status: 502, message: `微信支付请求失败：${message.replace('wechat_pay_request_failed:', '')}` };
      }
      return { status: 400, message };
  }
}

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const mapped = mapError(error);

  if (
    req.path === `${basePath}/payments/wechat/notify` ||
    req.path === `${basePath}/payments/wechat/refund-notify`
  ) {
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
