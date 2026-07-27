import type {
  Competition,
  CompetitionEnrollmentItem,
  FavoriteCollection,
  HomeBannerItem,
  HomeFeed,
  HomeQuickLinkItem,
  ResourceItem,
  SearchResultItem,
  TeamApplicationItem,
  TeamItem,
  UserActivityCollection,
  UserProfile,
} from '../frontend/src/types/entities';
import type {
  CompetitionEnrollmentResult,
  CompetitionQuery,
  FavoriteMutationResult,
  FavoriteQuery,
  HomeFeedConfigPayload,
  HomeFeedConfigResult,
  MessageQuery,
  NotificationBatchReadPayload,
  NotificationBatchReadResult,
  NotificationReadResult,
  PublishResourcePayload,
  PublishTeamPayload,
  ResourceAcquirePayload,
  ResourceAcquireResult,
  ResourceQuery,
  SearchQuery,
  TeamApplicationDecisionPayload,
  TeamApplicationDecisionResult,
  TeamApplicationPayload,
  TeamApplicationResult,
  TeamContactRevealResult,
  TeamQuery,
  ToggleFavoritePayload,
  UpdateUserIdentityPayload,
  UpdateUserProfilePayload,
} from '../frontend/src/types/api';
import {
  buildCurrentUser,
  createId,
  createModerationTask,
  createOrUpdateOwnedResource,
  ensureDownloadGrant,
  formatDateTime,
  getRequiredVerifiedSchoolId,
  getActiveSchoolId,
  getVerifiedActiveSchoolId,
  getAll,
  getOne,
  getResourceViewerAccessStatus,
  getTeamApplicationViewerStatus,
  isEnrolled,
  isFavorited,
  isContentAccessible,
  isNotificationTargetAccessible,
  isLikelyCorruptText,
  mapNotification,
  mapPost,
  nowIso,
  pushNotification,
  run,
  parseJsonArray,
  requireContentAccessible,
  countAccessibleUnreadNotifications,
} from './helpers.ts';
import type {
  CompetitionEnrollmentRow,
  CompetitionNoticeRow,
  CompetitionRow,
  HomeFeedConfigRow,
  NotificationRow,
  OrderRow,
  OwnedResourceRow,
  PostRow,
  RefundRow,
  ResourceAssetRow,
  ResourceRow,
  SearchSuggestionRow,
  TeamApplicationRow,
  TeamRow,
  UserRow,
} from './models.ts';
import { serverConfig } from './config.ts';
import { ensureTeamExamplesForSchool, ensureTeamExamplesForVerifiedSchool } from './team-example-service.ts';

const competitionSelect = `
  id, school_id, content_scope, title, level, category, host, target, status, deadline, days_left, views, difficulty,
  cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json,
  registration_start, registration_end, competition_start, competition_end, team_size, stages_json, submission_materials_json,
  awards, fee_description, official_contact, source_url, last_verified_at, edition_label,
  current_edition_label, reference_edition_label, reference_notice_url, schedule_note, data_freshness, schedule_status,
  registration_method, tracks_json, quality_status, publish_status, created_at, updated_at,
  (SELECT COUNT(*) FROM favorites competition_favorites
   WHERE competition_favorites.target_type = 'competition'
     AND competition_favorites.target_id = competitions.id) AS favorite_count
`;

const resourceSelect = `
  id, school_id, content_scope, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
  cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json,
  author_user_id, file_asset_id, source_url, moderation_status, review_note, created_at, updated_at
`;

const teamSelect = `
  id, school_id, content_scope, listing_type, title, comp_id, comp_name, status, target, full_description, current_count, max_count, missing_roles_json,
  deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit, visibility_scope,
  requirements_json, goal_tags_json, capabilities_json, collaboration_mode, weekly_commitment,
  contact_hint, contact_email, is_example, example_expires_at, moderation_status, created_at
`;

const postSelect = `
  id, school_id, content_scope, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
  likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
  question_status, accepted_comment_id, moderation_status, created_at
`;

const quickLinkOrder = ['competitions', 'resources', 'teams', 'community', 'ai'] as const;

const defaultHomeBanners: HomeBannerItem[] = [
  {
    id: 'banner-campus',
    badge: '校园成长',
    title: '竞赛、资料、队友',
    imageUrl:
      'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1MTg0OTU0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    link: '/',
  },
  {
    id: 'banner-competition',
    badge: '近期赛事',
    title: '近期报名赛事。',
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    link: '/competitions',
  },
  {
    id: 'banner-team',
    badge: '组队专区',
    title: '找队友，开项目。',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    link: '/teams',
  },
];

const defaultHomeQuickLinks: HomeQuickLinkItem[] = quickLinkOrder.map((id) => ({
  id,
  enabled: true,
}));

const publicResourceTypes = new Set(['模板', '资料包', '攻略', '范例', '清单', '题库']);

function isResourcePublicInCurrentCommercialPhase(row: ResourceRow, userId?: string) {
  const isOwner = Boolean(userId && row.author_user_id === userId);
  if (!publicResourceTypes.has(row.type) && !publicResourceTypes.has(row.category)) {
    return isOwner;
  }

  if (row.price <= 0) {
    return true;
  }

  if (serverConfig.paymentsEnabled) {
    return true;
  }

  return isOwner;
}

function readJsonArray<T>(value: string | null | undefined, fallback: T[] = []) {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const next: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    next.push(item);
  }

  return next;
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }
  return Date.parse(value);
}

function resolveHomeFeedEffectiveStatus(row: Pick<HomeFeedConfigRow, 'publish_status' | 'publish_at' | 'offline_at'>) {
  const now = Date.now();
  const publishAt = parseDateMs(row.publish_at);
  const offlineAt = parseDateMs(row.offline_at);

  if (row.publish_status === 'draft') {
    return 'draft' as const;
  }

  if (row.publish_status === 'offline') {
    return 'offline' as const;
  }

  if (Number.isFinite(offlineAt) && offlineAt <= now) {
    return 'offline' as const;
  }

  if (row.publish_status === 'scheduled' && Number.isFinite(publishAt) && publishAt > now) {
    return 'scheduled' as const;
  }

  return 'online' as const;
}

function sanitizeBanners(value: HomeBannerItem[] | undefined) {
  const source = Array.isArray(value) ? value : [];
  const sanitized = source
    .map((item, index) => ({
      id: String(item?.id || `banner-${index + 1}`),
      badge: String(item?.badge || '').trim() || `Banner ${index + 1}`,
      title: String(item?.title || '').trim() || '在这里填写首页运营文案',
      imageUrl: String(item?.imageUrl || '').trim() || defaultHomeBanners[index % defaultHomeBanners.length].imageUrl,
      link: String(item?.link || '').trim() || '/',
    }))
    .slice(0, 6);

  return sanitized.length > 0 ? sanitized : defaultHomeBanners;
}

function sanitizeQuickLinks(value: HomeQuickLinkItem[] | undefined) {
  const source = new Map(
    (Array.isArray(value) ? value : []).map((item) => [String(item.id), Boolean(item.enabled)])
  );

  return quickLinkOrder.map((id) => ({
    id,
    enabled: source.has(id) ? Boolean(source.get(id)) : true,
  }));
}

function normalizeLimit(value: unknown, fallback = 2) {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.max(1, Math.min(6, Math.round(next)));
}

function getHomeFeedConfigRow() {
  const row = getOne<HomeFeedConfigRow>(
    `
      SELECT id, hero_badge, hero_prompt, hero_image_url, banners_json, quick_links_json, publish_status, publish_at,
             offline_at, competition_limit, resource_limit, team_limit, post_limit, competition_ids_json,
             resource_ids_json, team_ids_json, post_ids_json, updated_at
      FROM home_feed_configs
      WHERE id = 'default'
    `
  );

  if (row) {
    return row;
  }

  return {
    id: 'default',
    hero_badge: defaultHomeBanners[0].badge,
    hero_prompt: defaultHomeBanners[0].title,
    hero_image_url: defaultHomeBanners[0].imageUrl,
    banners_json: JSON.stringify(defaultHomeBanners),
    quick_links_json: JSON.stringify(defaultHomeQuickLinks),
    publish_status: 'online',
    publish_at: null,
    offline_at: null,
    competition_limit: 2,
    resource_limit: 2,
    team_limit: 2,
    post_limit: 2,
    competition_ids_json: '[]',
    resource_ids_json: '[]',
    team_ids_json: '[]',
    post_ids_json: '[]',
    updated_at: nowIso(),
  } satisfies HomeFeedConfigRow;
}

function buildHomeFeedConfigResult(row: HomeFeedConfigRow): HomeFeedConfigResult {
  const banners = sanitizeBanners(readJsonArray<HomeBannerItem>(row.banners_json, defaultHomeBanners));
  const leadBanner = banners[0] || defaultHomeBanners[0];

  return {
    heroBadge: row.hero_badge || leadBanner.badge,
    heroPrompt: row.hero_prompt || leadBanner.title,
    heroImageUrl: row.hero_image_url || leadBanner.imageUrl,
    banners,
    quickLinks: sanitizeQuickLinks(readJsonArray<HomeQuickLinkItem>(row.quick_links_json, defaultHomeQuickLinks)),
    publishStatus: row.publish_status,
    publishAt: row.publish_at || '',
    offlineAt: row.offline_at || '',
    competitionLimit: normalizeLimit(row.competition_limit, 2),
    resourceLimit: normalizeLimit(row.resource_limit, 2),
    teamLimit: normalizeLimit(row.team_limit, 2),
    postLimit: normalizeLimit(row.post_limit, 2),
    competitionIds: readJsonArray<string>(row.competition_ids_json, []),
    resourceIds: readJsonArray<string>(row.resource_ids_json, []),
    teamIds: readJsonArray<string>(row.team_ids_json, []),
    postIds: readJsonArray<string>(row.post_ids_json, []),
    updatedAt: row.updated_at,
    effectiveStatus: resolveHomeFeedEffectiveStatus(row),
  };
}

function getCompetitionRow(id: string) {
  const competition = getOne<CompetitionRow>(
    `
      SELECT ${competitionSelect}
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
      SELECT ${resourceSelect}
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
      SELECT ${teamSelect}
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

function requireSchoolVisible<T extends { content_scope?: string | null; school_id?: string | null }>(
  row: T,
  userId?: string,
  _ownerId?: string | null
) {
  return requireContentAccessible(row, userId);
}

function isInCurrentSchoolScope(
  row: { content_scope?: string | null; school_id?: string | null },
  userId?: string,
  _ownerId?: string | null
) {
  return isContentAccessible(row, userId);
}

function getRequiredActiveSchoolId(userId: string) {
  return getRequiredVerifiedSchoolId(userId);
}

function listCompetitionNotices(competitionId: string) {
  return getAll<CompetitionNoticeRow>(
    `
      SELECT id, competition_id, title, published_at, source_url, file_type, storage_url, created_at
      FROM competition_notices
      WHERE competition_id = @competitionId
      ORDER BY COALESCE(published_at, created_at) DESC
    `,
    { competitionId }
  ).map((notice) => ({
    id: notice.id,
    title: notice.title,
    publishedAt: notice.published_at || undefined,
    sourceUrl: notice.source_url,
    fileType: notice.file_type,
    storageUrl: notice.storage_url || undefined,
  }));
}

function mapCompetition(row: CompetitionRow, userId?: string, includeNotices = false): Competition {
  const actionHints = parseJsonArray<string>(row.action_hints_json);
  const legacySourceUrl = actionHints.find((item) => /^官网[：:]/.test(item))?.replace(/^官网[：:]\s*/, '').trim();
  return {
    id: row.id,
    schoolId: row.school_id || undefined,
    contentScope: row.content_scope === 'platform' ? 'platform' : 'school',
    title: row.title,
    level: row.level,
    category: row.category,
    host: row.host,
    target: row.target,
    status: row.status as Competition['status'],
    deadline: row.deadline,
    daysLeft: row.days_left,
    views: row.views,
    favoriteCount: Number(row.favorite_count || 0),
    difficulty: row.difficulty,
    coverLabel: row.cover_label,
    coverGradient: row.cover_gradient,
    tags: parseJsonArray<string>(row.tags_json),
    description: row.description,
    recommendedFor: parseJsonArray<string>(row.recommended_for_json),
    actionHints,
    registrationStart: row.registration_start || undefined,
    registrationEnd: row.registration_end || row.deadline || undefined,
    competitionStart: row.competition_start || undefined,
    competitionEnd: row.competition_end || undefined,
    teamSize: row.team_size || undefined,
    stages: parseJsonArray<string>(row.stages_json),
    submissionMaterials: parseJsonArray<string>(row.submission_materials_json),
    awards: row.awards || undefined,
    feeDescription: row.fee_description || undefined,
    officialContact: row.official_contact || undefined,
    sourceUrl: row.source_url || legacySourceUrl || undefined,
    lastVerifiedAt: row.last_verified_at || undefined,
    editionLabel: row.edition_label || '届次待核验',
    currentEditionLabel: row.current_edition_label || row.edition_label || undefined,
    referenceEditionLabel: row.reference_edition_label || undefined,
    referenceNoticeUrl: row.reference_notice_url || undefined,
    scheduleNote: row.schedule_note || undefined,
    dataFreshness: row.data_freshness || 'current',
    scheduleStatus: row.schedule_status || 'not_announced',
    registrationMethod: row.registration_method || undefined,
    tracks: parseJsonArray<string>(row.tracks_json),
    qualityStatus: row.quality_status || 'pending_review',
    notices: includeNotices ? listCompetitionNotices(row.id) : [],
    viewer: {
      isFavorited: isFavorited(userId, 'competition', row.id),
      isEnrolled: isEnrolled(userId, row.id),
    },
  };
}

interface ResourceMapContext {
  relatedCompetitionIds: Map<string, string[]>;
  assets: Map<string, ResourceAssetRow>;
  favoritedIds: Set<string>;
  ownedIds: Set<string>;
  pendingPaymentIds: Set<string>;
}

function buildInParams(prefix: string, values: string[]) {
  return {
    placeholders: values.map((_, index) => `@${prefix}${index}`).join(', '),
    params: Object.fromEntries(values.map((value, index) => [`${prefix}${index}`, value])),
  };
}

function buildResourceMapContext(rows: ResourceRow[], userId?: string): ResourceMapContext {
  const resourceIds = [...new Set(rows.map((row) => row.id))];
  const assetIds = [...new Set(rows.map((row) => row.file_asset_id).filter((id): id is string => Boolean(id)))];
  const relatedCompetitionIds = new Map<string, string[]>();
  const assets = new Map<string, ResourceAssetRow>();
  const favoritedIds = new Set<string>();
  const ownedIds = new Set<string>();
  const pendingPaymentIds = new Set<string>();

  if (resourceIds.length > 0) {
    const resourceParams = buildInParams('resourceId', resourceIds);
    for (const row of getAll<{ resource_id: string; competition_id: string }>(
      `SELECT resource_id, competition_id
       FROM resource_competitions
       WHERE resource_id IN (${resourceParams.placeholders})`,
      resourceParams.params,
    )) {
      const current = relatedCompetitionIds.get(row.resource_id) ?? [];
      current.push(row.competition_id);
      relatedCompetitionIds.set(row.resource_id, current);
    }

    if (userId) {
      for (const row of getAll<{ target_id: string }>(
        `SELECT target_id FROM favorites
         WHERE user_id = @userId AND target_type = 'resource'
           AND target_id IN (${resourceParams.placeholders})`,
        { userId, ...resourceParams.params },
      )) {
        favoritedIds.add(row.target_id);
      }
      for (const row of getAll<{ resource_id: string }>(
        `SELECT resource_id FROM owned_resources
         WHERE user_id = @userId AND resource_id IN (${resourceParams.placeholders})`,
        { userId, ...resourceParams.params },
      )) {
        ownedIds.add(row.resource_id);
      }
      for (const row of getAll<{ resource_id: string }>(
        `SELECT resource_id FROM orders
         WHERE user_id = @userId AND status = '待支付'
           AND resource_id IN (${resourceParams.placeholders})`,
        { userId, ...resourceParams.params },
      )) {
        pendingPaymentIds.add(row.resource_id);
      }
    }
  }

  if (assetIds.length > 0) {
    const assetParams = buildInParams('assetId', assetIds);
    for (const asset of getAll<ResourceAssetRow>(
      `SELECT id, user_id, storage_provider, storage_key, local_path, original_name, file_name, content_type, size_bytes, created_at
       FROM resource_assets
       WHERE id IN (${assetParams.placeholders})`,
      assetParams.params,
    )) {
      assets.set(asset.id, asset);
    }
  }

  return { relatedCompetitionIds, assets, favoritedIds, ownedIds, pendingPaymentIds };
}

function getResourceFileSummary(row: ResourceRow, prefetchedAsset?: ResourceAssetRow | null) {
  if (!row.file_asset_id) {
    return undefined;
  }

  const asset =
    prefetchedAsset === undefined
      ? getOne<ResourceAssetRow>(
          `
            SELECT id, user_id, storage_provider, storage_key, local_path, original_name, file_name, content_type, size_bytes, created_at
            FROM resource_assets
            WHERE id = @assetId
          `,
          { assetId: row.file_asset_id },
        )
      : prefetchedAsset;

  if (!asset) {
    return undefined;
  }

  return {
    assetId: asset.id,
    originalName: asset.original_name,
    fileName: asset.file_name,
    sizeBytes: asset.size_bytes,
    contentType: asset.content_type,
  };
}

function mapResource(row: ResourceRow, userId?: string, context?: ResourceMapContext): ResourceItem {
  const accessStatus = context
    ? context.ownedIds.has(row.id)
      ? 'owned'
      : context.pendingPaymentIds.has(row.id)
        ? 'pending_payment'
        : 'not_acquired'
    : getResourceViewerAccessStatus(userId, row.id);

  return {
    id: row.id,
    schoolId: row.school_id || undefined,
    contentScope: row.content_scope === 'platform' ? 'platform' : 'school',
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
    relatedCompetitionIds:
      context?.relatedCompetitionIds.get(row.id) ??
      getAll<{ competition_id: string }>(
        `SELECT competition_id FROM resource_competitions WHERE resource_id = @resourceId`,
        { resourceId: row.id },
      ).map((item) => item.competition_id),
    sourceUrl: row.source_url || undefined,
    moderationStatus: row.moderation_status,
    reviewNote: row.review_note || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
    file: getResourceFileSummary(row, context && row.file_asset_id ? context.assets.get(row.file_asset_id) ?? null : undefined),
    viewer: {
      isFavorited: context ? context.favoritedIds.has(row.id) : isFavorited(userId, 'resource', row.id),
      accessStatus,
      canManage: Boolean(userId && row.author_user_id === userId),
    },
  };
}

function mapResources(rows: ResourceRow[], userId?: string) {
  const context = buildResourceMapContext(rows, userId);
  return rows.map((row) => mapResource(row, userId, context));
}

function mapTeam(row: TeamRow, userId?: string): TeamItem {
  const isOwner = Boolean(userId && row.author_user_id === userId);
  const applicationStatus = getTeamApplicationViewerStatus(userId, row.id);
  const pendingApplicationCount = isOwner
    ? getOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM team_applications WHERE team_id = @teamId AND status = 'pending'`,
        { teamId: row.id }
      )?.count ?? 0
    : undefined;

  return {
    id: row.id,
    schoolId: row.school_id || undefined,
    schoolName: getTeamSchoolName(row.school_id),
    contentScope: row.content_scope === 'platform' ? 'platform' : 'school',
    listingType: row.listing_type === 'member_available' ? 'member_available' : 'team_recruit',
    title: row.title,
    compId: row.comp_id || undefined,
    compName: row.comp_name,
    status: isTeamExpired(row) ? '已结束' : row.status,
    target: row.target,
    fullDescription: row.full_description || undefined,
    current: row.current_count,
    max: row.max_count,
    missingRoles: parseJsonArray<string>(row.missing_roles_json),
    deadline: row.deadline,
    authorName: row.author_name,
    authorMark: row.author_mark,
    authorGrade: row.author_grade,
    authorMajor: row.author_major,
    schoolLimit: Boolean(row.school_limit),
    visibilityScope: row.visibility_scope === 'cross_school' ? 'cross_school' : 'school',
    requirements: parseJsonArray<string>(row.requirements_json),
    goalTags: parseJsonArray<string>(row.goal_tags_json),
    capabilities: parseJsonArray<string>(row.capabilities_json),
    collaborationMode: row.collaboration_mode || '',
    weeklyCommitment: row.weekly_commitment || '',
    contactHint: isOwner ? row.contact_hint : '',
    contactEmail: row.is_example ? undefined : row.contact_email || undefined,
    isExample: Boolean(row.is_example),
    exampleExpiresAt: row.example_expires_at || undefined,
    moderationStatus: row.moderation_status as TeamItem['moderationStatus'],
    viewer: {
      hasApplied: applicationStatus !== 'none',
      applicationStatus,
      isOwner,
      canViewContact: isOwner || applicationStatus === 'approved',
      pendingApplicationCount,
    },
  };
}

const teamSchoolNameCache = new Map<string, string>();

function getTeamSchoolName(schoolId: string | null) {
  if (!schoolId) return undefined;
  const cached = teamSchoolNameCache.get(schoolId);
  if (cached) return cached;
  const school = getOne<{ name: string }>('SELECT name FROM schools WHERE id = @schoolId', { schoolId });
  if (!school) return undefined;
  teamSchoolNameCache.set(schoolId, school.name);
  return school.name;
}

function isTeamExpired(row: Pick<TeamRow, 'deadline'>) {
  return /^\d{4}-\d{2}-\d{2}$/.test(row.deadline) && row.deadline < shanghaiDate();
}

function isExampleTeamVisible(row: TeamRow, userId?: string) {
  if (!row.is_example) return true;
  if (row.example_expires_at && row.example_expires_at < nowIso()) return false;
  const schoolId = getVerifiedActiveSchoolId(userId);
  if (!schoolId || schoolId !== row.school_id) return false;
  const realTeamCount = Number(
    getOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM teams
       WHERE school_id = @schoolId AND moderation_status = 'approved' AND is_example = 0
         AND (deadline = '' OR deadline >= @today)`,
      { schoolId, today: shanghaiDate() },
    )?.count ?? 0,
  );
  return realTeamCount < 3;
}

function isTeamShowcaseExample(row: TeamRow) {
  return Boolean(
    row.is_example &&
      row.school_id === serverConfig.teamShowcaseSchoolId &&
      (!row.example_expires_at || row.example_expires_at >= nowIso()) &&
      !isTeamExpired(row),
  );
}

function isTeamAccessible(row: TeamRow, userId?: string) {
  if (isTeamShowcaseExample(row)) return true;
  if (row.visibility_scope === 'cross_school') return true;
  return isInCurrentSchoolScope(row, userId, row.author_user_id);
}

function matchesTeamSchoolScope(row: TeamRow, userId: string | undefined, schoolScope: TeamQuery['schoolScope']) {
  if (!isTeamAccessible(row, userId)) return false;
  if (!schoolScope || schoolScope === 'all') return true;
  const viewerSchoolId = getActiveSchoolId(userId);
  if (!viewerSchoolId) return false;
  if (schoolScope === 'current') return row.school_id === viewerSchoolId;
  return row.visibility_scope === 'cross_school' && row.school_id !== viewerSchoolId;
}

function isLikelyCorruptTeamRow(row: TeamRow) {
  if ([row.title, row.comp_name, row.target, row.contact_hint].some(isLikelyCorruptText)) {
    return true;
  }

  const missingRoles = parseJsonArray<string>(row.missing_roles_json);
  const requirements = parseJsonArray<string>(row.requirements_json);
  const goals = parseJsonArray<string>(row.goal_tags_json);
  const capabilities = parseJsonArray<string>(row.capabilities_json);
  return [...missingRoles, ...requirements, ...goals, ...capabilities, row.collaboration_mode, row.weekly_commitment].some(
    isLikelyCorruptText
  );
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
    updatedAt: row.updated_at || undefined,
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

function getCompetitionRowsByIds(ids: string[]) {
  return ids
    .map((id) =>
      getOne<CompetitionRow>(
        `
          SELECT ${competitionSelect}
          FROM competitions
          WHERE id = @id AND publish_status = 'published' AND quality_status = 'verified'
        `,
        { id }
      )
    )
    .filter((item): item is CompetitionRow => Boolean(item));
}

function getResourceRowsByIds(ids: string[]) {
  return ids
    .map((id) =>
      getOne<ResourceRow>(
        `
          SELECT ${resourceSelect}
          FROM resources
          WHERE id = @id AND moderation_status = 'approved'
        `,
        { id }
      )
    )
    .filter((item): item is ResourceRow => Boolean(item));
}

function getTeamRowsByIds(ids: string[]) {
  return ids
    .map((id) =>
      getOne<TeamRow>(
        `
          SELECT ${teamSelect}
          FROM teams
          WHERE id = @id AND moderation_status = 'approved'
        `,
        { id }
      )
    )
    .filter((item): item is TeamRow => Boolean(item));
}

function getPostRowsByIds(ids: string[]) {
  return ids
    .map((id) =>
      getOne<PostRow>(
        `
          SELECT ${postSelect}
          FROM posts
          WHERE id = @id AND moderation_status = 'approved'
        `,
        { id }
      )
    )
    .filter((item): item is PostRow => Boolean(item));
}

function takeHomeCompetitions(limit: number, ids: string[], userId?: string) {
  const preferred = getCompetitionRowsByIds(ids);
  const fallback = getAll<CompetitionRow>(
    `
      SELECT ${competitionSelect}
      FROM competitions
      WHERE publish_status = 'published' AND quality_status = 'verified'
      ORDER BY days_left ASC, views DESC
      LIMIT 12
    `
  );
  return uniqueById([...preferred, ...fallback])
    .filter((row) => isInCurrentSchoolScope(row, userId))
    .slice(0, limit)
    .map((row) => mapCompetition(row, userId));
}

function takeHomeResources(limit: number, ids: string[], userId?: string) {
  const preferred = getResourceRowsByIds(ids).filter((row) => isResourcePublicInCurrentCommercialPhase(row, userId));
  const fallback = getAll<ResourceRow>(
    `
      SELECT ${resourceSelect}
      FROM resources
      WHERE moderation_status = 'approved'
        AND (@paymentsEnabled = 1 OR price <= 0)
      ORDER BY downloads DESC, rating DESC
      LIMIT 12
    `,
    { paymentsEnabled: serverConfig.paymentsEnabled ? 1 : 0 }
  );
  const rows = uniqueById([...preferred, ...fallback])
    .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
    .filter((row) => isResourcePublicInCurrentCommercialPhase(row, userId))
    .slice(0, limit);
  return mapResources(rows, userId);
}

function takeHomeTeams(limit: number, ids: string[], userId?: string) {
  const preferred = getTeamRowsByIds(ids).filter((row) => row.listing_type !== 'member_available');
  const fallback = getAll<TeamRow>(
    `
      SELECT ${teamSelect}
      FROM teams
      WHERE moderation_status = 'approved' AND listing_type = 'team_recruit'
      ORDER BY deadline ASC
      LIMIT 12
    `
  );
  return uniqueById([...preferred, ...fallback])
    .filter((row) => isTeamAccessible(row, userId))
    .filter((row) => !isTeamExpired(row))
    .filter((row) => !row.is_example || isTeamShowcaseExample(row) || isExampleTeamVisible(row, userId))
    .slice(0, limit)
    .map((row) => mapTeam(row, userId));
}

function takeHomeSchoolExperiences(limit: number, ids: string[], userId?: string) {
  const preferred = getPostRowsByIds(ids)
    .filter((row) => row.content_scope === 'school' && row.category === '经验贴')
    .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
    .map((row) => mapPost(row, userId));
  const fallback = getAll<PostRow>(
    `
      SELECT ${postSelect}
      FROM posts
      WHERE moderation_status = 'approved'
        AND content_scope = 'school'
        AND category = '经验贴'
      ORDER BY likes_count DESC, created_at DESC
      LIMIT 12
    `
  )
    .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
    .map((row) => mapPost(row, userId));
  return uniqueById([...preferred, ...fallback]).slice(0, limit);
}

function getSchoolHomePersonalization(userId?: string) {
  const schoolId = getVerifiedActiveSchoolId(userId);
  if (!schoolId) return null;
  const row = getOne<{
    announcement: string;
    team_ids_json: string;
    post_ids_json: string;
    updated_at: string;
  }>(
    `SELECT announcement, team_ids_json, post_ids_json, updated_at
     FROM school_home_configs WHERE school_id = @schoolId`,
    { schoolId }
  );
  if (!row) return null;
  return {
    announcement: row.announcement.trim(),
    teamIds: readJsonArray<string>(row.team_ids_json, []),
    postIds: readJsonArray<string>(row.post_ids_json, []),
    updatedAt: row.updated_at,
  };
}

function buildTeamApplicationItem(row: {
  id: string;
  team_id: string;
  team_title: string;
  team_comp_name: string;
  user_id: string;
  applicant_name: string;
  applicant_mark: string;
  applicant_school: string;
  applicant_major: string;
  applicant_grade: string;
  applicant_bio: string;
  applicant_focus_tags_json: string;
  message: string | null;
  status: TeamApplicationItem['status'];
  created_at: string;
}): TeamApplicationItem {
  return {
    id: row.id,
    teamId: row.team_id,
    teamTitle: row.team_title,
    teamCompName: row.team_comp_name,
    applicantId: row.user_id,
    applicantName: row.applicant_name,
    applicantMark: row.applicant_mark,
    applicantSchool: row.applicant_school,
    applicantMajor: row.applicant_major,
    applicantGrade: row.applicant_grade,
    applicantBio: row.applicant_bio,
    applicantFocusTags: readJsonArray<string>(row.applicant_focus_tags_json),
    message: row.message || '',
    status: row.status,
    createdAt: row.created_at,
  };
}

export function getCurrentUser(userId: string): UserProfile {
  return buildCurrentUser(userId);
}

export function updateCurrentUser(userId: string, payload: UpdateUserProfilePayload) {
  const current = getOne<UserRow>(
    `
      SELECT id, open_id, union_id, session_key, name, mark, avatar_url, school, major, grade, bio, focus_tags_json
      FROM users
      WHERE id = @userId
    `,
    { userId }
  );

  if (!current) {
    throw new Error('user_not_found');
  }

  run(
    `
      UPDATE users
      SET name = @name,
          mark = @mark,
          avatar_url = @avatarUrl,
          school = @school,
          major = @major,
          grade = @grade,
          bio = @bio,
          focus_tags_json = @focusTagsJson,
          updated_at = @updatedAt
      WHERE id = @userId
    `,
    {
      avatarUrl: payload.avatarUrl?.trim() || current.avatar_url || null,
      userId,
      name: payload.name.trim(),
      mark: payload.name.trim().slice(0, 1) || current.mark,
      school: payload.school.trim(),
      major: payload.major.trim(),
      grade: payload.grade.trim(),
      bio: payload.bio.trim(),
      focusTagsJson: JSON.stringify(payload.focusTags ?? []),
      updatedAt: nowIso(),
    }
  );

  return buildCurrentUser(userId);
}

export function updateCurrentUserIdentity(userId: string, payload: UpdateUserIdentityPayload) {
  const name = payload.name?.trim();
  if (!name) {
    throw new Error('user_identity_required');
  }

  const current = getOne<UserRow>(
    `
      SELECT id, open_id, union_id, session_key, name, mark, avatar_url, school, major, grade, bio, focus_tags_json
      FROM users
      WHERE id = @userId
    `,
    { userId }
  );

  if (!current) {
    throw new Error('user_not_found');
  }

  run(
    `
      UPDATE users
      SET name = @name,
          mark = @mark,
          avatar_url = @avatarUrl,
          updated_at = @updatedAt
      WHERE id = @userId
    `,
    {
      userId,
      name: name.slice(0, 24),
      mark: name.slice(0, 1) || current.mark,
      avatarUrl: payload.avatarUrl?.trim() || current.avatar_url || null,
      updatedAt: nowIso(),
    }
  );

  return buildCurrentUser(userId);
}

export function getUserActivity(userId: string): UserActivityCollection {
  const publishedTeams = getAll<TeamRow>(
    `
      SELECT ${teamSelect}
      FROM teams
      WHERE author_user_id = @userId
      ORDER BY created_at DESC, id DESC
    `,
    { userId }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId))
    .map((row) => mapTeam(row, userId));

  const publishedPosts = getAll<PostRow>(
    `
      SELECT ${postSelect}
      FROM posts
      WHERE author_user_id = @userId
      ORDER BY created_at DESC, id DESC
    `,
    { userId }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId))
    .map((row) => mapPost(row, userId));

  const competitionEnrollments = getAll<
    CompetitionEnrollmentRow & {
      title: string;
      level: string;
      category: string;
      host: string;
      target: string;
      competition_status: string;
      deadline: string;
      days_left: number;
      views: number;
      difficulty: string;
      cover_label: string;
      cover_gradient: string;
      tags_json: string;
      description: string;
      recommended_for_json: string;
      action_hints_json: string;
      registration_start: string | null;
      registration_end: string | null;
      competition_start: string | null;
      competition_end: string | null;
      team_size: string | null;
      stages_json: string;
      submission_materials_json: string;
      awards: string | null;
      fee_description: string | null;
      official_contact: string | null;
      source_url: string | null;
      last_verified_at: string | null;
      edition_label: string;
      current_edition_label: string | null;
      reference_edition_label: string | null;
      reference_notice_url: string | null;
      schedule_note: string | null;
      data_freshness: CompetitionRow['data_freshness'];
      schedule_status: CompetitionRow['schedule_status'];
      registration_method: string | null;
      tracks_json: string;
      quality_status: CompetitionRow['quality_status'];
      competition_created_at: string | null;
      school_id: string | null;
      content_scope: string;
    }
  >(
    `
      SELECT ce.id, ce.user_id, ce.competition_id, ce.status, ce.created_at,
             c.school_id, c.content_scope, c.title, c.level, c.category, c.host, c.target, c.status AS competition_status,
             c.deadline, c.days_left, c.views, c.difficulty, c.cover_label, c.cover_gradient,
             c.tags_json, c.description, c.recommended_for_json, c.action_hints_json,
             c.registration_start, c.registration_end, c.competition_start, c.competition_end,
              c.team_size, c.stages_json, c.submission_materials_json, c.awards, c.fee_description, c.official_contact,
             c.source_url, c.last_verified_at, c.edition_label, c.current_edition_label, c.reference_edition_label,
             c.reference_notice_url, c.schedule_note, c.data_freshness, c.schedule_status, c.registration_method,
             c.tracks_json, c.quality_status, c.created_at AS competition_created_at
      FROM competition_enrollments ce
      JOIN competitions c ON c.id = ce.competition_id
      WHERE ce.user_id = @userId
      ORDER BY ce.created_at DESC
    `,
    { userId }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId))
    .map((row): CompetitionEnrollmentItem => ({
    id: row.id,
    competitionId: row.competition_id,
    status: row.status,
    createdAt: row.created_at,
    competition: mapCompetition(
      {
        id: row.competition_id,
        school_id: row.school_id,
        content_scope: row.content_scope,
        title: row.title,
        level: row.level,
        category: row.category,
        host: row.host,
        target: row.target,
        status: row.competition_status,
        deadline: row.deadline,
        days_left: row.days_left,
        views: row.views,
        difficulty: row.difficulty,
        cover_label: row.cover_label,
        cover_gradient: row.cover_gradient,
        tags_json: row.tags_json,
        description: row.description,
        recommended_for_json: row.recommended_for_json,
        action_hints_json: row.action_hints_json,
        registration_start: row.registration_start,
        registration_end: row.registration_end,
        competition_start: row.competition_start,
        competition_end: row.competition_end,
        team_size: row.team_size,
        stages_json: row.stages_json,
        submission_materials_json: row.submission_materials_json,
        awards: row.awards,
        fee_description: row.fee_description,
        official_contact: row.official_contact,
        source_url: row.source_url,
        last_verified_at: row.last_verified_at,
        edition_label: row.edition_label,
        current_edition_label: row.current_edition_label,
        reference_edition_label: row.reference_edition_label,
        reference_notice_url: row.reference_notice_url,
        schedule_note: row.schedule_note,
        data_freshness: row.data_freshness,
        schedule_status: row.schedule_status,
        registration_method: row.registration_method,
        tracks_json: row.tracks_json,
        quality_status: row.quality_status,
        created_at: row.competition_created_at,
      },
      userId
    ),
  }));

  const teamApplications = serverConfig.teamApplicationsEnabled ? getAll<{
    id: string;
    team_id: string;
    team_title: string;
    team_comp_name: string;
    user_id: string;
    applicant_name: string;
    applicant_mark: string;
    applicant_school: string;
    applicant_major: string;
    applicant_grade: string;
    applicant_bio: string;
    applicant_focus_tags_json: string;
    message: string | null;
    status: TeamApplicationItem['status'];
    created_at: string;
    school_id: string | null;
    content_scope: string;
  }>(
    `
      SELECT ta.id, ta.team_id, t.title AS team_title, t.comp_name AS team_comp_name, ta.user_id,
             t.school_id, t.content_scope,
             u.name AS applicant_name, u.mark AS applicant_mark, u.school AS applicant_school,
             u.major AS applicant_major, u.grade AS applicant_grade, u.bio AS applicant_bio,
             u.focus_tags_json AS applicant_focus_tags_json, ta.message, ta.status, ta.created_at
      FROM team_applications ta
      JOIN teams t ON t.id = ta.team_id
      JOIN users u ON u.id = ta.user_id
      WHERE ta.user_id = @userId
      ORDER BY ta.created_at DESC
    `,
    { userId }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId))
    .map(buildTeamApplicationItem) : [];

  return {
    publishedTeams,
    publishedPosts,
    competitionEnrollments,
    teamApplications,
  };
}

export function getHomeFeedConfig(): HomeFeedConfigResult {
  return buildHomeFeedConfigResult(getHomeFeedConfigRow());
}

export function updateHomeFeedConfig(payload: HomeFeedConfigPayload): HomeFeedConfigResult {
  const banners = sanitizeBanners(payload.banners);
  const quickLinks = sanitizeQuickLinks(payload.quickLinks);
  const leadBanner = banners[0] || defaultHomeBanners[0];

  run(
    `
      UPDATE home_feed_configs
      SET hero_badge = @heroBadge,
          hero_prompt = @heroPrompt,
          hero_image_url = @heroImageUrl,
          banners_json = @bannersJson,
          quick_links_json = @quickLinksJson,
          publish_status = @publishStatus,
          publish_at = @publishAt,
          offline_at = @offlineAt,
          competition_limit = @competitionLimit,
          resource_limit = @resourceLimit,
          team_limit = @teamLimit,
          post_limit = @postLimit,
          competition_ids_json = @competitionIdsJson,
          resource_ids_json = @resourceIdsJson,
          team_ids_json = @teamIdsJson,
          post_ids_json = @postIdsJson,
          updated_at = @updatedAt
      WHERE id = 'default'
    `,
    {
      heroBadge: leadBanner.badge,
      heroPrompt: leadBanner.title,
      heroImageUrl: leadBanner.imageUrl,
      bannersJson: JSON.stringify(banners),
      quickLinksJson: JSON.stringify(quickLinks),
      publishStatus: payload.publishStatus,
      publishAt: payload.publishAt?.trim() || null,
      offlineAt: payload.offlineAt?.trim() || null,
      competitionLimit: normalizeLimit(payload.competitionLimit, 2),
      resourceLimit: normalizeLimit(payload.resourceLimit, 2),
      teamLimit: normalizeLimit(payload.teamLimit, 2),
      postLimit: normalizeLimit(payload.postLimit, 2),
      competitionIdsJson: JSON.stringify(payload.competitionIds ?? []),
      resourceIdsJson: JSON.stringify(payload.resourceIds ?? []),
      teamIdsJson: JSON.stringify(payload.teamIds ?? []),
      postIdsJson: JSON.stringify(payload.postIds ?? []),
      updatedAt: nowIso(),
    }
  );

  return buildHomeFeedConfigResult(getHomeFeedConfigRow());
}

export function getHomeFeed(userId?: string): HomeFeed {
  ensureTeamExamplesForSchool(serverConfig.teamShowcaseSchoolId, true);
  ensureTeamExamplesForVerifiedSchool(userId);
  const config = getHomeFeedConfig();
  const useConfig = config.effectiveStatus === 'online';
  const banners = useConfig ? sanitizeBanners(config.banners) : defaultHomeBanners;
  const quickLinks = useConfig ? sanitizeQuickLinks(config.quickLinks) : defaultHomeQuickLinks;
  const leadBanner = banners[0] || defaultHomeBanners[0];
  const schoolHome = getSchoolHomePersonalization(userId);

  return {
    heroBadge: leadBanner.badge,
    heroPrompt: leadBanner.title,
    heroImageUrl: leadBanner.imageUrl,
    banners,
    quickLinks,
    schoolAnnouncement: schoolHome?.announcement
      ? { text: schoolHome.announcement, link: '/community', updatedAt: schoolHome.updatedAt }
      : undefined,
    urgentCompetitions: takeHomeCompetitions(useConfig ? config.competitionLimit : 2, useConfig ? config.competitionIds : [], userId),
    hotResources: takeHomeResources(useConfig ? config.resourceLimit : 2, useConfig ? config.resourceIds : [], userId),
    latestTeams: takeHomeTeams(
      useConfig ? config.teamLimit : 2,
      schoolHome?.teamIds.length ? schoolHome.teamIds : useConfig ? config.teamIds : [],
      userId
    ),
    featuredPosts: takeHomeSchoolExperiences(
      useConfig ? config.postLimit : 2,
      schoolHome?.postIds.length ? schoolHome.postIds : useConfig ? config.postIds : [],
      userId
    ),
  };
}

export function listCompetitions(query: CompetitionQuery = {}, userId?: string) {
  const { keyword = '', category, level, sort = '推荐', limit } = query;
  const rows = getAll<CompetitionRow>(
    `
      SELECT ${competitionSelect}
      FROM competitions
      WHERE publish_status = 'published' AND quality_status = 'verified'
        AND (@keyword = '' OR title LIKE @search OR host LIKE @search OR category LIKE @search OR tags_json LIKE @search)
        AND (CAST(@category AS TEXT) IS NULL OR category = CAST(@category AS TEXT))
        AND (
          CAST(@level AS TEXT) IS NULL
          OR level = CAST(@level AS TEXT)
        )
    `,
    {
      keyword,
      search: `%${keyword}%`,
      category: category || null,
      level: level || null,
    }
  );

  const sorted = [...rows].sort((left, right) => {
    const rank = (item: CompetitionRow) => item.schedule_status === 'closed' ? 2 : item.schedule_status === 'not_announced' ? 1 : 0;
    const upcomingDays = (item: CompetitionRow) => item.days_left >= 0 && item.days_left < 9000 ? item.days_left : 9000;
    if (sort === '最热') {
      return rank(left) - rank(right) || Number(right.favorite_count || 0) - Number(left.favorite_count || 0) || right.views - left.views;
    }
    if (sort === '即将截止') {
      return rank(left) - rank(right) || upcomingDays(left) - upcomingDays(right) || right.views - left.views;
    }
    if (sort === '最新') {
      return (right.created_at || right.last_verified_at || right.deadline).localeCompare(
        left.created_at || left.last_verified_at || left.deadline
      );
    }
    return rank(left) - rank(right)
      || Number(right.favorite_count || 0) - Number(left.favorite_count || 0)
      || upcomingDays(left) - upcomingDays(right)
      || right.views - left.views;
  });

  const scoped = sorted.filter((row) => isInCurrentSchoolScope(row, userId));
  return (limit ? scoped.slice(0, limit) : scoped).map((row) => mapCompetition(row, userId));
}

function shanghaiDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function recordCompetitionView(competitionId: string, viewerKey?: string) {
  if (!viewerKey) return;
  const viewedOn = shanghaiDate();
  const existing = getOne<{ id: string }>(
    `
      SELECT id FROM competition_view_events
      WHERE competition_id = @competitionId AND viewer_key = @viewerKey AND viewed_on = @viewedOn
    `,
    { competitionId, viewerKey, viewedOn }
  );
  if (existing) return;

  run(
    `
      INSERT INTO competition_view_events (id, competition_id, viewer_key, viewed_on, created_at)
      VALUES (@id, @competitionId, @viewerKey, @viewedOn, @createdAt)
    `,
    { id: createId('view'), competitionId, viewerKey, viewedOn, createdAt: nowIso() }
  );
  run(`UPDATE competitions SET views = views + 1 WHERE id = @competitionId`, { competitionId });
}

export function getCompetitionDetail(id: string, userId?: string, viewerKey?: string) {
  const competition = getCompetitionRow(id);
  if (competition.publish_status !== 'published' || competition.quality_status !== 'verified') throw new Error('competition_not_found');
  requireSchoolVisible(competition, userId);
  recordCompetitionView(id, viewerKey);
  return mapCompetition(getCompetitionRow(id), userId, true);
}

function requirePublishedCompetition(id: string, userId?: string) {
  const competition = getCompetitionRow(id);
  if (competition.publish_status !== 'published' || competition.quality_status !== 'verified') throw new Error('competition_not_found');
  requireSchoolVisible(competition, userId);
  return competition;
}

export function listCompetitionResources(id: string, userId?: string) {
  requirePublishedCompetition(id, userId);
  const rows = getAll<ResourceRow>(
    `
      SELECT ${resourceSelect}
      FROM resources r
      JOIN resource_competitions rc ON rc.resource_id = r.id
      WHERE rc.competition_id = @competitionId
        AND r.moderation_status = 'approved'
      ORDER BY r.downloads DESC
    `,
    { competitionId: id }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
    .filter((row) => isResourcePublicInCurrentCommercialPhase(row, userId));
  return mapResources(rows, userId);
}

export function listCompetitionTeams(id: string, userId?: string) {
  requirePublishedCompetition(id, userId);
  ensureTeamExamplesForVerifiedSchool(userId);
  return getAll<TeamRow>(
    `
      SELECT ${teamSelect}
      FROM teams
      WHERE comp_id = @competitionId AND moderation_status = 'approved' AND listing_type = 'team_recruit'
      ORDER BY deadline ASC
    `,
    { competitionId: id }
  )
    .filter((row) => isTeamAccessible(row, userId))
    .filter((row) => !isTeamExpired(row))
    .map((row) => mapTeam(row, userId));
}

export function patchCompetitionFavorite(userId: string, id: string, payload: ToggleFavoritePayload): FavoriteMutationResult {
  getCompetitionDetail(id, userId);
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
      SELECT ${resourceSelect}
      FROM resources
      WHERE moderation_status = 'approved'
        AND (@keyword = '' OR title LIKE @search OR author_name LIKE @search OR category LIKE @search OR tags_json LIKE @search)
        AND (CAST(@category AS TEXT) IS NULL OR category = CAST(@category AS TEXT) OR type = CAST(@category AS TEXT))
    `,
    {
      keyword,
      search: `%${keyword}%`,
      category: category || null,
    }
  )
    .filter((item) => isInCurrentSchoolScope(item, userId, item.author_user_id))
    .filter((item) => {
    if (!isResourcePublicInCurrentCommercialPhase(item, userId)) {
      return false;
    }
    if (!priceType || priceType === '全部') {
      return true;
    }
    if (priceType === '免费') {
      return item.price === 0;
    }
    return item.price > 0;
  });

  const sorted = [...rows].sort((left, right) => right.downloads - left.downloads || right.rating - left.rating);
  return mapResources(limit ? sorted.slice(0, limit) : sorted, userId);
}

export function getResourceDetail(id: string, userId?: string) {
  const row = getResourceRow(id);
  if (!isResourcePublicInCurrentCommercialPhase(row, userId)) {
    throw new Error('content_not_available');
  }
  return mapResource(requireSchoolVisible(requireVisible(row, userId, row.author_user_id), userId, row.author_user_id), userId);
}

export function patchResourceFavorite(userId: string, id: string, payload: ToggleFavoritePayload): FavoriteMutationResult {
  getResourceDetail(id, userId);
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

export function createResourceSubmission(userId: string, payload: PublishResourcePayload) {
  if (!payload.title?.trim() || !payload.type?.trim() || !payload.category?.trim() || !payload.description?.trim()) {
    throw new Error('resource_content_required');
  }

  const user = getCurrentUser(userId);
  const schoolId = getRequiredActiveSchoolId(userId);
  const asset = getOne<ResourceAssetRow>(
    `
      SELECT id, user_id, storage_provider, storage_key, local_path, original_name, file_name, content_type, size_bytes, created_at
      FROM resource_assets
      WHERE id = @assetId AND user_id = @userId
    `,
    { assetId: payload.assetId, userId }
  );

  if (!asset) {
    throw new Error('resource_asset_not_found');
  }

  const id = createId('r');
  const createdAt = nowIso();
  run(
    `
      INSERT INTO resources (
        id, school_id, content_scope, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
        cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json,
        author_user_id, file_asset_id, source_url, moderation_status, review_note, created_at, updated_at
      ) VALUES (
        @id, @schoolId, 'school', @title, @type, @category, @price, 0, 5, @authorName, @authorMark, @authorTitle,
        @coverLabel, @coverGradient, @tagsJson, @description, @sizeLabel, @suitableFor, @previewPointsJson,
        @authorUserId, @fileAssetId, NULL, 'pending', NULL, @createdAt, @updatedAt
      )
    `,
    {
      id,
      schoolId,
      title: payload.title.trim(),
      type: payload.type.trim(),
      category: payload.category.trim(),
      price: payload.price,
      authorName: user.name,
      authorMark: user.mark,
      authorTitle: `${user.school} · ${user.major}`,
      coverLabel: payload.type.trim() || '资源投稿',
      coverGradient: 'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
      tagsJson: JSON.stringify(payload.tags ?? []),
      description: payload.description.trim(),
      sizeLabel: payload.sizeLabel.trim(),
      suitableFor: payload.suitableFor.trim(),
      previewPointsJson: JSON.stringify(payload.previewPoints ?? []),
      authorUserId: userId,
      fileAssetId: asset.id,
      createdAt,
      updatedAt: createdAt,
    }
  );

  for (const competitionId of payload.relatedCompetitionIds ?? []) {
    const competition = getOne<{ id: string }>(`SELECT id FROM competitions WHERE id = @competitionId`, { competitionId });
    if (competition) {
      run(
        `
          INSERT OR IGNORE INTO resource_competitions (resource_id, competition_id)
          VALUES (@resourceId, @competitionId)
        `,
        { resourceId: id, competitionId }
      );
    }
  }

  createModerationTask('resource', id, 'resource_publish_review', '新的资源投稿待审核');
  pushNotification(userId, {
    category: '审核',
    title: '资源投稿已提交',
    content: `你提交的资源「${payload.title.trim()}」已进入审核队列，审核结果会第一时间同步。`,
    linkType: 'resource',
    linkId: id,
    ctaText: '查看投稿',
  });

  return getResourceDetail(id, userId);
}

export function createResourceAcquire(userId: string, id: string, payload: ResourceAcquirePayload): ResourceAcquireResult {
  const row = getResourceRow(id);
  if (row.source_url && !row.file_asset_id) {
    throw new Error('external_resource_not_downloadable');
  }

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

  if (!serverConfig.paymentsEnabled) {
    throw new Error('payments_disabled');
  }

  const existing = getOne<OrderRow>(
    `
      SELECT id, user_id, title, item_type, amount, status, created_at, paid_at, resource_id, cover_label, updated_at
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
  return getAll<OwnedResourceRow & { school_id: string | null; content_scope: string }>(
    `
      SELECT o.id, o.user_id, o.resource_id, o.title, o.type, o.access_type, o.acquired_at, o.download_count, o.tags_json,
             r.school_id, r.content_scope
      FROM owned_resources o
      JOIN resources r ON r.id = o.resource_id
      WHERE o.user_id = @userId
      ORDER BY o.created_at DESC
    `,
    { userId }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId))
    .map(mapOwnedResource);
}

export function listMyResourceSubmissions(userId: string) {
  const rows = getAll<ResourceRow>(
    `
      SELECT ${resourceSelect}
      FROM resources
      WHERE author_user_id = @userId
      ORDER BY created_at DESC
    `,
    { userId }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId));
  return mapResources(rows, userId);
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
  const { keyword = '', compId, status, listingType, mineOnly = false, showcase = false, schoolScope = 'all' } = query;
  if (showcase && !mineOnly) {
    ensureTeamExamplesForSchool(serverConfig.teamShowcaseSchoolId, true);
    return getAll<TeamRow>(
      `
        SELECT ${teamSelect}
        FROM teams
        WHERE school_id = @schoolId AND is_example = 1 AND moderation_status = 'approved'
          AND (
            @keyword = '' OR title LIKE @search OR target LIKE @search OR full_description LIKE @search
            OR missing_roles_json LIKE @search OR goal_tags_json LIKE @search OR capabilities_json LIKE @search
          )
          AND (CAST(@compId AS TEXT) IS NULL OR comp_id = CAST(@compId AS TEXT))
          AND (CAST(@status AS TEXT) IS NULL OR status = CAST(@status AS TEXT))
          AND (CAST(@listingType AS TEXT) IS NULL OR listing_type = CAST(@listingType AS TEXT))
        ORDER BY deadline ASC, created_at DESC
      `,
      {
        schoolId: serverConfig.teamShowcaseSchoolId,
        keyword,
        search: `%${keyword}%`,
        compId: compId || null,
        status: status || null,
        listingType: listingType || null,
      },
    )
      .filter((row) => !isLikelyCorruptTeamRow(row))
      .filter(isTeamShowcaseExample)
      .filter((row) => matchesTeamSchoolScope(row, userId, schoolScope))
      .map((row) => mapTeam(row, userId));
  }

  if (!mineOnly) ensureTeamExamplesForVerifiedSchool(userId);

  if (mineOnly && userId) {
    return getAll<TeamRow>(
      `
        SELECT ${teamSelect}
        FROM teams
        WHERE author_user_id = @userId
          AND (
            @keyword = '' OR title LIKE @search OR target LIKE @search OR full_description LIKE @search OR missing_roles_json LIKE @search
            OR goal_tags_json LIKE @search OR capabilities_json LIKE @search
          )
          AND (CAST(@compId AS TEXT) IS NULL OR comp_id = CAST(@compId AS TEXT))
          AND (CAST(@status AS TEXT) IS NULL OR status = CAST(@status AS TEXT))
          AND (CAST(@listingType AS TEXT) IS NULL OR listing_type = CAST(@listingType AS TEXT))
        ORDER BY created_at DESC, id DESC
      `,
      {
        userId,
        keyword,
        search: `%${keyword}%`,
        compId: compId || null,
        status: status || null,
        listingType: listingType || null,
      }
    )
      .filter((row) => !isLikelyCorruptTeamRow(row))
      .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
      .filter((row) => isExampleTeamVisible(row, userId))
      .map((row) => mapTeam(row, userId));
  }

  return getAll<TeamRow>(
    `
      SELECT ${teamSelect}
      FROM teams
      WHERE (
        @keyword = '' OR title LIKE @search OR target LIKE @search OR full_description LIKE @search OR missing_roles_json LIKE @search
        OR goal_tags_json LIKE @search OR capabilities_json LIKE @search
      )
        AND (CAST(@compId AS TEXT) IS NULL OR comp_id = CAST(@compId AS TEXT))
        AND (CAST(@status AS TEXT) IS NULL OR status = CAST(@status AS TEXT))
        AND (CAST(@listingType AS TEXT) IS NULL OR listing_type = CAST(@listingType AS TEXT))
        AND moderation_status = 'approved'
      ORDER BY deadline ASC
    `,
    {
      keyword,
      search: `%${keyword}%`,
      compId: compId || null,
      status: status || null,
      listingType: listingType || null,
    }
  )
    .filter((row) => !isLikelyCorruptTeamRow(row))
    .filter((row) => matchesTeamSchoolScope(row, userId, schoolScope))
    .filter((row) => !isTeamExpired(row))
    .filter((row) => isExampleTeamVisible(row, userId))
    .map((row) => mapTeam(row, userId));
}

export function getTeamDetail(id: string, userId?: string) {
  const row = getTeamRow(id);
  const approvedRow = requireVisible(row, userId, row.author_user_id);
  if (!isTeamAccessible(approvedRow, userId)) throw new Error('content_not_available');
  const visibleRow = approvedRow;
  if (isLikelyCorruptTeamRow(visibleRow)) {
    throw new Error('content_not_available');
  }
  if (!isTeamShowcaseExample(visibleRow) && !isExampleTeamVisible(visibleRow, userId)) {
    throw new Error('content_not_available');
  }
  return mapTeam(visibleRow, userId);
}

export function revealTeamContact(userId: string, id: string): TeamContactRevealResult {
  const row = requireVisible(getTeamRow(id), userId);
  if (!isTeamAccessible(row, userId)) throw new Error('content_not_available');
  if (row.is_example) throw new Error('team_example_contact_unavailable');
  if (isTeamExpired(row)) throw new Error('team_contact_closed');
  const viewedOn = shanghaiDate();
  run(
    `
      INSERT INTO team_contact_views (id, team_id, viewer_user_id, viewed_on, created_at)
      VALUES (@id, @teamId, @viewerUserId, @viewedOn, @createdAt)
      ON CONFLICT (team_id, viewer_user_id, viewed_on) DO NOTHING
    `,
    { id: createId('contact'), teamId: id, viewerUserId: userId, viewedOn, createdAt: nowIso() }
  );
  return { teamId: id, contactHint: row.contact_hint, revealedAt: nowIso() };
}

export function createTeamRecruit(userId: string, payload: PublishTeamPayload) {
  const listingType = payload.listingType === 'member_available' ? 'member_available' : 'team_recruit';
  const missingRoles = [...new Set((payload.missingRoles ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 8);
  const requirements = [...new Set((payload.requirements ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 8);
  const goalTags = [...new Set((payload.goalTags ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 5);
  const capabilities = [...new Set((payload.capabilities ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 8);
  const compName = payload.compName?.trim() || '竞赛方向待定';
  const fullDescription = payload.fullDescription?.trim().slice(0, 3000) || '';
  const contactEmail = payload.contactEmail?.trim().toLowerCase() || '';
  const visibilityScope = payload.visibilityScope === 'cross_school' ? 'cross_school' : 'school';

  if (!payload.title?.trim() || !payload.target?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error('team_content_required');
  }

  if (listingType === 'team_recruit' && (!payload.compName?.trim() || missingRoles.length === 0)) {
    throw new Error('team_content_required');
  }

  if (listingType === 'member_available' && capabilities.length === 0) {
    throw new Error('team_capabilities_required');
  }

  const user = getCurrentUser(userId);
  const schoolId = getRequiredActiveSchoolId(userId);
  const id = createId('t');
  const createdAt = nowIso();
  const requestedMax = Number(payload.maxCount);
  const maxCount =
    listingType === 'member_available'
      ? 1
      : Math.max(Number.isFinite(requestedMax) ? Math.round(requestedMax) : missingRoles.length + 1, 2);
  const requestedCurrent = Number(payload.currentCount);
  const currentCount =
    listingType === 'member_available'
      ? 0
      : Math.min(Math.max(Number.isFinite(requestedCurrent) ? Math.round(requestedCurrent) : 1, 1), maxCount);
  run(
    `
      INSERT INTO teams (
        id, school_id, content_scope, listing_type, title, comp_id, comp_name, status, target, full_description, current_count, max_count, missing_roles_json,
        deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
        visibility_scope,
        requirements_json, goal_tags_json, capabilities_json, collaboration_mode, weekly_commitment,
        contact_hint, contact_email, moderation_status, created_at, updated_at
      ) VALUES (
        @id, @schoolId, 'school', @listingType, @title, @compId, @compName, @status, @target, @fullDescription, @currentCount, @maxCount, @missingRolesJson,
        @deadline, @authorUserId, @authorName, @authorMark, @authorGrade, @authorMajor, @schoolLimit,
        @visibilityScope,
        @requirementsJson, @goalTagsJson, @capabilitiesJson, @collaborationMode, @weeklyCommitment,
        @contactHint, @contactEmail, 'pending', @createdAt, @updatedAt
      )
    `,
    {
      id,
      schoolId,
      listingType,
      title: payload.title.trim(),
      compId: payload.compId || null,
      compName,
      status: listingType === 'member_available' ? '求队中' : '招募中',
      target: payload.target.trim(),
      fullDescription,
      currentCount,
      maxCount,
      missingRolesJson: JSON.stringify(missingRoles),
      deadline: payload.deadline?.trim() || '长期有效',
      authorUserId: userId,
      authorName: user.name,
      authorMark: user.mark,
      authorGrade: user.grade,
      authorMajor: user.major,
      schoolLimit: visibilityScope === 'school' ? 1 : 0,
      visibilityScope,
      requirementsJson: JSON.stringify(requirements),
      goalTagsJson: JSON.stringify(goalTags),
      capabilitiesJson: JSON.stringify(capabilities),
      collaborationMode: payload.collaborationMode?.trim() || '',
      weeklyCommitment: payload.weeklyCommitment?.trim() || '',
      contactHint: contactEmail,
      contactEmail,
      createdAt,
      updatedAt: createdAt,
    }
  );
  createModerationTask(
    'team',
    id,
    'team_publish_review',
    listingType === 'member_available' ? '新发布求加入信息待审核' : '新发布组队信息待审核'
  );
  pushNotification(userId, {
    category: '审核',
    title: listingType === 'member_available' ? '求加入信息已提交' : '组队招募已提交',
    content: `你发布的「${payload.title.trim()}」已进入审核队列，通过后会出现在组队大厅。`,
    linkType: 'team',
    linkId: id,
    ctaText: '查看队伍',
  });
  return getTeamDetail(id, userId);
}

export function createTeamApplication(userId: string, id: string, payload: TeamApplicationPayload = {}): TeamApplicationResult {
  if (!serverConfig.teamApplicationsEnabled) throw new Error('team_applications_disabled');
  const teamRow = getTeamRow(id);
  if (teamRow.listing_type === 'member_available') {
    throw new Error('team_application_not_supported');
  }
  const team = mapTeam(requireSchoolVisible(requireVisible(teamRow, userId, teamRow.author_user_id), userId, teamRow.author_user_id), userId);

  if (teamRow.author_user_id === userId) {
    throw new Error('cannot_apply_own_team');
  }

  if (teamRow.current_count >= teamRow.max_count) {
    throw new Error('team_full');
  }

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

    if (teamRow.author_user_id) {
      pushNotification(teamRow.author_user_id, {
        category: '组队',
        title: '有新的队伍申请待处理',
        content: `「${team.title}」收到新的加入申请，建议尽快查看并处理。`,
        linkType: 'team',
        linkId: id,
        ctaText: '处理申请',
      });
    }

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

export function listTeamApplications(ownerUserId: string, teamId: string) {
  const team = getTeamRow(teamId);
  if (team.author_user_id !== ownerUserId) {
    throw new Error('team_forbidden');
  }
  requireSchoolVisible(team, ownerUserId);

  return getAll<{
    id: string;
    team_id: string;
    team_title: string;
    team_comp_name: string;
    user_id: string;
    applicant_name: string;
    applicant_mark: string;
    applicant_school: string;
    applicant_major: string;
    applicant_grade: string;
    applicant_bio: string;
    applicant_focus_tags_json: string;
    message: string | null;
    status: TeamApplicationItem['status'];
    created_at: string;
  }>(
    `
      SELECT ta.id, ta.team_id, t.title AS team_title, t.comp_name AS team_comp_name, ta.user_id,
             u.name AS applicant_name, u.mark AS applicant_mark, u.school AS applicant_school,
             u.major AS applicant_major, u.grade AS applicant_grade, u.bio AS applicant_bio,
             u.focus_tags_json AS applicant_focus_tags_json, ta.message, ta.status, ta.created_at
      FROM team_applications ta
      JOIN teams t ON t.id = ta.team_id
      JOIN users u ON u.id = ta.user_id
      WHERE ta.team_id = @teamId
      ORDER BY CASE ta.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, ta.created_at DESC
    `,
    { teamId }
  ).map(buildTeamApplicationItem);
}

export function reviewTeamApplication(
  ownerUserId: string,
  applicationId: string,
  payload: TeamApplicationDecisionPayload
): TeamApplicationDecisionResult {
  const application = getOne<TeamApplicationRow>(
    `
      SELECT id, team_id, user_id, message, status, created_at
      FROM team_applications
      WHERE id = @applicationId
    `,
    { applicationId }
  );

  if (!application) {
    throw new Error('team_application_not_found');
  }

  const team = getTeamRow(application.team_id);
  if (team.author_user_id !== ownerUserId) {
    throw new Error('team_forbidden');
  }
  requireSchoolVisible(team, ownerUserId);

  const nextStatus = payload.status;
  let nextCurrent = team.current_count;

  if (application.status !== 'approved' && nextStatus === 'approved') {
    if (team.current_count >= team.max_count) {
      throw new Error('team_full');
    }
    nextCurrent += 1;
  } else if (application.status === 'approved' && nextStatus === 'rejected') {
    nextCurrent = Math.max(1, team.current_count - 1);
  }

  const nextTeamStatus = nextCurrent >= team.max_count ? '已满员' : '招募中';

  run(
    `
      UPDATE team_applications
      SET status = @status
      WHERE id = @applicationId
    `,
    { status: nextStatus, applicationId }
  );

  run(
    `
      UPDATE teams
      SET current_count = @currentCount,
          status = @teamStatus,
          updated_at = @updatedAt
      WHERE id = @teamId
    `,
    {
      currentCount: nextCurrent,
      teamStatus: nextTeamStatus,
      updatedAt: nowIso(),
      teamId: team.id,
    }
  );

  pushNotification(application.user_id, {
    category: '组队',
    title: nextStatus === 'approved' ? '组队申请已通过' : '组队申请未通过',
    content:
      nextStatus === 'approved'
        ? `你加入「${team.title}」的申请已通过，现在可以查看联系方式并继续推进。`
        : `你加入「${team.title}」的申请本次未通过，可以稍后补充信息后再尝试。`,
    linkType: 'team',
    linkId: team.id,
    ctaText: '查看队伍',
  });

  return {
    applicationId: application.id,
    teamId: team.id,
    status: nextStatus,
    current: nextCurrent,
    max: team.max_count,
    teamStatus: nextTeamStatus,
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
  )
    .filter((row) => isNotificationTargetAccessible(row, userId))
    .map(mapNotification);
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
  if (!isNotificationTargetAccessible(notification, userId)) {
    throw new Error('content_not_available');
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

  const unreadCount = countAccessibleUnreadNotifications(userId);

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
  const category = payload.category && payload.category !== '全部' ? payload.category : null;
  const requestedIds = new Set((payload.ids ?? []).filter(Boolean));
  const visibleIds = getAll<NotificationRow>(
    `
      SELECT id, user_id, category, title, content, time_label, unread, link_type, link_id, link_scene, comment_id, cta_text
      FROM notifications
      WHERE user_id = @userId
        AND unread = 1
        AND (CAST(@category AS TEXT) IS NULL OR category = CAST(@category AS TEXT))
      ORDER BY created_at DESC
    `,
    { userId, category }
  )
    .filter((row) => isNotificationTargetAccessible(row, userId))
    .filter((row) => payload.all || requestedIds.has(row.id))
    .map((row) => row.id);

  if (visibleIds.length > 0) {
    const placeholders = visibleIds.map((_, index) => `@id${index}`).join(', ');
    const params = visibleIds.reduce<Record<string, string | number | null>>(
      (accumulator, id, index) => {
        accumulator[`id${index}`] = id;
        return accumulator;
      },
      { userId }
    );
    const result = run(
      `UPDATE notifications SET unread = 0 WHERE user_id = @userId AND id IN (${placeholders})`,
      params
    );
    updatedCount = Number(result.changes || 0);
  }

  const unreadCount = countAccessibleUnreadNotifications(userId);

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
            SELECT c.id, c.school_id, c.content_scope, c.title, c.level, c.category, c.host, c.target, c.status, c.deadline, c.days_left, c.views, c.difficulty,
                   c.cover_label, c.cover_gradient, c.tags_json, c.description, c.recommended_for_json, c.action_hints_json,
                   c.registration_start, c.registration_end, c.competition_start, c.competition_end,
                    c.team_size, c.stages_json, c.submission_materials_json, c.awards, c.fee_description, c.official_contact,
                   c.source_url, c.last_verified_at, c.edition_label, c.current_edition_label, c.reference_edition_label,
                   c.reference_notice_url, c.schedule_note, c.data_freshness, c.schedule_status,
                   c.registration_method, c.tracks_json, c.quality_status, c.created_at,
                   (SELECT COUNT(*) FROM favorites competition_favorites
                    WHERE competition_favorites.target_type = 'competition'
                      AND competition_favorites.target_id = c.id) AS favorite_count,
                   f.created_at AS favorited_at
            FROM favorites f
            JOIN competitions c ON c.id = f.target_id
            WHERE f.user_id = @userId AND f.target_type = 'competition'
            ORDER BY f.created_at DESC
          `,
          { userId }
        )
          .filter((row) => isInCurrentSchoolScope(row, userId))
          .map((row) => {
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
            SELECT r.id, r.school_id, r.content_scope, r.title, r.type, r.category, r.price, r.downloads, r.rating, r.author_name, r.author_mark, r.author_title,
                   r.cover_label, r.cover_gradient, r.tags_json, r.description, r.size_label, r.suitable_for, r.preview_points_json,
                   r.author_user_id, r.file_asset_id, r.source_url, r.moderation_status, r.review_note, r.created_at, r.updated_at,
                   f.created_at AS favorited_at
            FROM favorites f
            JOIN resources r ON r.id = f.target_id
            WHERE f.user_id = @userId AND f.target_type = 'resource' AND r.moderation_status = 'approved'
            ORDER BY f.created_at DESC
          `,
          { userId }
        )
          .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
          .map((row) => {
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
            SELECT p.id, p.school_id, p.content_scope, p.title, p.excerpt, p.content_json, p.category, p.author_user_id, p.author_name, p.author_mark,
                   p.likes_count, p.comments_count, p.tags_json, p.time_label, p.related_competition_id, p.related_resource_id,
                   p.question_status, p.accepted_comment_id, p.moderation_status, f.created_at AS favorited_at
            FROM favorites f
            JOIN posts p ON p.id = f.target_id
            WHERE f.user_id = @userId AND f.target_type = 'post' AND p.moderation_status = 'approved'
            ORDER BY f.created_at DESC
          `,
          { userId }
        )
          .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
          .map((row) => {
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

function competitionSearchMeta(item: Competition) {
  if (item.scheduleStatus === 'not_announced') return '本届时间待发布';
  if (item.scheduleStatus === 'closed') return item.deadline ? `截止 ${item.deadline} · 本届已结束` : '本届已结束';
  if (!item.deadline || item.daysLeft >= 9999) return item.status;
  if (item.daysLeft < 0) return `截止 ${item.deadline} · 报名已结束`;
  if (item.daysLeft === 0) return `截止 ${item.deadline} · 今天截止`;
  return `截止 ${item.deadline} · 剩余 ${item.daysLeft} 天`;
}

export function searchAll(query: SearchQuery, userId?: string): SearchResultItem[] {
  const keyword = query.keyword.trim();
  if (!keyword) {
    return [];
  }

  const results: SearchResultItem[] = [];
  const scopes = query.scope === 'all' ? ['competitions', 'resources', 'posts', 'teams'] : [query.scope];

  if (scopes.includes('competitions')) {
    for (const item of listCompetitions({ keyword }, userId)) {
      results.push({
        id: item.id,
        scope: 'competitions',
        title: item.title,
        subtitle: `${item.level} · ${item.category}`,
        meta: competitionSearchMeta(item),
        tags: item.tags,
        link: `/competitions/${item.id}`,
      });
    }
  }

  if (scopes.includes('resources')) {
    for (const item of listResources({ keyword, priceType: '免费' }, userId)) {
      results.push({
        id: item.id,
        scope: 'resources',
        title: item.title,
        subtitle: `${item.category} · ${item.type}`,
        meta: `${item.downloads} 次下载 · ${item.price === 0 ? '免费' : `¥${item.price}`}`,
        tags: item.tags,
        link: `/resources/${item.id}`,
      });
    }
  }

  if (scopes.includes('posts')) {
    const posts = getAll<PostRow>(
      `
        SELECT ${postSelect}
        FROM posts
        WHERE moderation_status = 'approved'
          AND (title LIKE @search OR excerpt LIKE @search OR tags_json LIKE @search)
        ORDER BY created_at DESC, id DESC
        LIMIT 20
      `,
      { search: `%${keyword}%` }
    )
      .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
      .map((row) => mapPost(row, userId));

    for (const item of posts) {
      results.push({
        id: item.id,
        scope: 'posts',
        title: item.title,
        subtitle: `${item.category} · ${item.authorName}`,
        meta: `${item.likes} 点赞 · ${item.comments} 评论`,
        tags: item.tags,
        link: `/posts/${item.id}`,
      });
    }
  }

  if (scopes.includes('teams')) {
    for (const item of listTeams({ keyword }, userId)) {
      results.push({
        id: item.id,
        scope: 'teams',
        title: item.title,
        subtitle: `${item.compName} · ${item.status}`,
        meta: `缺 ${Math.max(item.max - item.current, 0)} 人 · 截止 ${item.deadline}`,
        tags: item.listingType === 'member_available' ? [...(item.capabilities ?? []), ...(item.goalTags ?? [])] : item.missingRoles,
        link: `/teams/${item.id}`,
      });
    }
  }

  return results;
}
