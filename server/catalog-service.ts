import type {
  Competition,
  FavoriteCollection,
  HomeFeed,
  ResourceItem,
  SearchResultItem,
  TeamItem,
  UserProfile,
} from '../frontend/src/types/entities';
import type {
  CompetitionEnrollmentResult,
  CompetitionQuery,
  FavoriteQuery,
  FavoriteMutationResult,
  MessageQuery,
  NotificationBatchReadPayload,
  NotificationBatchReadResult,
  NotificationReadResult,
  PublishTeamPayload,
  ResourceAcquirePayload,
  ResourceAcquireResult,
  ResourceQuery,
  SearchQuery,
  TeamApplicationPayload,
  TeamApplicationResult,
  TeamQuery,
  ToggleFavoritePayload,
} from '../frontend/src/types/api';
import { listFeaturedPosts } from './community-service.ts';
import {
  buildCurrentUser,
  createId,
  createModerationTask,
  createOrUpdateOwnedResource,
  ensureDownloadGrant,
  formatDateTime,
  getAll,
  getOne,
  getResourceViewerAccessStatus,
  getTeamApplicationViewerStatus,
  isEnrolled,
  isFavorited,
  mapNotification,
  mapPost,
  nowIso,
  pushNotification,
  run,
  parseJsonArray,
} from './helpers.ts';
import type {
  CompetitionRow,
  NotificationRow,
  OrderRow,
  OwnedResourceRow,
  PostRow,
  RefundRow,
  ResourceRow,
  SearchSuggestionRow,
  TeamRow,
} from './models.ts';

function getCompetitionRow(id: string) {
  const competition = getOne<CompetitionRow>(
    `
      SELECT id, title, level, category, host, target, status, deadline, days_left, views, difficulty,
             cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json
      FROM competitions
      WHERE id = @id
    `,
    { id }
  );

  if (!competition) {
    throw new Error('competition_not_found');
  }

  return competition;
}

function getResourceRow(id: string) {
  const resource = getOne<ResourceRow>(
    `
      SELECT id, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
             cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json
      FROM resources
      WHERE id = @id
    `,
    { id }
  );

  if (!resource) {
    throw new Error('resource_not_found');
  }

  return resource;
}

function getTeamRow(id: string) {
  const team = getOne<TeamRow>(
    `
      SELECT id, title, comp_id, comp_name, status, target, current_count, max_count, missing_roles_json,
             deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
             requirements_json, contact_hint, moderation_status
      FROM teams
      WHERE id = @id
    `,
    { id }
  );

  if (!team) {
    throw new Error('team_not_found');
  }

  return team;
}

function getOrderRow(orderId: string) {
  const order = getOne<OrderRow>(
    `
      SELECT id, user_id, title, item_type, amount, status, created_at, paid_at, resource_id, cover_label, updated_at
      FROM orders
      WHERE id = @orderId
    `,
    { orderId }
  );

  if (!order) {
    throw new Error('order_not_found');
  }

  return order;
}

function requireVisible<T extends { moderation_status: string }>(row: T, userId?: string, ownerId?: string | null) {
  if (row.moderation_status === 'approved') {
    return row;
  }

  if (userId && ownerId && userId === ownerId) {
    return row;
  }

  throw new Error('content_not_available');
}

function mapCompetition(row: CompetitionRow, userId?: string): Competition {
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    category: row.category,
    host: row.host,
    target: row.target,
    status: row.status as Competition['status'],
    deadline: row.deadline,
    daysLeft: row.days_left,
    views: row.views,
    difficulty: row.difficulty,
    coverLabel: row.cover_label,
    coverGradient: row.cover_gradient,
    tags: parseJsonArray<string>(row.tags_json),
    description: row.description,
    recommendedFor: parseJsonArray<string>(row.recommended_for_json),
    actionHints: parseJsonArray<string>(row.action_hints_json),
    viewer: {
      isFavorited: isFavorited(userId, 'competition', row.id),
      isEnrolled: isEnrolled(userId, row.id),
    },
  };
}

function mapResource(row: ResourceRow, userId?: string): ResourceItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    category: row.category,
    price: row.price,
    downloads: row.downloads,
    rating: row.rating,
    authorName: row.author_name,
    authorMark: row.author_mark,
    authorTitle: row.author_title,
    coverLabel: row.cover_label,
    coverGradient: row.cover_gradient,
    tags: parseJsonArray<string>(row.tags_json),
    description: row.description,
    sizeLabel: row.size_label,
    suitableFor: row.suitable_for,
    previewPoints: parseJsonArray<string>(row.preview_points_json),
    relatedCompetitionIds: getAll<{ competition_id: string }>(
      `SELECT competition_id FROM resource_competitions WHERE resource_id = @resourceId`,
      { resourceId: row.id }
    ).map((item) => item.competition_id),
    viewer: {
      isFavorited: isFavorited(userId, 'resource', row.id),
      accessStatus: getResourceViewerAccessStatus(userId, row.id),
    },
  };
}

function mapTeam(row: TeamRow, userId?: string): TeamItem {
  const applicationStatus = getTeamApplicationViewerStatus(userId, row.id);
  return {
    id: row.id,
    title: row.title,
    compId: row.comp_id || undefined,
    compName: row.comp_name,
    status: row.status,
    target: row.target,
    current: row.current_count,
    max: row.max_count,
    missingRoles: parseJsonArray<string>(row.missing_roles_json),
    deadline: row.deadline,
    authorName: row.author_name,
    authorMark: row.author_mark,
    authorGrade: row.author_grade,
    authorMajor: row.author_major,
    schoolLimit: Boolean(row.school_limit),
    requirements: parseJsonArray<string>(row.requirements_json),
    contactHint: row.contact_hint,
    viewer: {
      hasApplied: applicationStatus !== 'none',
      applicationStatus,
    },
  };
}

function mapOrder(row: OrderRow) {
  const refund = getOne<RefundRow>(
    `
      SELECT id, order_id, out_refund_no, refund_id, amount, reason, status, payload_json, created_at, updated_at
      FROM refunds
      WHERE order_id = @orderId
      ORDER BY created_at DESC
      LIMIT 1
    `,
    { orderId: row.id }
  );

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
    refundId: refund?.refund_id || refund?.out_refund_no || undefined,
    refundReason: refund?.reason || undefined,
    refundRequestedAt: refund?.created_at || undefined,
    refundCompletedAt: refund?.status === 'success' ? refund.updated_at : undefined,
  };
}

function mapOwnedResource(row: OwnedResourceRow) {
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

export function getCurrentUser(userId: string): UserProfile {
  return buildCurrentUser(userId);
}

export function getHomeFeed(userId?: string): HomeFeed {
  return {
    heroPrompt: '看见机会，找到资源，拉起队伍，然后真正开始行动。',
    urgentCompetitions: getAll<CompetitionRow>(
      `
        SELECT id, title, level, category, host, target, status, deadline, days_left, views, difficulty,
               cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json
        FROM competitions
        WHERE days_left <= 20
        ORDER BY days_left ASC, views DESC
      `
    ).map((row) => mapCompetition(row, userId)),
    hotResources: getAll<ResourceRow>(
      `
        SELECT id, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
               cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json
        FROM resources
        ORDER BY downloads DESC
        LIMIT 3
      `
    ).map((row) => mapResource(row, userId)),
    latestTeams: getAll<TeamRow>(
      `
        SELECT id, title, comp_id, comp_name, status, target, current_count, max_count, missing_roles_json,
               deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
               requirements_json, contact_hint, moderation_status
        FROM teams
        WHERE moderation_status = 'approved'
        ORDER BY deadline ASC
      `
    ).map((row) => mapTeam(row, userId)),
    featuredPosts: listFeaturedPosts(2, userId),
  };
}

export function listCompetitions(query: CompetitionQuery = {}, userId?: string) {
  const { keyword = '', level, sort = '推荐', limit } = query;
  const rows = getAll<CompetitionRow>(
    `
      SELECT id, title, level, category, host, target, status, deadline, days_left, views, difficulty,
             cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json
      FROM competitions
      WHERE (@keyword = '' OR title LIKE @search OR host LIKE @search OR category LIKE @search OR tags_json LIKE @search)
        AND (@level IS NULL OR level = @level OR (@level = '创新创业' AND category = '创新创业'))
    `,
    {
      keyword,
      search: `%${keyword}%`,
      level: level || null,
    }
  );

  const sorted = [...rows].sort((left, right) => {
    if (sort === '最热') {
      return right.views - left.views;
    }
    if (sort === '即将截止') {
      return left.days_left - right.days_left;
    }
    if (sort === '最新') {
      return left.deadline.localeCompare(right.deadline);
    }
    return left.days_left - right.days_left || right.views - left.views;
  });

  return (limit ? sorted.slice(0, limit) : sorted).map((row) => mapCompetition(row, userId));
}

export function getCompetitionDetail(id: string, userId?: string) {
  return mapCompetition(getCompetitionRow(id), userId);
}

export function listCompetitionResources(id: string, userId?: string) {
  getCompetitionRow(id);
  return getAll<ResourceRow>(
    `
      SELECT r.id, r.title, r.type, r.category, r.price, r.downloads, r.rating, r.author_name, r.author_mark, r.author_title,
             r.cover_label, r.cover_gradient, r.tags_json, r.description, r.size_label, r.suitable_for, r.preview_points_json
      FROM resources r
      JOIN resource_competitions rc ON rc.resource_id = r.id
      WHERE rc.competition_id = @competitionId
      ORDER BY r.downloads DESC
    `,
    { competitionId: id }
  ).map((row) => mapResource(row, userId));
}

export function listCompetitionTeams(id: string, userId?: string) {
  getCompetitionRow(id);
  return getAll<TeamRow>(
    `
      SELECT id, title, comp_id, comp_name, status, target, current_count, max_count, missing_roles_json,
             deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
             requirements_json, contact_hint, moderation_status
      FROM teams
      WHERE comp_id = @competitionId AND moderation_status = 'approved'
      ORDER BY deadline ASC
    `,
    { competitionId: id }
  ).map((row) => mapTeam(row, userId));
}

export function patchCompetitionFavorite(userId: string, id: string, payload: ToggleFavoritePayload): FavoriteMutationResult {
  getCompetitionRow(id);
  const existing = getOne<{ id: string }>(
    `SELECT id FROM favorites WHERE user_id = @userId AND target_type = 'competition' AND target_id = @targetId`,
    { userId, targetId: id }
  );

  if (payload.favorite && !existing) {
    run(
      `
        INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
        VALUES (@id, @userId, 'competition', @targetId, @createdAt)
      `,
      { id: createId('fav'), userId, targetId: id, createdAt: nowIso() }
    );
  }

  if (!payload.favorite && existing) {
    run(`DELETE FROM favorites WHERE id = @id`, { id: existing.id });
  }

  return { targetId: id, favorite: payload.favorite };
}

export function createCompetitionEnrollment(userId: string, id: string): CompetitionEnrollmentResult {
  const competition = getCompetitionDetail(id, userId);
  const existing = getOne<{ id: string }>(
    `SELECT id FROM competition_enrollments WHERE user_id = @userId AND competition_id = @competitionId`,
    { userId, competitionId: id }
  );

  if (!existing) {
    run(
      `
        INSERT INTO competition_enrollments (id, user_id, competition_id, status, created_at)
        VALUES (@id, @userId, @competitionId, 'enrolled', @createdAt)
      `,
      {
        id: createId('enroll'),
        userId,
        competitionId: id,
        createdAt: nowIso(),
      }
    );
    pushNotification(userId, {
      category: '系统',
      title: '竞赛报名状态已更新',
      content: `你已提交「${competition.title}」的报名请求，后续进度会继续在消息中心同步。`,
      linkType: 'competition',
      linkId: id,
      ctaText: '查看竞赛',
    });
  }

  return { competitionId: id, enrolled: true, status: 'enrolled' };
}

export function listResources(query: ResourceQuery = {}, userId?: string) {
  const { keyword = '', priceType, category, limit } = query;
  const rows = getAll<ResourceRow>(
    `
      SELECT id, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
             cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json
      FROM resources
      WHERE (@keyword = '' OR title LIKE @search OR author_name LIKE @search OR category LIKE @search OR tags_json LIKE @search)
        AND (@category IS NULL OR category = @category)
    `,
    {
      keyword,
      search: `%${keyword}%`,
      category: category || null,
    }
  ).filter((item) => {
    if (!priceType || priceType === '全部') {
      return true;
    }
    if (priceType === '免费') {
      return item.price === 0;
    }
    return item.price > 0;
  });

  const sorted = [...rows].sort((left, right) => right.downloads - left.downloads);
  return (limit ? sorted.slice(0, limit) : sorted).map((row) => mapResource(row, userId));
}

export function getResourceDetail(id: string, userId?: string) {
  return mapResource(getResourceRow(id), userId);
}

export function patchResourceFavorite(userId: string, id: string, payload: ToggleFavoritePayload): FavoriteMutationResult {
  getResourceRow(id);
  const existing = getOne<{ id: string }>(
    `SELECT id FROM favorites WHERE user_id = @userId AND target_type = 'resource' AND target_id = @targetId`,
    { userId, targetId: id }
  );

  if (payload.favorite && !existing) {
    run(
      `
        INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
        VALUES (@id, @userId, 'resource', @targetId, @createdAt)
      `,
      { id: createId('fav'), userId, targetId: id, createdAt: nowIso() }
    );
  }

  if (!payload.favorite && existing) {
    run(`DELETE FROM favorites WHERE id = @id`, { id: existing.id });
  }

  return { targetId: id, favorite: payload.favorite };
}

export function createResourceAcquire(userId: string, id: string, payload: ResourceAcquirePayload): ResourceAcquireResult {
  const resource = getResourceDetail(id, userId);

  if (payload.mode === 'free' || resource.price === 0) {
    const ownedResource = createOrUpdateOwnedResource(userId, resource, 'free');
    ensureDownloadGrant(userId, resource.id, 'free');
    pushNotification(userId, {
      category: '订单',
      title: '资源已加入我的资源',
      content: `你已领取「${resource.title}」，现在可以在“我的资源”里继续查看和下载。`,
      linkType: 'resource',
      linkId: id,
      ctaText: '查看资源',
    });
    return {
      resourceId: id,
      accessStatus: 'owned',
      ownedResource,
    };
  }

  const existing = getOne<OrderRow>(
    `
      SELECT id, user_id, title, item_type, amount, status, created_at, paid_at, resource_id, cover_label
      FROM orders
      WHERE user_id = @userId AND resource_id = @resourceId AND status = '待支付'
    `,
    { userId, resourceId: id }
  );

  const orderId = existing?.id ?? createId('o');
  if (!existing) {
    run(
      `
        INSERT INTO orders (
          id, user_id, title, item_type, amount, status, created_at, paid_at, resource_id, cover_label,
          payment_provider, payment_ref, notify_payload_json, updated_at
        ) VALUES (
          @id, @userId, @title, 'resource', @amount, '待支付', @createdAt, NULL, @resourceId, @coverLabel,
          'wechat', NULL, NULL, @updatedAt
        )
      `,
      {
        id: orderId,
        userId,
        title: resource.title,
        amount: resource.price,
        createdAt: formatDateTime(),
        resourceId: id,
        coverLabel: '资源订单',
        updatedAt: nowIso(),
      }
    );
    pushNotification(userId, {
      category: '订单',
      title: '资源订单已创建',
      content: `你已为「${resource.title}」创建订单，支付完成后会自动同步到“我的资源”。`,
      linkType: 'resource',
      linkId: id,
      ctaText: '查看订单',
    });
  }

  return {
    resourceId: id,
    accessStatus: 'pending_payment',
    order: mapOrder(getOrderRow(orderId)),
  };
}

export function listOwnedResources(userId: string) {
  return getAll<OwnedResourceRow>(
    `
      SELECT id, user_id, resource_id, title, type, access_type, acquired_at, download_count, tags_json
      FROM owned_resources
      WHERE user_id = @userId
      ORDER BY created_at DESC
    `,
    { userId }
  ).map(mapOwnedResource);
}

export function listOrders(userId: string) {
  return getAll<OrderRow>(
    `
      SELECT id, user_id, title, item_type, amount, status, created_at, paid_at, resource_id, cover_label, updated_at
      FROM orders
      WHERE user_id = @userId
      ORDER BY created_at DESC
    `,
    { userId }
  ).map(mapOrder);
}

export function getOrderDetail(userId: string, orderId: string) {
  const row = getOrderRow(orderId);
  if (row.user_id !== userId) {
    throw new Error('order_not_found');
  }

  return mapOrder(row);
}

export function listTeams(query: TeamQuery = {}, userId?: string) {
  const { keyword = '', compId, status, mineOnly = false } = query;
  let rows = getAll<TeamRow>(
    `
      SELECT id, title, comp_id, comp_name, status, target, current_count, max_count, missing_roles_json,
             deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
             requirements_json, contact_hint, moderation_status
      FROM teams
      WHERE (@keyword = '' OR title LIKE @search OR target LIKE @search OR missing_roles_json LIKE @search)
        AND (@compId IS NULL OR comp_id = @compId)
        AND (@status IS NULL OR status = @status)
        AND moderation_status = 'approved'
      ORDER BY deadline ASC
    `,
    {
      keyword,
      search: `%${keyword}%`,
      compId: compId || null,
      status: status || null,
    }
  );

  if (mineOnly && userId) {
    const mineIds = new Set(
      getAll<{ id: string }>(
        `
          SELECT id FROM teams WHERE author_user_id = @userId
          UNION
          SELECT team_id AS id FROM team_applications WHERE user_id = @userId
        `,
        { userId }
      ).map((item) => item.id)
    );
    rows = rows.filter((row) => mineIds.has(row.id));
  }

  return rows.map((row) => mapTeam(row, userId));
}

export function getTeamDetail(id: string, userId?: string) {
  const row = getTeamRow(id);
  return mapTeam(requireVisible(row, userId, row.author_user_id), userId);
}

export function createTeamRecruit(userId: string, payload: PublishTeamPayload) {
  const user = getCurrentUser(userId);
  const id = createId('t');
  run(
    `
      INSERT INTO teams (
        id, title, comp_id, comp_name, status, target, current_count, max_count, missing_roles_json,
        deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
        requirements_json, contact_hint, moderation_status, created_at, updated_at
      ) VALUES (
        @id, @title, @compId, @compName, '招募中', @target, 1, @maxCount, @missingRolesJson,
        @deadline, @authorUserId, @authorName, @authorMark, @authorGrade, @authorMajor, @schoolLimit,
        @requirementsJson, @contactHint, 'approved', @createdAt, @updatedAt
      )
    `,
    {
      id,
      title: payload.title,
      compId: payload.compId || null,
      compName: payload.compName,
      target: payload.target,
      maxCount: Math.max(payload.missingRoles.length + 1, 2),
      missingRolesJson: JSON.stringify(payload.missingRoles),
      deadline: payload.deadline,
      authorUserId: userId,
      authorName: user.name,
      authorMark: user.mark,
      authorGrade: user.grade,
      authorMajor: user.major,
      schoolLimit: payload.schoolLimit ? 1 : 0,
      requirementsJson: JSON.stringify(payload.requirements),
      contactHint: payload.contactHint,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );
  createModerationTask('team', id, 'team_publish_review', '新发布组队信息待审核');
  return getTeamDetail(id, userId);
}

export function createTeamApplication(userId: string, id: string, payload: TeamApplicationPayload = {}): TeamApplicationResult {
  const team = getTeamDetail(id, userId);
  const existing = getOne<{ id: string; status: TeamApplicationResult['status'] }>(
    `SELECT id, status FROM team_applications WHERE team_id = @teamId AND user_id = @userId`,
    { teamId: id, userId }
  );

  if (!existing) {
    run(
      `
        INSERT INTO team_applications (id, team_id, user_id, message, status, created_at)
        VALUES (@id, @teamId, @userId, @message, 'pending', @createdAt)
      `,
      {
        id: createId('apply'),
        teamId: id,
        userId,
        message: payload.message || null,
        createdAt: nowIso(),
      }
    );
    pushNotification(userId, {
      category: '组队',
      title: '组队申请已提交',
      content: `你已提交加入「${team.title}」的申请，后续审核结果会在消息中心同步。`,
      linkType: 'team',
      linkId: id,
      ctaText: '查看队伍',
    });
  }

  return {
    teamId: id,
    applied: true,
    status: existing?.status ?? 'pending',
  };
}

export function listNotifications(userId: string, query: MessageQuery = {}) {
  const category = query.category ?? '全部';
  return getAll<NotificationRow>(
    `
      SELECT id, user_id, category, title, content, time_label, unread, link_type, link_id, link_scene, comment_id, cta_text
      FROM notifications
      WHERE user_id = @userId
        AND (@category = '全部' OR category = @category)
      ORDER BY created_at DESC
    `,
    { userId, category }
  ).map(mapNotification);
}

export function markNotificationRead(userId: string, notificationId: string): NotificationReadResult {
  const notification = getOne<NotificationRow>(
    `
      SELECT id, user_id, category, title, content, time_label, unread, link_type, link_id, link_scene, comment_id, cta_text
      FROM notifications
      WHERE id = @notificationId AND user_id = @userId
    `,
    { notificationId, userId }
  );

  if (!notification) {
    throw new Error('notification_not_found');
  }

  if (notification.unread) {
    run(
      `
        UPDATE notifications
        SET unread = 0
        WHERE id = @notificationId AND user_id = @userId
      `,
      { notificationId, userId }
    );
  }

  const unreadCount =
    getOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = @userId AND unread = 1`,
      { userId }
    )?.count ?? 0;

  return {
    notificationId,
    unread: false,
    unreadCount,
  };
}

export function markNotificationsRead(
  userId: string,
  payload: NotificationBatchReadPayload = {}
): NotificationBatchReadResult {
  let updatedCount = 0;

  if (payload.all) {
    const category = payload.category && payload.category !== '全部' ? payload.category : null;
    const result = run(
      `
        UPDATE notifications
        SET unread = 0
        WHERE user_id = @userId
          AND unread = 1
          AND (@category IS NULL OR category = @category)
      `,
      { userId, category }
    );
    updatedCount = Number(result.changes || 0);
  } else {
    const ids = (payload.ids ?? []).filter(Boolean);
    if (ids.length > 0) {
      const placeholders = ids.map((_, index) => `@id${index}`).join(', ');
      const params = ids.reduce<Record<string, string | number | null>>(
        (accumulator, id, index) => {
          accumulator[`id${index}`] = id;
          return accumulator;
        },
        { userId }
      );
      const result = run(
        `
          UPDATE notifications
          SET unread = 0
          WHERE user_id = @userId
            AND unread = 1
            AND id IN (${placeholders})
        `,
        params
      );
      updatedCount = Number(result.changes || 0);
    }
  }

  const unreadCount =
    getOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = @userId AND unread = 1`,
      { userId }
    )?.count ?? 0;

  return {
    updatedCount,
    unreadCount,
  };
}

export function listFavorites(userId: string, query: FavoriteQuery = {}): FavoriteCollection {
  const scope = query.scope ?? 'all';

  const competitions =
    scope === 'all' || scope === 'competition'
      ? getAll<CompetitionRow & { favorited_at: string }>(
          `
            SELECT c.id, c.title, c.level, c.category, c.host, c.target, c.status, c.deadline, c.days_left, c.views, c.difficulty,
                   c.cover_label, c.cover_gradient, c.tags_json, c.description, c.recommended_for_json, c.action_hints_json,
                   f.created_at AS favorited_at
            FROM favorites f
            JOIN competitions c ON c.id = f.target_id
            WHERE f.user_id = @userId AND f.target_type = 'competition'
            ORDER BY f.created_at DESC
          `,
          { userId }
        ).map((row) => {
          const item = mapCompetition(row, userId);
          return {
            ...item,
            viewer: {
              ...item.viewer,
              favoritedAt: row.favorited_at,
            },
          };
        })
      : [];

  const resources =
    scope === 'all' || scope === 'resource'
      ? getAll<ResourceRow & { favorited_at: string }>(
          `
            SELECT r.id, r.title, r.type, r.category, r.price, r.downloads, r.rating, r.author_name, r.author_mark, r.author_title,
                   r.cover_label, r.cover_gradient, r.tags_json, r.description, r.size_label, r.suitable_for, r.preview_points_json,
                   f.created_at AS favorited_at
            FROM favorites f
            JOIN resources r ON r.id = f.target_id
            WHERE f.user_id = @userId AND f.target_type = 'resource'
            ORDER BY f.created_at DESC
          `,
          { userId }
        ).map((row) => {
          const item = mapResource(row, userId);
          return {
            ...item,
            viewer: {
              ...item.viewer,
              favoritedAt: row.favorited_at,
            },
          };
        })
      : [];

  const posts =
    scope === 'all' || scope === 'post'
      ? getAll<PostRow & { favorited_at: string }>(
          `
            SELECT p.id, p.title, p.excerpt, p.content_json, p.category, p.author_user_id, p.author_name, p.author_mark,
                   p.likes_count, p.comments_count, p.tags_json, p.time_label, p.related_competition_id, p.related_resource_id,
                   p.moderation_status, f.created_at AS favorited_at
            FROM favorites f
            JOIN posts p ON p.id = f.target_id
            WHERE f.user_id = @userId AND f.target_type = 'post' AND p.moderation_status = 'approved'
            ORDER BY f.created_at DESC
          `,
          { userId }
        ).map((row) => {
          const item = mapPost(row, userId);
          return {
            ...item,
            viewer: {
              ...item.viewer,
              favoritedAt: row.favorited_at,
            },
          };
        })
      : [];

  return {
    competitions,
    resources,
    posts,
  };
}

export function getSearchSuggestions() {
  return getAll<SearchSuggestionRow>(
    `SELECT id, label, scope FROM search_suggestions ORDER BY sort_order ASC`
  ).map((row) => ({
    id: row.id,
    label: row.label,
    scope: row.scope,
  }));
}

export function searchAll(query: SearchQuery): SearchResultItem[] {
  const keyword = query.keyword.trim();
  if (!keyword) {
    return [];
  }

  const results: SearchResultItem[] = [];
  const scopes = query.scope === 'all' ? ['competitions', 'resources', 'teams'] : [query.scope];

  if (scopes.includes('competitions')) {
    for (const item of listCompetitions({ keyword })) {
      results.push({
        id: item.id,
        scope: 'competitions',
        title: item.title,
        subtitle: `${item.level} · ${item.category}`,
        meta: `截止 ${item.deadline} · 剩余 ${item.daysLeft} 天`,
        tags: item.tags,
        link: `/pages/competition-detail/index?id=${item.id}`,
      });
    }
  }

  if (scopes.includes('resources')) {
    for (const item of listResources({ keyword })) {
      results.push({
        id: item.id,
        scope: 'resources',
        title: item.title,
        subtitle: `${item.category} · ${item.type}`,
        meta: `${item.downloads} 次下载 · ${item.price === 0 ? '免费' : `¥${item.price}`}`,
        tags: item.tags,
        link: `/pages/resource-detail/index?id=${item.id}`,
      });
    }
  }

  if (scopes.includes('teams')) {
    for (const item of listTeams({ keyword })) {
      results.push({
        id: item.id,
        scope: 'teams',
        title: item.title,
        subtitle: `${item.compName} · ${item.status}`,
        meta: `缺 ${Math.max(item.max - item.current, 0)} 人 · 截止 ${item.deadline}`,
        tags: item.missingRoles,
        link: `/pages/team-detail/index?id=${item.id}`,
      });
    }
  }

  return results;
}
