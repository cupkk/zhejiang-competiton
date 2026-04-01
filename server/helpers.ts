import { createHash, randomUUID } from 'node:crypto';
import type {
  NotificationItem,
  OrderItem,
  OwnedResourceItem,
  PostItem,
  ResourceAccessStatus,
  TeamApplicationStatus,
  UserProfile,
} from '../frontend/src/types/entities';
import { serverConfig } from './config.ts';
import { db } from './db.ts';
import type {
  CommentRow,
  CompetitionRow,
  DownloadGrantRow,
  ModerationTaskItem,
  ModerationTaskRow,
  NotificationRow,
  OrderRow,
  OwnedResourceRow,
  PostCommentItem,
  PostRow,
  ResourceRow,
  SessionRow,
  TeamRow,
  UserRow,
} from './models.ts';

type SqlValue = string | number | bigint | Uint8Array | null;

export type SqlParams = Record<string, SqlValue>;

export function getOne<T>(sql: string, params: SqlParams = {}) {
  return (db.prepare(sql).get(params) as T | undefined) ?? null;
}

export function getAll<T>(sql: string, params: SqlParams = {}) {
  return db.prepare(sql).all(params) as T[];
}

export function run(sql: string, params: SqlParams = {}) {
  return db.prepare(sql).run(params);
}

export function parseJsonArray<T>(value: string) {
  return JSON.parse(value) as T[];
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function makeToken() {
  return createHash('sha256').update(`${randomUUID()}_${Date.now()}`).digest('hex');
}

export function now() {
  return new Date();
}

export function nowIso() {
  return now().toISOString();
}

export function addDays(days: number) {
  const date = now();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function addHours(hours: number) {
  const date = now();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function formatDate(date = now()) {
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(date = now()) {
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`;
}

export function justNowLabel() {
  return '刚刚';
}

export function getUserRowById(userId: string) {
  const user = getOne<UserRow>(
    `
      SELECT id, open_id, union_id, session_key, name, mark, school, major, grade, bio, focus_tags_json
      FROM users
      WHERE id = @userId
    `,
    { userId }
  );

  if (!user) {
    throw new Error('user_not_found');
  }

  return user;
}

export function buildCurrentUser(userId: string): UserProfile {
  const user = getUserRowById(userId);
  const favoriteRow = getOne<{ count: number }>(`SELECT COUNT(*) AS count FROM favorites WHERE user_id = @userId`, {
    userId,
  });
  const teamRow = getOne<{ count: number }>(
    `
      SELECT COUNT(DISTINCT id) AS count FROM (
        SELECT t.id
        FROM teams t
        WHERE t.author_user_id = @userId
        UNION
        SELECT ta.team_id AS id
        FROM team_applications ta
        WHERE ta.user_id = @userId
      )
    `,
    { userId }
  );
  const resourceRow = getOne<{ count: number }>(`SELECT COUNT(*) AS count FROM owned_resources WHERE user_id = @userId`, {
    userId,
  });
  const unreadRow = getOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = @userId AND unread = 1`,
    { userId }
  );

  return {
    id: user.id,
    name: user.name,
    mark: user.mark,
    school: user.school,
    major: user.major,
    grade: user.grade,
    bio: user.bio,
    focusTags: parseJsonArray<string>(user.focus_tags_json),
    stats: {
      favorites: favoriteRow?.count ?? 0,
      teams: teamRow?.count ?? 0,
      resources: resourceRow?.count ?? 0,
      unreadMessages: unreadRow?.count ?? 0,
    },
  };
}

export function pushNotification(
  userId: string,
  item: Omit<NotificationItem, 'id' | 'time' | 'unread'> & { time?: string; unread?: boolean }
) {
  run(
    `
      INSERT INTO notifications (
        id, user_id, category, title, content, time_label, unread, link_type, link_id, link_scene, comment_id, cta_text, created_at
      ) VALUES (
        @id, @userId, @category, @title, @content, @timeLabel, @unread, @linkType, @linkId, @linkScene, @commentId, @ctaText, @createdAt
      )
    `,
    {
      id: createId('m'),
      userId,
      category: item.category,
      title: item.title,
      content: item.content,
      timeLabel: item.time || justNowLabel(),
      unread: item.unread === false ? 0 : 1,
      linkType: item.linkType,
      linkId: item.linkId || null,
      linkScene: item.linkScene || null,
      commentId: item.commentId || null,
      ctaText: item.ctaText,
      createdAt: nowIso(),
    }
  );
}

export function createModerationTask(
  targetType: ModerationTaskRow['target_type'],
  targetId: string,
  action: string,
  note?: string
) {
  run(
    `
      INSERT INTO moderation_tasks (id, target_type, target_id, action, status, note, created_at, reviewed_at)
      VALUES (@id, @targetType, @targetId, @action, 'pending', @note, @createdAt, NULL)
    `,
    {
      id: createId('mod'),
      targetType,
      targetId,
      action,
      note: note || null,
      createdAt: nowIso(),
    }
  );
}

export function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    time: row.time_label,
    unread: Boolean(row.unread),
    linkType: row.link_type,
    linkId: row.link_id || undefined,
    linkScene: row.link_scene || undefined,
    commentId: row.comment_id || undefined,
    ctaText: row.cta_text,
  };
}

export function mapOwnedResource(row: OwnedResourceRow): OwnedResourceItem {
  return {
    id: row.id,
    resourceId: row.resource_id,
    title: row.title,
    type: row.type,
    accessType: row.access_type,
    acquiredAt: row.acquired_at,
    downloadCount: row.download_count,
    tags: parseJsonArray<string>(row.tags_json),
  };
}

export function mapOrder(row: OrderRow): OrderItem {
  return {
    id: row.id,
    title: row.title,
    itemType: row.item_type,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at || undefined,
    resourceId: row.resource_id || undefined,
    coverLabel: row.cover_label,
  };
}

export function mapPost(row: PostRow, userId?: string): PostItem {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    content: parseJsonArray<string>(row.content_json),
    category: row.category,
    authorName: row.author_name,
    authorMark: row.author_mark,
    likes: row.likes_count,
    comments: row.comments_count,
    tags: parseJsonArray<string>(row.tags_json),
    time: row.time_label,
    relatedCompetitionId: row.related_competition_id || undefined,
    relatedResourceId: row.related_resource_id || undefined,
    viewer: {
      isLiked: isPostLiked(userId, row.id),
      isFavorited: isFavorited(userId, 'post', row.id),
    },
  };
}

export function mapComment(
  row: CommentRow,
  isLiked: boolean,
  options: {
    replyToAuthorName?: string;
  } = {}
): PostCommentItem {
  return {
    id: row.id,
    postId: row.post_id,
    parentCommentId: row.parent_comment_id || undefined,
    replyToCommentId: row.reply_to_comment_id || undefined,
    replyToAuthorName: options.replyToAuthorName,
    authorName: row.author_name,
    authorMark: row.author_mark,
    content: row.content,
    likes: row.likes_count,
    status: row.moderation_status as PostCommentItem['status'],
    createdAt: row.created_at,
    replyCount: 0,
    replies: [],
    viewer: {
      isLiked,
    },
  };
}

export function mapModerationTask(row: ModerationTaskRow): ModerationTaskItem {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    status: row.status,
    note: row.note || undefined,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || undefined,
  };
}

export function isFavorited(userId: string | undefined, targetType: 'competition' | 'resource' | 'post', targetId: string) {
  if (!userId) {
    return false;
  }

  return Boolean(
    getOne<{ id: string }>(
      `
        SELECT id
        FROM favorites
        WHERE user_id = @userId AND target_type = @targetType AND target_id = @targetId
      `,
      { userId, targetType, targetId }
    )
  );
}

export function isEnrolled(userId: string | undefined, competitionId: string) {
  if (!userId) {
    return false;
  }

  return Boolean(
    getOne<{ id: string }>(
      `
        SELECT id
        FROM competition_enrollments
        WHERE user_id = @userId AND competition_id = @competitionId
      `,
      { userId, competitionId }
    )
  );
}

export function getResourceViewerAccessStatus(userId: string | undefined, resourceId: string): ResourceAccessStatus {
  if (!userId) {
    return 'not_acquired';
  }

  const owned = getOne<{ id: string }>(
    `SELECT id FROM owned_resources WHERE user_id = @userId AND resource_id = @resourceId`,
    { userId, resourceId }
  );
  if (owned) {
    return 'owned';
  }

  const pending = getOne<{ id: string }>(
    `
      SELECT id
      FROM orders
      WHERE user_id = @userId AND resource_id = @resourceId AND status = '待支付'
    `,
    { userId, resourceId }
  );

  return pending ? 'pending_payment' : 'not_acquired';
}

export function getTeamApplicationViewerStatus(userId: string | undefined, teamId: string): TeamApplicationStatus {
  if (!userId) {
    return 'none';
  }

  const row = getOne<{ status: TeamApplicationStatus }>(
    `SELECT status FROM team_applications WHERE user_id = @userId AND team_id = @teamId`,
    { userId, teamId }
  );

  return row?.status ?? 'none';
}

export function isPostLiked(userId: string | undefined, postId: string) {
  if (!userId) {
    return false;
  }

  return Boolean(
    getOne<{ id: string }>(`SELECT id FROM post_likes WHERE user_id = @userId AND post_id = @postId`, {
      userId,
      postId,
    })
  );
}

export function isCommentLiked(userId: string | undefined, commentId: string) {
  if (!userId) {
    return false;
  }

  return Boolean(
    getOne<{ id: string }>(`SELECT id FROM comment_likes WHERE user_id = @userId AND comment_id = @commentId`, {
      userId,
      commentId,
    })
  );
}

export function resolveSession(token: string) {
  if (!token) {
    return null;
  }

  const session = getOne<SessionRow>(
    `SELECT token, user_id, mode, expires_at FROM sessions WHERE token = @token`,
    { token }
  );

  if (!session) {
    return null;
  }

  if (Date.parse(session.expires_at) <= Date.now()) {
    run(`DELETE FROM sessions WHERE token = @token`, { token });
    return null;
  }

  return {
    token: session.token,
    userId: session.user_id,
    mode: session.mode,
    expiresAt: session.expires_at,
  };
}

export function createOrUpdateOwnedResource(
  userId: string,
  resource: { id: string; title: string; type: string; tags: string[] },
  accessType: OwnedResourceItem['accessType']
) {
  const existing = getOne<OwnedResourceRow>(
    `
      SELECT id, user_id, resource_id, title, type, access_type, acquired_at, download_count, tags_json
      FROM owned_resources
      WHERE user_id = @userId AND resource_id = @resourceId
    `,
    { userId, resourceId: resource.id }
  );

  if (existing) {
    return mapOwnedResource(existing);
  }

  const id = createId('mr');
  run(
    `
      INSERT INTO owned_resources (
        id, user_id, resource_id, title, type, access_type, acquired_at, download_count, tags_json, created_at
      ) VALUES (
        @id, @userId, @resourceId, @title, @type, @accessType, @acquiredAt, 0, @tagsJson, @createdAt
      )
    `,
    {
      id,
      userId,
      resourceId: resource.id,
      title: resource.title,
      type: resource.type,
      accessType,
      acquiredAt: formatDate(),
      tagsJson: JSON.stringify(resource.tags),
      createdAt: nowIso(),
    }
  );

  return mapOwnedResource(
    getOne<OwnedResourceRow>(
      `
        SELECT id, user_id, resource_id, title, type, access_type, acquired_at, download_count, tags_json
        FROM owned_resources
        WHERE id = @id
      `,
      { id }
    )!
  );
}

export function ensureDownloadGrant(userId: string, resourceId: string, grantType: string, orderId?: string | null) {
  const grantId = createId('grant');
  const expiresAt = addHours(2);
  const downloadUrl = `${serverConfig.publicOrigin}${serverConfig.basePath}/downloads/${grantId}/file`;

  run(
    `
      INSERT INTO resource_download_grants (
        id, user_id, resource_id, order_id, grant_type, download_url, expires_at, created_at
      ) VALUES (
        @id, @userId, @resourceId, @orderId, @grantType, @downloadUrl, @expiresAt, @createdAt
      )
    `,
    {
      id: grantId,
      userId,
      resourceId,
      orderId: orderId || null,
      grantType,
      downloadUrl,
      expiresAt,
      createdAt: nowIso(),
    }
  );

  return {
    grantId,
    downloadUrl,
    expiresAt,
  };
}

export function getDownloadGrantRow(grantId: string, userId: string) {
  const grant = getOne<DownloadGrantRow>(
    `
      SELECT id, user_id, resource_id, order_id, grant_type, download_url, expires_at
      FROM resource_download_grants
      WHERE id = @grantId AND user_id = @userId
    `,
    { grantId, userId }
  );

  if (!grant) {
    throw new Error('download_grant_not_found');
  }

  if (grant.expires_at && Date.parse(grant.expires_at) <= Date.now()) {
    throw new Error('download_grant_expired');
  }

  return grant;
}
