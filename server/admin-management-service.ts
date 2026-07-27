import type {
  AdminAuditLogItem,
  AdminCreateSchoolAdminPayload,
  AdminCompetitionItem,
  AdminCompetitionPayload,
  AdminCompetitionPublishStatus,
  AdminResourcePublishPayload,
  AdminResourcePublishResult,
  AdminDashboardSummary,
  AdminSchoolAdminItem,
  AdminSchoolHomeConfig,
  AdminSchoolHomePayload,
  AdminSchoolItem,
  AdminSchoolListResult,
  AdminTeamExampleArchiveResult,
  AdminTeamExampleItem,
  AdminUpdateSchoolAdminPayload,
} from '../frontend/src/app/lib/admin-types';
import { hashAdminPassword } from './admin-security.ts';
import { serverConfig } from './config.ts';
import { listModerationTasks, listReports } from './community-service.ts';
import { createId, getAll, getOne, nowIso, run } from './helpers.ts';
import type { AdminContentScope, AdminUserRow, CompetitionRow, SchoolHomeConfigRow, SchoolRow } from './models.ts';

function normalizeLimit(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(max, Math.round(parsed))) : fallback;
}

function parseStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseDetail(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function requireSchool(scope: AdminContentScope, requestedSchoolId?: string) {
  const requested = requestedSchoolId?.trim();
  if (scope.role === 'school_admin') {
    if (!scope.schoolId) throw new Error('admin_scope_forbidden');
    if (requested && requested !== scope.schoolId) throw new Error('admin_scope_forbidden');
    return scope.schoolId;
  }
  if (!requested) throw new Error('admin_school_required');
  return requested;
}

function getSchool(schoolId: string) {
  const school = getOne<SchoolRow>(
    `SELECT id, source_id, code, name, short_name, province, city, logo_url, is_open, is_hot, sort_order, created_at, updated_at
     FROM schools WHERE id = @schoolId`,
    { schoolId }
  );
  if (!school) throw new Error('school_not_found');
  return school;
}

function countRows(table: 'posts' | 'teams' | 'resources', schoolId: string | null, status?: string) {
  return Number(
    getOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${table}
       WHERE (CAST(@schoolId AS TEXT) IS NULL OR school_id = CAST(@schoolId AS TEXT))
         AND (CAST(@status AS TEXT) IS NULL OR moderation_status = CAST(@status AS TEXT))`,
      { schoolId, status: status || null }
    )?.count ?? 0
  );
}

export function getAdminDashboardSummary(scope: AdminContentScope): AdminDashboardSummary {
  const schoolId = scope.role === 'school_admin' ? scope.schoolId || '__missing_school__' : null;
  const tasks = listModerationTasks({}, scope);
  const reports = listReports({}, scope);
  const activeTask = (targetType: string) =>
    tasks.filter((item) => item.targetType === targetType && ['pending', 'processing'].includes(item.status)).length;
  const home =
    scope.role === 'school_admin'
      ? null
      : getOne<{ publish_status: string; banners_json: string }>(
          `SELECT publish_status, banners_json FROM home_feed_configs WHERE id = 'default'`
        );

  return {
    scope: scope.role === 'school_admin' ? 'school' : 'platform',
    schoolId: scope.role === 'school_admin' ? scope.schoolId || undefined : undefined,
    schoolName: scope.role === 'school_admin' && scope.schoolId ? getSchool(scope.schoolId).name : undefined,
    pendingPosts: activeTask('post') + activeTask('comment'),
    pendingTeams: activeTask('team'),
    pendingResources: activeTask('resource'),
    pendingReports: reports.filter((item) => ['pending', 'processing'].includes(item.status)).length,
    approvedPosts: countRows('posts', schoolId, 'approved'),
    approvedTeams: countRows('teams', schoolId, 'approved'),
    approvedResources: countRows('resources', schoolId, 'approved'),
    platformHomeStatus: home?.publish_status,
    platformBannerCount: home ? parseStringArray(home.banners_json).length : undefined,
  };
}

export function listAdminTeamExamples(
  scope: AdminContentScope,
  query: { schoolId?: string; status?: string } = {},
): AdminTeamExampleItem[] {
  const requestedSchoolId = String(query.schoolId || '').trim();
  if (scope.role === 'school_admin' && (!scope.schoolId || (requestedSchoolId && requestedSchoolId !== scope.schoolId))) {
    throw new Error('admin_scope_forbidden');
  }
  const schoolId = scope.role === 'school_admin' ? scope.schoolId! : requestedSchoolId;
  const status = ['active', 'archived'].includes(String(query.status || '')) ? String(query.status) : 'all';
  const now = nowIso();
  return getAll<{
    id: string;
    school_id: string;
    school_name: string;
    title: string;
    comp_name: string;
    listing_type: 'team_recruit' | 'member_available';
    status: string;
    example_expires_at: string | null;
    created_at: string;
  }>(
    `SELECT t.id, t.school_id, s.name AS school_name, t.title, t.comp_name, t.listing_type,
            t.status, t.example_expires_at, t.created_at
     FROM teams t
     JOIN schools s ON s.id = t.school_id
     WHERE t.is_example = 1
       AND (@schoolId = '' OR t.school_id = @schoolId)
       AND (
         @status = 'all'
         OR (@status = 'active' AND t.status != '已结束' AND (t.example_expires_at IS NULL OR t.example_expires_at >= @now))
         OR (@status = 'archived' AND (t.status = '已结束' OR (t.example_expires_at IS NOT NULL AND t.example_expires_at < @now)))
       )
     ORDER BY s.sort_order ASC, t.created_at DESC, t.id ASC`,
    { schoolId, status, now },
  ).map((row) => ({
    id: row.id,
    schoolId: row.school_id,
    schoolName: row.school_name,
    title: row.title,
    competitionName: row.comp_name,
    listingType: row.listing_type,
    status: row.status,
    expiresAt: row.example_expires_at || undefined,
    createdAt: row.created_at,
    archived: row.status === '已结束' || Boolean(row.example_expires_at && row.example_expires_at < now),
  }));
}

export function archiveAdminTeamExamples(
  scope: AdminContentScope,
  rawIds: unknown,
): AdminTeamExampleArchiveResult {
  const ids = Array.from(new Set((Array.isArray(rawIds) ? rawIds : []).map((item) => String(item).trim()).filter(Boolean))).slice(0, 100);
  if (ids.length === 0) throw new Error('admin_team_examples_required');
  const placeholders = ids.map((_, index) => `@id${index}`);
  const params = Object.fromEntries(ids.map((id, index) => [`id${index}`, id]));
  const rows = getAll<{ id: string; school_id: string }>(
    `SELECT id, school_id FROM teams WHERE is_example = 1 AND id IN (${placeholders.join(', ')})`,
    params,
  );
  if (rows.length !== ids.length) throw new Error('admin_team_example_not_found');
  if (scope.role === 'school_admin' && (!scope.schoolId || rows.some((row) => row.school_id !== scope.schoolId))) {
    throw new Error('admin_scope_forbidden');
  }
  const archivedAt = nowIso();
  for (const id of ids) {
    run(
      `UPDATE teams
       SET status = '已结束', example_expires_at = @archivedAt, updated_at = @archivedAt
       WHERE id = @id AND is_example = 1`,
      { id, archivedAt },
    );
  }
  return { archivedCount: ids.length };
}

function getSchoolHomeOptions(schoolId: string) {
  const teams = getAll<{ id: string; title: string; comp_name: string; deadline: string }>(
    `SELECT id, title, comp_name, deadline FROM teams
     WHERE school_id = @schoolId AND content_scope = 'school' AND moderation_status = 'approved'
     ORDER BY created_at DESC LIMIT 50`,
    { schoolId }
  ).map((item) => ({ id: item.id, title: item.title, meta: `${item.comp_name} / ${item.deadline}` }));
  const posts = getAll<{ id: string; title: string; category: string; author_name: string }>(
    `SELECT id, title, category, author_name FROM posts
     WHERE school_id = @schoolId AND content_scope = 'school' AND moderation_status = 'approved'
       AND category = '经验贴'
     ORDER BY created_at DESC LIMIT 50`,
    { schoolId }
  ).map((item) => ({ id: item.id, title: item.title, meta: `${item.category} / ${item.author_name}` }));
  return { teams, posts };
}

export function getAdminSchoolHomeConfig(scope: AdminContentScope, requestedSchoolId?: string): AdminSchoolHomeConfig {
  const schoolId = requireSchool(scope, requestedSchoolId);
  const school = getSchool(schoolId);
  const row = getOne<SchoolHomeConfigRow>(
    `SELECT school_id, announcement, team_ids_json, post_ids_json, updated_by_admin_id, updated_at
     FROM school_home_configs WHERE school_id = @schoolId`,
    { schoolId }
  );
  const options = getSchoolHomeOptions(schoolId);
  const availableTeamIds = new Set(options.teams.map((item) => item.id));
  const availablePostIds = new Set(options.posts.map((item) => item.id));
  return {
    schoolId,
    schoolName: school.name,
    announcement: row?.announcement || '',
    teamIds: parseStringArray(row?.team_ids_json).filter((id) => availableTeamIds.has(id)).slice(0, 2),
    postIds: parseStringArray(row?.post_ids_json).filter((id) => availablePostIds.has(id)).slice(0, 2),
    availableTeams: options.teams,
    availablePosts: options.posts,
    updatedAt: row?.updated_at,
  };
}

export function updateAdminSchoolHomeConfig(
  adminUserId: string,
  scope: AdminContentScope,
  payload: AdminSchoolHomePayload
) {
  const schoolId = requireSchool(scope, payload.schoolId);
  const current = getAdminSchoolHomeConfig(scope, schoolId);
  const teamIds = [...new Set((payload.teamIds || []).map(String).filter(Boolean))].slice(0, 2);
  const postIds = [...new Set((payload.postIds || []).map(String).filter(Boolean))].slice(0, 2);
  const availableTeams = new Set(current.availableTeams.map((item) => item.id));
  const availablePosts = new Set(current.availablePosts.map((item) => item.id));
  if (teamIds.some((id) => !availableTeams.has(id)) || postIds.some((id) => !availablePosts.has(id))) {
    throw new Error('school_home_content_invalid');
  }
  const announcement = String(payload.announcement || '').trim().slice(0, 120);
  const updatedAt = nowIso();
  run(
    `INSERT INTO school_home_configs (
       school_id, announcement, team_ids_json, post_ids_json, updated_by_admin_id, updated_at
     ) VALUES (
       @schoolId, @announcement, @teamIdsJson, @postIdsJson, @adminUserId, @updatedAt
     )
     ON CONFLICT (school_id) DO UPDATE SET
       announcement = excluded.announcement,
       team_ids_json = excluded.team_ids_json,
       post_ids_json = excluded.post_ids_json,
       updated_by_admin_id = excluded.updated_by_admin_id,
       updated_at = excluded.updated_at`,
    {
      schoolId,
      announcement,
      teamIdsJson: JSON.stringify(teamIds),
      postIdsJson: JSON.stringify(postIds),
      adminUserId,
      updatedAt,
    }
  );
  return getAdminSchoolHomeConfig(scope, schoolId);
}

function mapSchoolAdmin(row: AdminUserRow & { last_login_at: string | null }): AdminSchoolAdminItem {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    status: row.status,
    permissions: parseStringArray(row.permissions_json),
    lastLoginAt: row.last_login_at || undefined,
    createdAt: row.created_at,
  };
}

function listSchoolAdmins(schoolId: string) {
  return getAll<AdminUserRow & { last_login_at: string | null }>(
    `SELECT au.id, au.username, au.password_hash, au.display_name, au.role, au.permissions_json,
            au.school_id, au.school_name, au.status, au.created_at, au.updated_at,
            (SELECT MAX(log.created_at) FROM admin_audit_logs log
             WHERE log.admin_user_id = au.id AND log.action = 'admin.login') AS last_login_at
     FROM admin_users au
     WHERE au.role = 'school_admin' AND au.school_id = @schoolId
     ORDER BY au.created_at DESC`,
    { schoolId }
  ).map(mapSchoolAdmin);
}

export function listAdminSchools(query: { keyword?: string; limit?: unknown; offset?: unknown } = {}): AdminSchoolListResult {
  const keyword = String(query.keyword || '').trim();
  const limit = normalizeLimit(query.limit, 30, 100);
  const offset = Math.max(0, Number(query.offset) || 0);
  const searchParams = { keyword, search: `%${keyword}%` };
  const params = { ...searchParams, limit, offset };
  const total = Number(
    getOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM schools
       WHERE @keyword = '' OR name LIKE @search OR short_name LIKE @search OR province LIKE @search OR city LIKE @search`,
      searchParams
    )?.count ?? 0
  );
  const rows = getAll<SchoolRow>(
    `SELECT id, source_id, code, name, short_name, province, city, logo_url, is_open, is_hot, sort_order, created_at, updated_at
     FROM schools
     WHERE @keyword = '' OR name LIKE @search OR short_name LIKE @search OR province LIKE @search OR city LIKE @search
     ORDER BY is_hot DESC, sort_order ASC, name ASC
     LIMIT @limit OFFSET @offset`,
    params
  );
  const items: AdminSchoolItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.short_name || row.name,
    province: row.province || undefined,
    city: row.city || undefined,
    logoUrl: row.logo_url || undefined,
    isOpen: Boolean(row.is_open),
    isHot: Boolean(row.is_hot),
    verifiedUsers: Number(
      getOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM user_school_memberships
         WHERE school_id = @schoolId AND certification_status = 'verified' AND email_verified = 1 AND phone_verified = 1`,
        { schoolId: row.id }
      )?.count ?? 0
    ),
    approvedPosts: countRows('posts', row.id, 'approved'),
    approvedTeams: countRows('teams', row.id, 'approved'),
    approvedResources: countRows('resources', row.id, 'approved'),
    admins: listSchoolAdmins(row.id),
  }));
  return { items, total };
}

export function updateAdminSchool(schoolId: string, payload: { isOpen?: boolean; isHot?: boolean }) {
  getSchool(schoolId);
  if (typeof payload.isOpen !== 'boolean' && typeof payload.isHot !== 'boolean') {
    throw new Error('admin_school_update_invalid');
  }
  run(
    `UPDATE schools SET
       is_open = CASE WHEN @hasIsOpen = 1 THEN @isOpen ELSE is_open END,
       is_hot = CASE WHEN @hasIsHot = 1 THEN @isHot ELSE is_hot END,
       updated_at = @updatedAt
     WHERE id = @schoolId`,
    {
      schoolId,
      hasIsOpen: typeof payload.isOpen === 'boolean' ? 1 : 0,
      isOpen: payload.isOpen ? 1 : 0,
      hasIsHot: typeof payload.isHot === 'boolean' ? 1 : 0,
      isHot: payload.isHot ? 1 : 0,
      updatedAt: nowIso(),
    }
  );
  return listAdminSchools({ keyword: getSchool(schoolId).name, limit: 20 }).items.find((item) => item.id === schoolId);
}

function validateAdminIdentity(username: string, password: string, displayName: string) {
  if (!/^[a-zA-Z0-9_.-]{4,32}$/.test(username)) throw new Error('admin_username_invalid');
  if (password.length < 10) throw new Error('admin_password_weak');
  if (!displayName || displayName.length > 40) throw new Error('admin_display_name_invalid');
}

export function createSchoolAdmin(schoolId: string, payload: AdminCreateSchoolAdminPayload) {
  const school = getSchool(schoolId);
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');
  const displayName = String(payload.displayName || '').trim();
  validateAdminIdentity(username, password, displayName);
  if (getOne<{ id: string }>(`SELECT id FROM admin_users WHERE username = @username`, { username })) {
    throw new Error('admin_username_exists');
  }
  const id = createId('adm_school');
  const now = nowIso();
  run(
    `INSERT INTO admin_users (
       id, username, password_hash, display_name, role, permissions_json,
       school_id, school_name, status, created_at, updated_at
     ) VALUES (
       @id, @username, @passwordHash, @displayName, 'school_admin', @permissionsJson,
       @schoolId, @schoolName, 'active', @createdAt, @updatedAt
     )`,
    {
      id,
      username,
      passwordHash: hashAdminPassword(password),
      displayName,
      permissionsJson: JSON.stringify(serverConfig.adminPermissions.school_admin),
      schoolId,
      schoolName: school.name,
      createdAt: now,
      updatedAt: now,
    }
  );
  return listSchoolAdmins(schoolId).find((item) => item.id === id);
}

export function updateSchoolAdmin(adminId: string, payload: AdminUpdateSchoolAdminPayload) {
  const current = getOne<AdminUserRow>(
    `SELECT id, username, password_hash, display_name, role, permissions_json, school_id, school_name,
            status, created_at, updated_at FROM admin_users WHERE id = @adminId`,
    { adminId }
  );
  if (!current || current.role !== 'school_admin' || !current.school_id) throw new Error('admin_user_not_found');
  const displayName = payload.displayName === undefined ? current.display_name : String(payload.displayName).trim();
  const password = payload.password === undefined ? '' : String(payload.password);
  if (!displayName || displayName.length > 40) throw new Error('admin_display_name_invalid');
  if (password && password.length < 10) throw new Error('admin_password_weak');
  const status = payload.status === undefined ? current.status : payload.status;
  run(
    `UPDATE admin_users SET
       display_name = @displayName,
       password_hash = @passwordHash,
       status = @status,
       permissions_json = @permissionsJson,
       updated_at = @updatedAt
     WHERE id = @adminId`,
    {
      adminId,
      displayName,
      passwordHash: password ? hashAdminPassword(password) : current.password_hash,
      status,
      permissionsJson: JSON.stringify(serverConfig.adminPermissions.school_admin),
      updatedAt: nowIso(),
    }
  );
  if (status === 'disabled' || password) {
    run(`DELETE FROM admin_sessions WHERE admin_user_id = @adminId`, { adminId });
  }
  return listSchoolAdmins(current.school_id).find((item) => item.id === adminId);
}

export function listAdminAuditEntries(query: {
  schoolId?: string;
  adminUserId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: unknown;
} = {}): AdminAuditLogItem[] {
  const limit = normalizeLimit(query.limit, 100, 200);
  const rows = getAll<{
    id: string;
    admin_user_id: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    detail_json: string | null;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
    username: string;
    display_name: string;
    role: string;
    school_id: string | null;
    school_name: string | null;
  }>(
    `SELECT log.id, log.admin_user_id, log.action, log.target_type, log.target_id,
            log.detail_json, log.ip, log.user_agent, log.created_at,
            au.username, au.display_name, au.role, au.school_id, au.school_name
     FROM admin_audit_logs log
     JOIN admin_users au ON au.id = log.admin_user_id
     WHERE (CAST(@schoolId AS TEXT) IS NULL OR au.school_id = CAST(@schoolId AS TEXT))
       AND (CAST(@adminUserId AS TEXT) IS NULL OR au.id = CAST(@adminUserId AS TEXT))
       AND (@action = '' OR log.action LIKE @actionSearch)
       AND (CAST(@from AS TEXT) IS NULL OR log.created_at >= CAST(@from AS TEXT))
       AND (CAST(@to AS TEXT) IS NULL OR log.created_at <= CAST(@to AS TEXT))
     ORDER BY log.created_at DESC
     LIMIT @limit`,
    {
      schoolId: query.schoolId || null,
      adminUserId: query.adminUserId || null,
      action: query.action || '',
      actionSearch: `%${query.action || ''}%`,
      from: query.from || null,
      to: query.to || null,
      limit,
    }
  );
  return rows.map((row) => ({
    id: row.id,
    adminUserId: row.admin_user_id,
    adminUsername: row.username,
    adminDisplayName: row.display_name,
    adminRole: row.role,
    schoolId: row.school_id || undefined,
    schoolName: row.school_name || undefined,
    action: row.action,
    targetType: row.target_type || undefined,
    targetId: row.target_id || undefined,
    detail: parseDetail(row.detail_json),
    ip: row.ip || undefined,
    userAgent: row.user_agent || undefined,
    createdAt: row.created_at,
  }));
}

function requirePlatformCompetitionScope(scope: AdminContentScope) {
  if (scope.schoolId || scope.role === 'school_admin') throw new Error('admin_scope_forbidden');
}

function parseCompetitionArray(value: string | null | undefined) {
  return parseStringArray(value).map((item) => item.trim()).filter(Boolean);
}

function mapAdminCompetition(row: CompetitionRow): AdminCompetitionItem {
  return {
    id: row.id,
    contentScope: 'platform',
    title: row.title,
    level: row.level,
    category: row.category,
    host: row.host,
    target: row.target,
    status: row.status,
    deadline: row.deadline,
    daysLeft: row.days_left,
    views: row.views,
    favoriteCount: Number(row.favorite_count || 0),
    difficulty: row.difficulty,
    coverLabel: row.cover_label,
    coverGradient: row.cover_gradient,
    tags: parseCompetitionArray(row.tags_json),
    description: row.description,
    recommendedFor: parseCompetitionArray(row.recommended_for_json),
    actionHints: parseCompetitionArray(row.action_hints_json),
    registrationStart: row.registration_start || undefined,
    registrationEnd: row.registration_end || undefined,
    competitionStart: row.competition_start || undefined,
    competitionEnd: row.competition_end || undefined,
    teamSize: row.team_size || undefined,
    stages: parseCompetitionArray(row.stages_json),
    submissionMaterials: parseCompetitionArray(row.submission_materials_json),
    awards: row.awards || undefined,
    feeDescription: row.fee_description || undefined,
    officialContact: row.official_contact || undefined,
    sourceUrl: row.source_url || undefined,
    lastVerifiedAt: row.last_verified_at || undefined,
    editionLabel: row.edition_label || '',
    currentEditionLabel: row.current_edition_label || row.edition_label || undefined,
    referenceEditionLabel: row.reference_edition_label || undefined,
    referenceNoticeUrl: row.reference_notice_url || undefined,
    scheduleNote: row.schedule_note || undefined,
    dataFreshness: row.data_freshness || 'current',
    scheduleStatus: row.schedule_status || 'not_announced',
    registrationMethod: row.registration_method || undefined,
    tracks: parseCompetitionArray(row.tracks_json),
    qualityStatus: row.quality_status || 'pending_review',
    notices: [],
    publishStatus: row.publish_status || 'published',
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

const adminCompetitionSelect = `
  id, school_id, content_scope, title, level, category, host, target, status, deadline, days_left, views,
  difficulty, cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json,
  registration_start, registration_end, competition_start, competition_end, team_size, stages_json,
  submission_materials_json, awards, fee_description, official_contact, source_url, last_verified_at,
  edition_label, current_edition_label, reference_edition_label, reference_notice_url, schedule_note, data_freshness,
  schedule_status, registration_method, tracks_json, quality_status, publish_status, created_at, updated_at,
  (SELECT COUNT(*) FROM favorites f WHERE f.target_type = 'competition' AND f.target_id = competitions.id) AS favorite_count
`;

export function listAdminCompetitions(
  scope: AdminContentScope,
  query: { keyword?: string; publishStatus?: string; limit?: unknown } = {},
) {
  requirePlatformCompetitionScope(scope);
  const keyword = String(query.keyword || '').trim();
  const publishStatus = ['draft', 'published', 'archived'].includes(String(query.publishStatus || ''))
    ? String(query.publishStatus) as AdminCompetitionPublishStatus
    : '';
  const limit = normalizeLimit(query.limit, 100, 200);
  return getAll<CompetitionRow>(
    `SELECT ${adminCompetitionSelect} FROM competitions
     WHERE (@keyword = '' OR title LIKE @search OR host LIKE @search OR category LIKE @search)
       AND (@publishStatus = '' OR publish_status = @publishStatus)
     ORDER BY CASE publish_status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
              COALESCE(updated_at, last_verified_at, created_at) DESC, title ASC
     LIMIT @limit`,
    { keyword, search: `%${keyword}%`, publishStatus, limit },
  ).map(mapAdminCompetition);
}

function getAdminCompetitionById(scope: AdminContentScope, id: string) {
  requirePlatformCompetitionScope(scope);
  const row = getOne<CompetitionRow>(
    `SELECT ${adminCompetitionSelect} FROM competitions WHERE id = @id`,
    { id },
  );
  if (!row) throw new Error('competition_not_found');
  return mapAdminCompetition(row);
}

function exactDate(value: unknown) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function calculateDaysLeft(deadline: string) {
  if (!exactDate(deadline)) return 9999;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  return Math.ceil((Date.parse(`${deadline}T00:00:00+08:00`) - Date.parse(`${today}T00:00:00+08:00`)) / 86_400_000);
}

function cleanArray(value: unknown, max = 12) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeAdminCompetitionPayload(payload: AdminCompetitionPayload) {
  const title = String(payload.title || '').trim();
  const host = String(payload.host || '').trim();
  const target = String(payload.target || '').trim();
  const description = String(payload.description || '').trim();
  const sourceUrl = String(payload.sourceUrl || '').trim();
  if (title.length < 2 || title.length > 120 || !host || !target || !description) throw new Error('admin_competition_invalid');
  if (sourceUrl && !/^https?:\/\/[^\s]+$/i.test(sourceUrl)) throw new Error('admin_competition_source_invalid');
  const publishStatus: AdminCompetitionPublishStatus = ['draft', 'published', 'archived'].includes(payload.publishStatus)
    ? payload.publishStatus
    : 'draft';
  const deadline = exactDate(payload.deadline) || '';
  const stages = cleanArray(payload.stages);
  const submissionMaterials = cleanArray(payload.submissionMaterials);
  const tracks = cleanArray(payload.tracks, 20);
  const editionLabel = String(payload.editionLabel || '').trim().slice(0, 80);
  const scheduleStatus = ['announced', 'partially_announced', 'not_announced', 'closed'].includes(payload.scheduleStatus)
    ? payload.scheduleStatus
    : 'not_announced';
  const qualityStatus = ['verified', 'pending_review', 'stale'].includes(payload.qualityStatus)
    ? payload.qualityStatus
    : 'pending_review';
  const teamSize = String(payload.teamSize || '').trim().slice(0, 160);
  const lastVerifiedAt = exactDate(payload.lastVerifiedAt);
  if (
    publishStatus === 'published' &&
    (qualityStatus !== 'verified' || !sourceUrl || !editionLabel || !teamSize || stages.length < 3 || submissionMaterials.length < 3 || !lastVerifiedAt)
  ) {
    throw new Error('admin_competition_quality_invalid');
  }
  return {
    title,
    level: String(payload.level || '国家级').trim().slice(0, 20),
    category: String(payload.category || '学术科研').trim().slice(0, 30),
    host: host.slice(0, 160),
    target: target.slice(0, 240),
    status: String(payload.status || (scheduleStatus === 'closed' ? '已截止' : '届次待发布')).trim().slice(0, 30),
    deadline,
    daysLeft: calculateDaysLeft(deadline),
    difficulty: String(payload.difficulty || '中').trim().slice(0, 20),
    description: description.slice(0, 4000),
    teamSize: teamSize || null,
    stagesJson: JSON.stringify(stages),
    submissionMaterialsJson: JSON.stringify(submissionMaterials),
    tagsJson: JSON.stringify(cleanArray(payload.tags)),
    recommendedForJson: JSON.stringify(cleanArray(payload.recommendedFor)),
    actionHintsJson: JSON.stringify(cleanArray(payload.actionHints)),
    registrationStart: exactDate(payload.registrationStart) || null,
    registrationEnd: exactDate(payload.registrationEnd) || null,
    competitionStart: exactDate(payload.competitionStart) || null,
    competitionEnd: exactDate(payload.competitionEnd) || null,
    awards: String(payload.awards || '').trim().slice(0, 500) || null,
    feeDescription: String(payload.feeDescription || '').trim().slice(0, 500) || null,
    officialContact: String(payload.officialContact || '').trim().slice(0, 500) || null,
    sourceUrl: sourceUrl || null,
    lastVerifiedAt: lastVerifiedAt || null,
    editionLabel,
    scheduleStatus,
    registrationMethod: String(payload.registrationMethod || '').trim().slice(0, 500) || null,
    tracksJson: JSON.stringify(tracks),
    qualityStatus,
    publishStatus,
    coverLabel: title.slice(0, 2),
    updatedAt: nowIso(),
  };
}

export function createAdminCompetition(scope: AdminContentScope, payload: AdminCompetitionPayload) {
  requirePlatformCompetitionScope(scope);
  const data = normalizeAdminCompetitionPayload(payload);
  const id = createId('competition');
  run(
    `INSERT INTO competitions (
       id, school_id, content_scope, title, level, category, host, target, status, deadline, days_left, views,
       difficulty, cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json,
       registration_start, registration_end, competition_start, competition_end, team_size, stages_json,
       submission_materials_json, awards, fee_description, official_contact, source_url, last_verified_at,
       edition_label, schedule_status, registration_method, tracks_json, quality_status,
       publish_status, created_at, updated_at
     ) VALUES (
       @id, NULL, 'platform', @title, @level, @category, @host, @target, @status, @deadline, @daysLeft, 0,
       @difficulty, @coverLabel, '', @tagsJson, @description, @recommendedForJson, @actionHintsJson,
       @registrationStart, @registrationEnd, @competitionStart, @competitionEnd, @teamSize, @stagesJson,
       @submissionMaterialsJson, @awards, @feeDescription, @officialContact, @sourceUrl, @lastVerifiedAt,
       @editionLabel, @scheduleStatus, @registrationMethod, @tracksJson, @qualityStatus,
       @publishStatus, @createdAt, @updatedAt
     )`,
    { id, ...data, createdAt: data.updatedAt },
  );
  return getAdminCompetitionById(scope, id);
}

export function updateAdminCompetition(scope: AdminContentScope, id: string, payload: AdminCompetitionPayload) {
  requirePlatformCompetitionScope(scope);
  if (!getOne<{ id: string }>('SELECT id FROM competitions WHERE id = @id', { id })) throw new Error('competition_not_found');
  const data = normalizeAdminCompetitionPayload(payload);
  run(
    `UPDATE competitions SET
       title = @title, level = @level, category = @category, host = @host, target = @target,
       status = @status, deadline = @deadline, days_left = @daysLeft, difficulty = @difficulty,
       cover_label = @coverLabel, tags_json = @tagsJson, description = @description,
       recommended_for_json = @recommendedForJson, action_hints_json = @actionHintsJson,
       registration_start = @registrationStart, registration_end = @registrationEnd,
       competition_start = @competitionStart, competition_end = @competitionEnd,
       team_size = @teamSize, stages_json = @stagesJson, submission_materials_json = @submissionMaterialsJson,
       awards = @awards, fee_description = @feeDescription, official_contact = @officialContact,
       source_url = @sourceUrl, last_verified_at = @lastVerifiedAt, edition_label = @editionLabel,
       schedule_status = @scheduleStatus, registration_method = @registrationMethod,
       tracks_json = @tracksJson, quality_status = @qualityStatus,
       publish_status = @publishStatus, updated_at = @updatedAt
     WHERE id = @id`,
    { id, ...data },
  );
  return getAdminCompetitionById(scope, id);
}

export function ensureAdminResourceAssetUser(adminUserId: string) {
  const admin = getOne<AdminUserRow>(
    `SELECT id, username, password_hash, display_name, role, permissions_json, school_id, school_name,
            status, created_at, updated_at FROM admin_users WHERE id = @adminUserId`,
    { adminUserId },
  );
  if (!admin) throw new Error('admin_user_not_found');
  const id = `system_admin_asset_${adminUserId}`.slice(0, 96);
  const now = nowIso();
  run(
    `INSERT INTO users (
       id, open_id, union_id, session_key, name, mark, avatar_url, school_id, school, major, grade, bio,
       focus_tags_json, points, checkin_streak, last_checkin_date, created_at, updated_at
     ) VALUES (
       @id, @openId, NULL, NULL, @name, '管', NULL, NULL, '平台', '管理员文件', '',
       '用于记录管理员上传文件的系统身份，不参与用户展示。', '[]', 0, 0, NULL, @createdAt, @updatedAt
     ) ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    {
      id,
      openId: `system:admin-asset:${adminUserId}`,
      name: `${admin.display_name}文件资产`,
      createdAt: now,
      updatedAt: now,
    },
  );
  return id;
}

export function createAdminPublishedResource(
  scope: AdminContentScope,
  adminUserId: string,
  assetId: string,
  payload: AdminResourcePublishPayload,
): AdminResourcePublishResult {
  const title = String(payload.title || '').trim();
  const category = String(payload.category || '').trim();
  const description = String(payload.description || '').trim();
  const suitableFor = String(payload.suitableFor || '').trim();
  if (title.length < 2 || title.length > 120 || !category || !description || !assetId) throw new Error('admin_resource_invalid');
  const asset = getOne<{ id: string; original_name: string; size_bytes: number; content_type: string }>(
    'SELECT id, original_name, size_bytes, content_type FROM resource_assets WHERE id = @assetId',
    { assetId },
  );
  if (!asset) throw new Error('resource_asset_not_found');
  const schoolId = scope.schoolId || null;
  const contentScope = schoolId ? 'school' : 'platform';
  const school = schoolId ? getSchool(schoolId) : null;
  const id = createId('resource');
  const now = nowIso();
  const type = '资料包';
  const tags = cleanArray(payload.tags, 12);
  const previewPoints = cleanArray(payload.previewPoints, 12);
  const relatedCompetitionIds = cleanArray(payload.relatedCompetitionIds, 30);
  run(
    `INSERT INTO resources (
       id, school_id, content_scope, title, type, category, price, downloads, rating,
       author_name, author_mark, author_title, cover_label, cover_gradient, tags_json,
       description, size_label, suitable_for, preview_points_json, author_user_id,
       file_asset_id, source_url, moderation_status, review_note, created_at, updated_at
     ) VALUES (
       @id, @schoolId, @contentScope, @title, @type, @category, 0, 0, 5,
       @authorName, '管', @authorTitle, @coverLabel, '', @tagsJson,
       @description, @sizeLabel, @suitableFor, @previewPointsJson, NULL,
       @fileAssetId, NULL, 'approved', '管理员人工发布', @createdAt, @updatedAt
     )`,
    {
      id,
      schoolId,
      contentScope,
      title,
      type,
      category: category.slice(0, 40),
      authorName: school ? `${school.short_name || school.name}管理员` : '校园成长内容组',
      authorTitle: school ? `${school.name} · 人工发布` : '平台原创 · 人工发布',
      coverLabel: '资料',
      tagsJson: JSON.stringify(tags),
      description: description.slice(0, 4000),
      sizeLabel: `${Math.max(1, Math.ceil(asset.size_bytes / 1024))} KB`,
      suitableFor: suitableFor.slice(0, 500),
      previewPointsJson: JSON.stringify(previewPoints),
      fileAssetId: assetId,
      createdAt: now,
      updatedAt: now,
    },
  );
  for (const competitionId of relatedCompetitionIds) {
    const competition = getOne<{ id: string }>(
      `SELECT id FROM competitions WHERE id = @competitionId AND publish_status = 'published'`,
      { competitionId },
    );
    if (!competition) continue;
    run(
      `INSERT INTO resource_competitions (resource_id, competition_id)
       VALUES (@resourceId, @competitionId) ON CONFLICT (resource_id, competition_id) DO NOTHING`,
      { resourceId: id, competitionId },
    );
  }
  return { id, title, schoolId: schoolId || undefined, contentScope, fileAssetId: assetId, moderationStatus: 'approved' };
}
