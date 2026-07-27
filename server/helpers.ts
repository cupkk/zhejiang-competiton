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
import type { AdminProfile } from '../frontend/src/types/api';
import { serverConfig } from './config.ts';
import { db } from './db.ts';
import type {
  AdminAuditLogRow,
  CommentRow,
  CompetitionRow,
  DownloadGrantRow,
  AdminSessionRow,
  AdminUserRow,
  ModerationTaskItem,
  ModerationTaskRow,
  NotificationRow,
  OrderRow,
  OwnedResourceRow,
  PostCommentItem,
  PostRow,
  ReportRow,
  ResourceRow,
  SessionRow,
  SchoolRow,
  TeamRow,
  UserSchoolMembershipRow,
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

export function isLikelyCorruptText(value: string | null | undefined) {
  const compact = value?.trim() ?? '';
  if (!compact) {
    return false;
  }

  const questionMarks = compact.match(/\?/g)?.length ?? 0;
  const meaningfulText = compact.replace(/[?\s.,，。!！:：;；、'"“”‘’()[\]（）-]/g, '');
  return questionMarks >= 3 && meaningfulText.length === 0;
}

export function getUserRowById(userId: string) {
  const user = getOne<UserRow>(
    `
      SELECT id, open_id, union_id, session_key, name, mark, avatar_url, school, major, grade, bio, focus_tags_json,
             points, checkin_streak, last_checkin_date
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

export function getSchoolRowById(schoolId: string) {
  const school = getOne<SchoolRow>(
    `
      SELECT id, source_id, code, name, short_name, province, city, logo_url, is_open, is_hot, sort_order, created_at, updated_at
      FROM schools
      WHERE id = @schoolId
    `,
    { schoolId }
  );

  if (!school) {
    throw new Error('school_not_found');
  }

  return school;
}

export function getSchoolRowByName(name: string) {
  const value = name.trim();
  if (!value) {
    return null;
  }

  return getOne<SchoolRow>(
    `
      SELECT id, source_id, code, name, short_name, province, city, logo_url, is_open, is_hot, sort_order, created_at, updated_at
      FROM schools
      WHERE name = @name
      ORDER BY is_hot DESC,
               CASE WHEN id LIKE 'sch_%' THEN 0 ELSE 1 END,
               sort_order ASC,
               id ASC
      LIMIT 1
    `,
    { name: value }
  );
}

export function getActiveSchoolMembership(userId: string) {
  return getOne<UserSchoolMembershipRow>(
    `
      SELECT id, user_id, school_id, school_name, role, certification_status, education_email, phone,
             email_verified, phone_verified, active, verified_at, created_at, updated_at
      FROM user_school_memberships
      WHERE user_id = @userId AND active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    { userId }
  );
}

export function getActiveSchoolId(userId: string | undefined) {
  return userId ? getActiveSchoolMembership(userId)?.school_id ?? null : null;
}

export function getVerifiedActiveSchoolId(userId: string | undefined) {
  if (!userId) return null;
  const membership = getActiveSchoolMembership(userId);
  if (
    !membership ||
    membership.certification_status !== 'verified' ||
    !membership.email_verified ||
    !membership.phone_verified
  ) {
    return null;
  }
  return membership.school_id;
}

export function getRequiredVerifiedSchoolId(userId: string) {
  const membership = getActiveSchoolMembership(userId);
  if (!membership) throw new Error('user_school_required');
  const schoolId = getVerifiedActiveSchoolId(userId);
  if (!schoolId) throw new Error('school_verification_required');
  return schoolId;
}

export function isContentAccessible(
  row: { content_scope?: string | null; school_id?: string | null },
  userId?: string
) {
  if (row.content_scope === 'platform') return true;
  if (row.content_scope !== 'school' || !row.school_id) return false;
  return getVerifiedActiveSchoolId(userId) === row.school_id;
}

export function requireContentAccessible<T extends { content_scope?: string | null; school_id?: string | null }>(
  row: T,
  userId?: string
) {
  if (!isContentAccessible(row, userId)) throw new Error('content_not_available');
  return row;
}

export function isNotificationTargetAccessible(
  row: Pick<NotificationRow, 'link_type' | 'link_id'>,
  userId: string
) {
  if (!row.link_id || row.link_type === 'order') return true;

  const tableByLinkType = {
    competition: 'competitions',
    resource: 'resources',
    team: 'teams',
    post: 'posts',
  } as const;
  const table = tableByLinkType[row.link_type as keyof typeof tableByLinkType];
  if (!table) return false;

  const target = getOne<{ school_id: string | null; content_scope: string }>(
    `SELECT school_id, content_scope FROM ${table} WHERE id = @id`,
    { id: row.link_id }
  );
  return Boolean(target && isContentAccessible(target, userId));
}

export function countAccessibleUnreadNotifications(userId: string) {
  return getAll<Pick<NotificationRow, 'link_type' | 'link_id'>>(
    `SELECT link_type, link_id FROM notifications WHERE user_id = @userId AND unread = 1`,
    { userId }
  ).filter((row) => isNotificationTargetAccessible(row, userId)).length;
}

export function getAdminUserById(adminUserId: string) {
  const admin = getOne<AdminUserRow>(
    `
      SELECT id, username, password_hash, display_name, role, permissions_json, school_id, school_name, status, created_at, updated_at
      FROM admin_users
      WHERE id = @adminUserId
    `,
    { adminUserId }
  );

  if (!admin) {
    throw new Error('admin_user_not_found');
  }

  return admin;
}

export function buildAdminProfile(adminUserId: string): AdminProfile {
  const admin = getAdminUserById(adminUserId);

  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.display_name,
    role: admin.role,
    permissions: parseJsonArray(admin.permissions_json),
    scope: admin.role === 'school_admin' ? 'school' : 'platform',
    schoolId: admin.school_id || undefined,
    schoolName: admin.school_name || undefined,
  };
}

export function buildCurrentUser(userId: string): UserProfile {
  const user = getUserRowById(userId);
  const activeSchool = getActiveSchoolMembership(userId);
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
      ) AS related_teams
    `,
    { userId }
  );
  const resourceRow = getOne<{ count: number }>(`SELECT COUNT(*) AS count FROM owned_resources WHERE user_id = @userId`, {
    userId,
  });
  const unreadMessages = countAccessibleUnreadNotifications(userId);

  return {
    id: user.id,
    name: user.name,
    mark: user.mark,
    avatarUrl: user.avatar_url || undefined,
    school: activeSchool?.school_name || user.school,
    schoolId: activeSchool?.school_id || undefined,
    schoolCertificationStatus: activeSchool?.certification_status ?? 'unverified',
    major: user.major,
    grade: user.grade,
      bio: user.bio,
      focusTags: parseJsonArray<string>(user.focus_tags_json),
      stats: {
        favorites: favoriteRow?.count ?? 0,
        teams: teamRow?.count ?? 0,
        resources: resourceRow?.count ?? 0,
        unreadMessages,
        points: Number(user.points || 0),
        checkinStreak: Number(user.checkin_streak || 0),
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

export function createAdminAuditLog(params: {
  adminUserId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}) {
  run(
    `
      INSERT INTO admin_audit_logs (
        id, admin_user_id, action, target_type, target_id, detail_json, ip, user_agent, created_at
      ) VALUES (
        @id, @adminUserId, @action, @targetType, @targetId, @detailJson, @ip, @userAgent, @createdAt
      )
    `,
    {
      id: createId('audit'),
      adminUserId: params.adminUserId,
      action: params.action,
      targetType: params.targetType || null,
      targetId: params.targetId || null,
      detailJson: params.detail ? JSON.stringify(params.detail) : null,
      ip: params.ip || null,
      userAgent: params.userAgent || null,
      createdAt: nowIso(),
    }
  );
}

export function listAdminAuditLogs(limit = 50) {
  return getAll<AdminAuditLogRow>(
    `
      SELECT id, admin_user_id, action, target_type, target_id, detail_json, ip, user_agent, created_at
      FROM admin_audit_logs
      ORDER BY created_at DESC
      LIMIT @limit
    `,
    { limit }
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
    schoolId: row.school_id || undefined,
    contentScope: row.content_scope === 'platform' ? 'platform' : 'school',
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
    questionStatus: row.question_status === 'resolved' ? 'resolved' : 'open',
    acceptedCommentId: row.accepted_comment_id || undefined,
    moderationStatus: row.moderation_status as PostItem['moderationStatus'],
    viewer: {
      isLiked: isPostLiked(userId, row.id),
      isFavorited: isFavorited(userId, 'post', row.id),
      isOwner: Boolean(userId && row.author_user_id === userId),
    },
  };
}

export function mapComment(
  row: CommentRow,
  isLiked: boolean,
  options: {
    replyToAuthorName?: string;
    isAccepted?: boolean;
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
    isAccepted: options.isAccepted,
    replies: [],
    viewer: {
      isLiked,
    },
  };
}

function extractSourceUrlFromContent(contentJson: string | null | undefined) {
  if (!contentJson) {
    return undefined;
  }

  try {
    const paragraphs = JSON.parse(contentJson) as string[];
    if (!Array.isArray(paragraphs)) {
      return undefined;
    }

    const sourceLine = paragraphs.find((item) => /^原文[:：]\s*https?:\/\//.test(item.trim()));
    return sourceLine?.replace(/^原文[:：]\s*/, '').trim();
  } catch {
    return undefined;
  }
}

export function getContentSchoolInfo(
  targetType: ModerationTaskRow['target_type'] | ReportRow['target_type'],
  targetId: string
) {
  if (targetType === 'resource') {
    const target = getOne<{ school_id: string | null; school_name: string | null }>(
      `
        SELECT r.school_id, s.name AS school_name
        FROM resources r
        LEFT JOIN schools s ON s.id = r.school_id
        WHERE r.id = @targetId
      `,
      { targetId }
    );
    return {
      schoolId: target?.school_id || undefined,
      schoolName: target?.school_name || undefined,
    };
  }

  if (targetType === 'post') {
    const target = getOne<{ school_id: string | null; school_name: string | null }>(
      `
        SELECT p.school_id, s.name AS school_name
        FROM posts p
        LEFT JOIN schools s ON s.id = p.school_id
        WHERE p.id = @targetId
      `,
      { targetId }
    );
    return {
      schoolId: target?.school_id || undefined,
      schoolName: target?.school_name || undefined,
    };
  }

  if (targetType === 'team') {
    const target = getOne<{ school_id: string | null; school_name: string | null }>(
      `
        SELECT t.school_id, s.name AS school_name
        FROM teams t
        LEFT JOIN schools s ON s.id = t.school_id
        WHERE t.id = @targetId
      `,
      { targetId }
    );
    return {
      schoolId: target?.school_id || undefined,
      schoolName: target?.school_name || undefined,
    };
  }

  if (targetType === 'comment') {
    const target = getOne<{ school_id: string | null; school_name: string | null }>(
      `
        SELECT p.school_id, s.name AS school_name
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        LEFT JOIN schools s ON s.id = p.school_id
        WHERE c.id = @targetId
      `,
      { targetId }
    );
    return {
      schoolId: target?.school_id || undefined,
      schoolName: target?.school_name || undefined,
    };
  }

  if (targetType === 'report') {
    const report = getOne<{ target_type: ReportRow['target_type']; target_id: string }>(
      `
        SELECT target_type, target_id
        FROM reports
        WHERE id = @targetId
      `,
      { targetId }
    );
    return report ? getContentSchoolInfo(report.target_type, report.target_id) : {};
  }

  return {};
}

function getModerationTargetSummary(row: ModerationTaskRow) {
  const school = getContentSchoolInfo(row.target_type, row.target_id);

  if (row.target_type === 'resource') {
    const target = getOne<{
      title: string;
      type: string;
      category: string;
      author_name: string;
      source_url: string | null;
      moderation_status: string;
    }>(
      `
        SELECT title, type, category, author_name, source_url, moderation_status
        FROM resources
        WHERE id = @targetId
      `,
      { targetId: row.target_id }
    );
    return target
      ? {
          ...school,
          targetTitle: target.title,
          targetSummary: `${target.category} / ${target.type}`,
          targetOwner: target.author_name,
          targetStatus: target.moderation_status,
          targetSourceUrl: target.source_url || undefined,
        }
      : {};
  }

  if (row.target_type === 'post') {
    const target = getOne<{
      title: string;
      excerpt: string;
      category: string;
      author_name: string;
      content_json: string;
      moderation_status: string;
    }>(
      `
        SELECT title, excerpt, category, author_name, content_json, moderation_status
        FROM posts
        WHERE id = @targetId
      `,
      { targetId: row.target_id }
    );
    return target
      ? {
          ...school,
          targetTitle: target.title,
          targetSummary: `${target.category} / ${target.excerpt}`,
          targetOwner: target.author_name,
          targetStatus: target.moderation_status,
          targetSourceUrl: extractSourceUrlFromContent(target.content_json),
        }
      : {};
  }

  if (row.target_type === 'team') {
    const target = getOne<{
      title: string;
      comp_name: string;
      author_name: string;
      moderation_status: string;
      visibility_scope: string;
      contact_email: string | null;
    }>(
      `
        SELECT title, comp_name, author_name, moderation_status, visibility_scope, contact_email
        FROM teams
        WHERE id = @targetId
      `,
      { targetId: row.target_id }
    );
    return target
      ? {
          ...school,
          targetTitle: target.title,
          targetSummary: target.comp_name,
          targetOwner: target.author_name,
          targetStatus: target.moderation_status,
          targetVisibilityScope: target.visibility_scope === 'cross_school' ? 'cross_school' as const : 'school' as const,
          targetContactEmail: target.contact_email || undefined,
        }
      : {};
  }

  if (row.target_type === 'comment') {
    const target = getOne<{
      content: string;
      author_name: string;
      moderation_status: string;
      post_title: string;
    }>(
      `
        SELECT c.content, c.author_name, c.moderation_status, p.title AS post_title
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        WHERE c.id = @targetId
      `,
      { targetId: row.target_id }
    );
    return target
      ? {
          ...school,
          targetTitle: target.post_title,
          targetSummary: target.content,
          targetOwner: target.author_name,
          targetStatus: target.moderation_status,
        }
      : {};
  }

  if (row.target_type === 'report') {
    const target = getOne<{
      target_type: string;
      target_id: string;
      reason: string;
      detail: string | null;
      status: string;
    }>(
      `
        SELECT target_type, target_id, reason, detail, status
        FROM reports
        WHERE id = @targetId
      `,
      { targetId: row.target_id }
    );
    return target
      ? {
          ...school,
          targetTitle: target.reason,
          targetSummary: `${target.target_type} / ${target.target_id}${target.detail ? ` / ${target.detail}` : ''}`,
          targetStatus: target.status,
        }
      : {};
  }

  return school;
}

export function mapModerationTask(row: ModerationTaskRow): ModerationTaskItem {
  const target = getModerationTargetSummary(row);
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    ...target,
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

export function resolveAdminSession(token: string) {
  if (!token) {
    return null;
  }

  const session = getOne<AdminSessionRow>(
    `
      SELECT token, admin_user_id, role, expires_at, created_at
      FROM admin_sessions
      WHERE token = @token
    `,
    { token }
  );

  if (!session) {
    return null;
  }

  if (Date.parse(session.expires_at) <= Date.now()) {
    run(`DELETE FROM admin_sessions WHERE token = @token`, { token });
    return null;
  }

  const admin = getOne<{ status: string; role: AdminUserRow['role']; school_id: string | null; school_name: string | null }>(
    `SELECT status, role, school_id, school_name FROM admin_users WHERE id = @adminUserId`,
    { adminUserId: session.admin_user_id }
  );

  if (!admin || admin.status !== 'active') {
    run(`DELETE FROM admin_sessions WHERE token = @token`, { token });
    return null;
  }

  return {
    token: session.token,
    adminUserId: session.admin_user_id,
    role: admin.role,
    schoolId: admin.school_id,
    schoolName: admin.school_name,
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
