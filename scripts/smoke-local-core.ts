import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const zjuToken = 'local-zju-session-token';
const zjuPeerToken = 'local-zju-peer-session-token';
const fduToken = 'local-fdu-session-token';
const unverifiedToken = 'local-zju-unverified-session-token';
const testRunId = Date.now().toString(36);
const testUserAgent = `campus-growth-school-isolation-smoke/${testRunId}`;
const testIp = `198.51.100.${(Date.now() % 250) + 1}`;
const adminRateLimitKey = createHash('sha256').update(`auth:admin-login:${testIp}`).digest('hex');
const localDbPath = resolve('server/data/campus-growth-local-preview.db');

async function request<T>(path: string, token?: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'User-Agent': testUserAgent,
      'X-Forwarded-For': testIp,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json() as { code: number; message: string; data: T };
  if (!response.ok || payload.code !== 0) throw new Error(`${path}: ${payload.message}`);
  return payload.data;
}

async function expectForbidden(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'User-Agent': testUserAgent,
      'X-Forwarded-For': testIp,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const payload = await response.json() as { code: number; message: string };
  assert(response.status === 403, `${path}: expected 403, received ${response.status} ${payload.message}`);
  return payload;
}

async function expectStatus(path: string, expectedStatus: number, token: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'User-Agent': testUserAgent,
      'X-Forwarded-For': testIp,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const payload = await response.json() as { message: string };
  assert(response.status === expectedStatus, `${path}: expected ${expectedStatus}, received ${response.status} ${payload.message}`);
  return payload;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cleanupTemporaryData(
  postIds: string[],
  teamIds: string[],
  reportIds: string[],
  adminIds: string[],
  rateLimitKey: string,
  schoolHomeBackup?: { schoolId: string; announcement: string; teamIds: string[]; postIds: string[]; updatedByAdminId?: string | null; updatedAt?: string }
) {
  if (!/campus-growth-local-preview\.db$/i.test(localDbPath)) {
    throw new Error(`refusing cleanup outside local preview database: ${localDbPath}`);
  }

  const cleanupDb = new DatabaseSync(localDbPath);
  try {
    cleanupDb.exec('PRAGMA busy_timeout = 5000');
    for (const id of [...postIds, ...teamIds, ...reportIds]) {
      cleanupDb.prepare(`DELETE FROM moderation_tasks WHERE target_id = @id`).run({ id });
    }
    for (const id of postIds) {
      cleanupDb.prepare(`DELETE FROM notifications WHERE link_id = @id`).run({ id });
      cleanupDb.prepare(`DELETE FROM posts WHERE id = @id`).run({ id });
    }
    for (const id of teamIds) {
      cleanupDb.prepare(`DELETE FROM notifications WHERE link_id = @id`).run({ id });
      cleanupDb.prepare(`DELETE FROM team_contact_views WHERE team_id = @id`).run({ id });
      cleanupDb.prepare(`DELETE FROM team_applications WHERE team_id = @id`).run({ id });
      cleanupDb.prepare(`DELETE FROM teams WHERE id = @id`).run({ id });
    }
    for (const id of reportIds) {
      cleanupDb.prepare(`DELETE FROM reports WHERE id = @id`).run({ id });
    }
    cleanupDb.prepare(`DELETE FROM admin_audit_logs WHERE user_agent = @userAgent`).run({ userAgent: testUserAgent });
    cleanupDb.prepare(`DELETE FROM rate_limit_buckets WHERE bucket_key = @rateLimitKey`).run({ rateLimitKey });
    for (const id of adminIds) {
      cleanupDb.prepare(`DELETE FROM admin_sessions WHERE admin_user_id = @id`).run({ id });
      cleanupDb.prepare(`DELETE FROM admin_users WHERE id = @id`).run({ id });
    }
    if (schoolHomeBackup) {
      cleanupDb.prepare(
        `UPDATE school_home_configs SET announcement = @announcement, team_ids_json = @teamIdsJson,
         post_ids_json = @postIdsJson, updated_by_admin_id = @updatedByAdminId, updated_at = @updatedAt
         WHERE school_id = @schoolId`
      ).run({
        schoolId: schoolHomeBackup.schoolId,
        announcement: schoolHomeBackup.announcement,
        teamIdsJson: JSON.stringify(schoolHomeBackup.teamIds),
        postIdsJson: JSON.stringify(schoolHomeBackup.postIds),
        updatedByAdminId: schoolHomeBackup.updatedByAdminId || null,
        updatedAt: schoolHomeBackup.updatedAt || new Date().toISOString(),
      });
    }
  } finally {
    cleanupDb.close();
  }
}

const health = await request<{ databaseProvider: string; wechatLoginMode: string }>('/health');
assert(health.databaseProvider === 'sqlite', 'local smoke must use sqlite');
assert(health.wechatLoginMode === 'mock', 'local smoke must use mock WeChat login');

const publicCompetitions = await request<Array<{ id: string; contentScope: string }>>('/competitions?limit=5', unverifiedToken);
assert(publicCompetitions.length > 0, 'platform competitions missing for unverified user');
assert(publicCompetitions.every((item) => item.contentScope === 'platform'), 'school competition leaked to unverified user');
const publicCompetition = await request<{ id: string; contentScope: string }>(`/competitions/${publicCompetitions[0].id}`, unverifiedToken);
assert(publicCompetition.contentScope === 'platform', 'unverified user cannot open platform competition detail');

const publicResources = await request<Array<{ id: string; contentScope: string }>>('/resources?priceType=免费&limit=5', unverifiedToken);
assert(publicResources.length > 0, 'platform resources missing for unverified user');
assert(publicResources.every((item) => item.contentScope === 'platform'), 'school resource leaked to unverified user');
const publicResource = await request<{ id: string; contentScope: string }>(`/resources/${publicResources[0].id}`, unverifiedToken);
assert(publicResource.contentScope === 'platform', 'unverified user cannot open platform resource detail');

const unverifiedPosts = await request<Array<{ id: string }>>('/posts', unverifiedToken);
const unverifiedTeams = await request<Array<{ id: string }>>('/teams', unverifiedToken);
assert(!unverifiedPosts.some((item) => item.id.startsWith('local_')), 'school post leaked to unverified user');
assert(!unverifiedTeams.some((item) => item.id.startsWith('local_')), 'school team leaked to unverified user');
const showcaseRecruitTeams = await request<Array<{ id: string; schoolId?: string; isExample?: boolean }>>(
  '/teams?showcase=true&listingType=team_recruit',
);
const showcaseMemberTeams = await request<Array<{ id: string; schoolId?: string; isExample?: boolean }>>(
  '/teams?showcase=true&listingType=member_available',
);
assert(showcaseRecruitTeams.length === 4, 'showcase recruit examples missing');
assert(showcaseMemberTeams.length === 2, 'showcase member examples missing');
assert(
  [...showcaseRecruitTeams, ...showcaseMemberTeams].every((item) => item.isExample && item.schoolId === 'sch_114'),
  'team showcase contains a non-ZJU or non-example item',
);
const anonymousShowcaseDetail = await request<{ id: string; isExample?: boolean; schoolId?: string }>(
  `/teams/${showcaseRecruitTeams[0].id}`,
);
assert(
  anonymousShowcaseDetail.isExample && anonymousShowcaseDetail.schoolId === 'sch_114',
  'anonymous user cannot open ZJU showcase detail',
);

const unverifiedHome = await request<{
  latestTeams: Array<{ id: string; schoolId?: string; isExample?: boolean }>;
  featuredPosts: Array<{ id: string }>;
}>('/feeds/home', unverifiedToken);
assert(!unverifiedHome.latestTeams.some((item) => item.id.startsWith('local_')), 'school team leaked on unverified home');
assert(!unverifiedHome.featuredPosts.some((item) => item.id.startsWith('local_')), 'school post leaked on unverified home');
assert(
  unverifiedHome.latestTeams.length > 0 && unverifiedHome.latestTeams.every((item) => item.isExample && item.schoolId === 'sch_114'),
  'unverified home should show only the public ZJU showcase examples',
);
assert(unverifiedHome.featuredPosts.length === 0, 'unverified home should not expose a school experience section');

await expectForbidden('/posts/local_zju_question_open', unverifiedToken);
await expectForbidden('/teams/local_zju_team', unverifiedToken);
await expectForbidden('/resources/local_zju_resource', unverifiedToken);

const unverifiedSearch = await request<Array<{ id: string; scope: string }>>('/search?keyword=本地测试&scope=all', unverifiedToken);
assert(!unverifiedSearch.some((item) => item.id.startsWith('local_')), 'school content leaked through search');

const unverifiedFavorites = await request<{
  competitions: Array<{ contentScope: string }>;
  resources: Array<{ id: string }>;
  posts: Array<{ id: string }>;
}>('/users/favorites', unverifiedToken);
assert(unverifiedFavorites.competitions.some((item) => item.contentScope === 'platform'), 'platform favorite missing');
assert(!unverifiedFavorites.resources.some((item) => item.id.startsWith('local_')), 'school resource leaked through favorites');
assert(!unverifiedFavorites.posts.some((item) => item.id.startsWith('local_')), 'school post leaked through favorites');

const unverifiedActivity = await request<{
  publishedTeams: Array<{ id: string }>;
  publishedPosts: Array<{ id: string }>;
  competitionEnrollments: Array<{ competition: { contentScope: string } }>;
  teamApplications: Array<{ teamId: string }>;
}>('/users/activity', unverifiedToken);
assert(unverifiedActivity.publishedTeams.length === 0, 'school team leaked through activity');
assert(unverifiedActivity.publishedPosts.length === 0, 'school post leaked through activity');
assert(unverifiedActivity.competitionEnrollments.every((item) => item.competition.contentScope === 'platform'), 'school competition leaked through activity');
assert(unverifiedActivity.teamApplications.length === 0, 'school team application leaked through activity');

const unverifiedNotifications = await request<Array<{ id: string; unread: boolean }>>('/notifications', unverifiedToken);
assert(unverifiedNotifications.some((item) => item.id === 'local_unverified_platform_notice'), 'platform notification missing');
assert(!unverifiedNotifications.some((item) => item.id === 'local_unverified_school_notice'), 'school notification leaked');
const unverifiedProfile = await request<{ stats: { unreadMessages: number } }>('/users/me', unverifiedToken);
assert(
  unverifiedProfile.stats.unreadMessages === unverifiedNotifications.filter((item) => item.unread).length,
  'visible notification count differs from profile unread count'
);
await expectForbidden('/notifications/local_unverified_school_notice/read', unverifiedToken, { method: 'PATCH' });

await expectForbidden('/posts', unverifiedToken, {
  method: 'POST',
  body: JSON.stringify({ title: '未认证发布测试', category: '问答', content: '应被拒绝', tags: [] }),
});
await expectForbidden('/teams', unverifiedToken, {
  method: 'POST',
  body: JSON.stringify({
    listingType: 'team_recruit',
    title: '未认证组队测试',
    compName: '本地测试竞赛',
    target: '应被拒绝',
    missingRoles: ['开发'],
    deadline: '2099-12-31',
    requirements: ['认真参与'],
    maxCount: 3,
    schoolLimit: true,
    visibilityScope: 'school',
    contactHint: 'unverified@example.com',
    contactEmail: 'unverified@example.com',
  }),
});
await expectForbidden('/resources', unverifiedToken, {
  method: 'POST',
  body: JSON.stringify({
    title: '未认证资源测试',
    type: '清单',
    category: '资料包',
    price: 0,
    description: '应被拒绝',
    sizeLabel: '1 KB',
    suitableFor: '测试用户',
    tags: [],
    previewPoints: [],
    relatedCompetitionIds: [],
    assetId: 'missing',
  }),
});
await expectForbidden('/posts/local_zju_question_open/comments', unverifiedToken, {
  method: 'POST',
  body: JSON.stringify({ content: '应被拒绝' }),
});
await expectForbidden('/comments/local_zju_answer/like', unverifiedToken, {
  method: 'PATCH',
  body: JSON.stringify({ liked: true }),
});
await expectForbidden('/reports', unverifiedToken, {
  method: 'POST',
  body: JSON.stringify({ targetType: 'post', targetId: 'local_zju_question_open', reason: '其他' }),
});

const anonymousPosts = await request<Array<{ id: string }>>('/posts?category=问答');
assert(!anonymousPosts.some((item) => item.id.startsWith('local_')), 'anonymous user leaked school posts');

const zjuPosts = await request<Array<{ id: string }>>('/posts?category=问答', zjuToken);
const fduPosts = await request<Array<{ id: string }>>('/posts?category=问答', fduToken);
assert(zjuPosts.some((item) => item.id === 'local_zju_question_open'), 'zju question missing');
assert(!zjuPosts.some((item) => item.id.startsWith('local_fdu_')), 'fdu post leaked to zju');
assert(fduPosts.some((item) => item.id === 'local_fdu_question_open'), 'fdu question missing');
assert(!fduPosts.some((item) => item.id.startsWith('local_zju_')), 'zju post leaked to fdu');

const zjuResource = await request<{ id: string; contentScope: string }>('/resources/local_zju_resource', zjuToken);
assert(zjuResource.id === 'local_zju_resource' && zjuResource.contentScope === 'school', 'zju resource missing');
await expectForbidden('/resources/local_zju_resource', fduToken);
const zjuSearch = await request<Array<{ id: string }>>('/search?keyword=浙江大学&scope=all', zjuToken);
assert(zjuSearch.some((item) => item.id.startsWith('local_zju_')), 'zju school search results missing');
const scheduleSearch = await request<Array<{ scope: string; meta: string }>>('/search?keyword=数学建模&scope=competitions', zjuToken);
assert(scheduleSearch.length > 0, 'competition search results missing');
assert(scheduleSearch.every((item) => !item.meta.includes('9999') && item.meta !== '截止  · 剩余 9999 天'), 'unannounced competition leaked sentinel days into search');

const zjuCompetitions = await request<Array<{ id: string; contentScope: string }>>('/competitions?keyword=内测', zjuToken);
const fduCompetitions = await request<Array<{ id: string; contentScope: string }>>('/competitions?keyword=内测', fduToken);
assert(zjuCompetitions.some((item) => item.id === 'local_zju_competition'), 'zju school competition missing');
assert(!zjuCompetitions.some((item) => item.id === 'local_fdu_competition'), 'fdu competition leaked to zju');
assert(fduCompetitions.some((item) => item.id === 'local_fdu_competition'), 'fdu school competition missing');
assert(!fduCompetitions.some((item) => item.id === 'local_zju_competition'), 'zju competition leaked to fdu');
await expectForbidden('/competitions/local_zju_competition', unverifiedToken);
await expectForbidden('/competitions/local_zju_competition', fduToken);
const zjuCompetition = await request<{ id: string; contentScope: string }>('/competitions/local_zju_competition', zjuToken);
assert(zjuCompetition.contentScope === 'school', 'zju school competition detail missing');

const pendingPost = await request<{ id: string; moderationStatus?: string }>('/posts/local_zju_pending_post', zjuToken);
assert(pendingPost.moderationStatus === 'pending', 'author cannot view own pending post');
await expectForbidden('/posts/local_zju_pending_post', zjuPeerToken);
await expectForbidden('/posts/local_zju_pending_post', fduToken);

let crossSchoolDetailBlocked = false;
try {
  await request('/posts/local_zju_question_open', fduToken);
} catch {
  crossSchoolDetailBlocked = true;
}
assert(crossSchoolDetailBlocked, 'fdu user accessed zju post detail');

const unanswered = await request<Array<{ id: string }>>('/posts?category=问答&questionFilter=unanswered', zjuToken);
assert(unanswered.some((item) => item.id === 'local_zju_question_open'), 'unanswered filter missing open question');

const zjuTeams = await request<Array<{ id: string; isExample?: boolean }>>('/teams?listingType=team_recruit', zjuToken);
const fduTeams = await request<Array<{ id: string; isExample?: boolean }>>('/teams?listingType=team_recruit', fduToken);
assert(zjuTeams.some((item) => item.id === 'local_zju_team'), 'zju team missing');
assert(!zjuTeams.some((item) => item.id === 'local_fdu_team'), 'fdu team leaked to zju');
assert(fduTeams.some((item) => item.id === 'local_fdu_team'), 'fdu team missing');
const zjuExamples = zjuTeams.filter((item) => item.isExample);
const fduExamples = fduTeams.filter((item) => item.isExample);
assert(zjuExamples.length === 4, 'zju team recruit examples missing');
assert(fduExamples.length === 0, 'non-ZJU school received showcase examples');
const fduShowcaseDetail = await request<{ id: string; isExample?: boolean }>(`/teams/${zjuExamples[0].id}`, fduToken);
assert(fduShowcaseDetail.isExample, 'verified non-ZJU user cannot open showcase detail');
await expectStatus(`/teams/${zjuExamples[0].id}/contact-views`, 409, zjuToken, { method: 'POST' });

const hidingTeamIds = [`local_example_hide_${testRunId}_1`, `local_example_hide_${testRunId}_2`];
const hidingDb = new DatabaseSync(localDbPath);
try {
  hidingDb.exec('PRAGMA busy_timeout = 5000');
  for (const id of hidingTeamIds) {
    hidingDb.prepare(`
      INSERT INTO teams (
        id, school_id, content_scope, listing_type, title, comp_id, comp_name, status, target, full_description,
        current_count, max_count, missing_roles_json, deadline, author_user_id, author_name, author_mark,
        author_grade, author_major, school_limit, requirements_json, goal_tags_json, capabilities_json,
        collaboration_mode, weekly_commitment, contact_hint, is_example, example_expires_at,
        moderation_status, created_at, updated_at
      )
      SELECT @id, school_id, content_scope, listing_type, @title, comp_id, comp_name, status, target, full_description,
        current_count, max_count, missing_roles_json, deadline, author_user_id, author_name, author_mark,
        author_grade, author_major, school_limit, requirements_json, goal_tags_json, capabilities_json,
        collaboration_mode, weekly_commitment, contact_hint, 0, NULL,
        'approved', @createdAt, @createdAt
      FROM teams WHERE id = 'local_zju_team'
    `).run({ id, title: `示例隐藏阈值测试 ${id}`, createdAt: new Date().toISOString() });
  }
  const hiddenExamples = await request<Array<{ isExample?: boolean }>>('/teams?listingType=team_recruit', zjuToken);
  assert(!hiddenExamples.some((item) => item.isExample), 'examples were not hidden after three real teams');
  const visibleShowcaseExamples = await request<Array<{ isExample?: boolean }>>('/teams?showcase=true&listingType=team_recruit');
  assert(visibleShowcaseExamples.length === 4 && visibleShowcaseExamples.every((item) => item.isExample), 'showcase examples were hidden by real team threshold');
} finally {
  for (const id of hidingTeamIds) hidingDb.prepare('DELETE FROM teams WHERE id = @id').run({ id });
  hidingDb.close();
}

const zjuHome = await request<{
  latestTeams: Array<{ id: string; schoolId?: string; contentScope: string }>;
  featuredPosts: Array<{ id: string; schoolId?: string; contentScope: string; category: string }>;
  urgentCompetitions: Array<{ id: string; contentScope: string }>;
  hotResources: Array<{ id: string; contentScope: string }>;
}>('/feeds/home', zjuToken);
const fduHome = await request<typeof zjuHome>('/feeds/home', fduToken);
assert(zjuHome.latestTeams.length > 0, 'zju home team preview missing');
assert(!zjuHome.latestTeams.some((item) => item.id === 'local_fdu_team'), 'fdu team leaked on zju home');
assert(zjuHome.latestTeams.length <= 2, 'zju home team section exceeds two items');
assert(zjuHome.featuredPosts.some((item) => item.id === 'local_zju_experience'), 'zju home experience missing');
assert(
  zjuHome.featuredPosts.every((item) => item.contentScope === 'school' && item.category === '经验贴'),
  'zju home experience section contains platform news or non-experience content'
);
assert(!zjuHome.featuredPosts.some((item) => item.id === 'local_fdu_experience'), 'fdu experience leaked on zju home');
assert(zjuHome.featuredPosts.length <= 2, 'zju home experience section exceeds two items');
assert(fduHome.latestTeams.length > 0, 'fdu home team preview missing');
assert(!fduHome.latestTeams.some((item) => item.id === 'local_zju_team'), 'zju team leaked on fdu home');
assert(fduHome.featuredPosts.some((item) => item.id === 'local_fdu_experience'), 'fdu home experience missing');
assert(!fduHome.featuredPosts.some((item) => item.id === 'local_zju_experience'), 'zju experience leaked on fdu home');
assert(zjuHome.urgentCompetitions.some((item) => item.contentScope === 'platform'), 'platform competition missing on zju home');
assert(zjuHome.hotResources.some((item) => item.contentScope === 'platform'), 'platform resource missing on zju home');

let nonOwnerAcceptanceBlocked = false;
try {
  await request('/posts/local_zju_question_acceptance/accepted-comment', zjuPeerToken, {
    method: 'PATCH',
    body: JSON.stringify({ commentId: 'local_zju_answer' }),
  });
} catch {
  nonOwnerAcceptanceBlocked = true;
}
assert(nonOwnerAcceptanceBlocked, 'non-owner accepted a question answer');

const accepted = await request<{ questionStatus?: string; acceptedCommentId?: string }>(
  '/posts/local_zju_question_acceptance/accepted-comment',
  zjuToken,
  { method: 'PATCH', body: JSON.stringify({ commentId: 'local_zju_answer' }) },
);
assert(accepted.questionStatus === 'resolved', 'question was not resolved');
assert(accepted.acceptedCommentId === 'local_zju_answer', 'accepted comment was not saved');

const comments = await request<Array<{ id: string; isAccepted?: boolean }>>('/posts/local_zju_question_acceptance/comments', zjuToken);
assert(comments.some((item) => item.id === 'local_zju_answer' && item.isAccepted), 'accepted answer marker missing');

const resolved = await request<Array<{ id: string }>>('/posts?category=问答&questionFilter=resolved', zjuToken);
assert(resolved.some((item) => item.id === 'local_zju_question_acceptance'), 'resolved filter missing accepted question');

type AdminSessionResult = {
  token: string;
  admin: { id: string; role: string; permissions: string[]; schoolId?: string; schoolName?: string };
};
type ModerationTaskResult = {
  id: string;
  targetId: string;
  targetType: string;
  status: string;
  schoolId?: string;
  targetVisibilityScope?: string;
  targetContactEmail?: string;
};
type ReportListItem = {
  id: string;
  status: string;
  school_id?: string;
};

let zjuAdminToken = '';
let fduAdminToken = '';
let platformAdminToken = '';
const temporaryPostIds: string[] = [];
const temporaryTeamIds: string[] = [];
const temporaryReportIds: string[] = [];
const temporaryAdminIds: string[] = [];
let schoolHomeBackup: {
  schoolId: string;
  announcement: string;
  teamIds: string[];
  postIds: string[];
  updatedByAdminId?: string | null;
  updatedAt?: string;
} | undefined;
try {
  const zjuAdmin = await request<AdminSessionResult>('/admin/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username: 'local_zju_admin', password: 'LocalTest123!' }),
  });
  const fduAdmin = await request<AdminSessionResult>('/admin/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username: 'local_fdu_admin', password: 'LocalTest123!' }),
  });
  zjuAdminToken = zjuAdmin.token;
  fduAdminToken = fduAdmin.token;
  assert(zjuAdmin.admin.role === 'school_admin' && zjuAdmin.admin.schoolId, 'zju school admin scope missing');
  assert(fduAdmin.admin.role === 'school_admin' && fduAdmin.admin.schoolId, 'fdu school admin scope missing');
  assert(zjuAdmin.admin.schoolId !== fduAdmin.admin.schoolId, 'school admins unexpectedly share one scope');
  assert(!zjuAdmin.admin.permissions.includes('home:read'), 'school admin still has platform home permission');
  assert(zjuAdmin.admin.permissions.includes('school_home:write'), 'school admin school-home permission missing');

  const platformAdmin = await request<AdminSessionResult>('/admin/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username: 'local_platform_admin', password: 'LocalPlatform123!' }),
  });
  platformAdminToken = platformAdmin.token;

  type TeamExampleAdminItem = { id: string; schoolId: string; schoolName: string; archived: boolean; expiresAt?: string };
  const platformExamples = await request<TeamExampleAdminItem[]>('/admin/team-examples?status=active', platformAdminToken);
  assert(platformExamples.length === 6, 'platform admin example list should contain only ZJU showcase items');
  const zjuAdminExamples = await request<TeamExampleAdminItem[]>('/admin/team-examples?status=active', zjuAdminToken);
  assert(zjuAdminExamples.length === 6 && zjuAdminExamples.every((item) => item.schoolName === '浙江大学'), 'zju admin example scope is incorrect');
  const fduAdminExamples = await request<TeamExampleAdminItem[]>('/admin/team-examples?status=active', fduAdminToken);
  assert(fduAdminExamples.length === 0, 'non-ZJU school admin should not receive showcase examples');
  await expectForbidden('/admin/team-examples/archive', fduAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ ids: [zjuAdminExamples[0].id] }),
  });

  const archiveTarget = zjuAdminExamples[0];
  const archiveDb = new DatabaseSync(localDbPath);
  const archiveBackup = archiveDb.prepare('SELECT status, example_expires_at, updated_at FROM teams WHERE id = @id').get({ id: archiveTarget.id }) as {
    status: string;
    example_expires_at: string | null;
    updated_at: string;
  };
  archiveDb.close();
  try {
    const archived = await request<{ archivedCount: number }>('/admin/team-examples/archive', zjuAdminToken, {
      method: 'PATCH',
      body: JSON.stringify({ ids: [archiveTarget.id] }),
    });
    assert(archived.archivedCount === 1, 'example archive did not report one item');
    const archivedItems = await request<TeamExampleAdminItem[]>('/admin/team-examples?status=archived', zjuAdminToken);
    assert(archivedItems.some((item) => item.id === archiveTarget.id && item.archived), 'archived example missing from admin list');
  } finally {
    const restoreDb = new DatabaseSync(localDbPath);
    restoreDb.prepare('UPDATE teams SET status = @status, example_expires_at = @expiresAt, updated_at = @updatedAt WHERE id = @id').run({
      id: archiveTarget.id,
      status: archiveBackup.status,
      expiresAt: archiveBackup.example_expires_at,
      updatedAt: archiveBackup.updated_at,
    });
    restoreDb.close();
  }
  assert(platformAdmin.admin.role === 'super_admin' && !platformAdmin.admin.schoolId, 'platform admin scope invalid');

  const zjuAdminProfile = await request<AdminSessionResult['admin']>('/admin/me', zjuAdminToken);
  const fduAdminProfile = await request<AdminSessionResult['admin']>('/admin/me', fduAdminToken);
  assert(zjuAdminProfile.schoolName === '浙江大学', 'zju admin profile school mismatch');
  assert(fduAdminProfile.schoolName === '复旦大学', 'fdu admin profile school mismatch');
  await expectForbidden('/admin/home-config', zjuAdminToken);
  await expectForbidden('/admin/schools?keyword=浙江大学', zjuAdminToken);
  await expectForbidden('/admin/audit-logs', zjuAdminToken);

  const zjuDashboard = await request<{
    scope: string;
    schoolId?: string;
    schoolName?: string;
    pendingPosts: number;
    pendingTeams: number;
    pendingResources: number;
    pendingReports: number;
  }>('/admin/dashboard', zjuAdminToken);
  const fduDashboard = await request<typeof zjuDashboard>('/admin/dashboard', fduAdminToken);
  assert(zjuDashboard.scope === 'school' && zjuDashboard.schoolName === '浙江大学', 'zju dashboard is not school scoped');
  assert(fduDashboard.scope === 'school' && fduDashboard.schoolName === '复旦大学', 'fdu dashboard is not school scoped');

  const originalSchoolHome = await request<{
    schoolId: string;
    schoolName: string;
    announcement: string;
    teamIds: string[];
    postIds: string[];
    availableTeams: Array<{ id: string }>;
    availablePosts: Array<{ id: string }>;
    updatedAt?: string;
  }>('/admin/school-home-config', zjuAdminToken);
  schoolHomeBackup = {
    schoolId: originalSchoolHome.schoolId,
    announcement: originalSchoolHome.announcement,
    teamIds: originalSchoolHome.teamIds,
    postIds: originalSchoolHome.postIds,
    updatedByAdminId: zjuAdmin.admin.id,
    updatedAt: originalSchoolHome.updatedAt,
  };
  assert(originalSchoolHome.availableTeams.some((item) => item.id === 'local_zju_team'), 'zju school-home team option missing');
  assert(!originalSchoolHome.availableTeams.some((item) => item.id === 'local_fdu_team'), 'fdu team leaked into zju school-home options');
  assert(originalSchoolHome.availablePosts.some((item) => item.id === 'local_zju_experience'), 'zju school-home post option missing');
  assert(!originalSchoolHome.availablePosts.some((item) => item.id.includes('question')), 'non-experience post leaked into school-home options');
  await expectForbidden(`/admin/school-home-config?schoolId=${encodeURIComponent('sch_132')}`, zjuAdminToken);

  const testAnnouncement = `浙江大学本地运营测试 ${testRunId}`;
  const updatedSchoolHome = await request<typeof originalSchoolHome>('/admin/school-home-config', zjuAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({
      announcement: testAnnouncement,
      teamIds: ['local_zju_team'],
      postIds: ['local_zju_experience'],
    }),
  });
  assert(updatedSchoolHome.announcement === testAnnouncement, 'school announcement update failed');
  const personalizedHome = await request<{ schoolAnnouncement?: { text: string }; latestTeams: Array<{ id: string }>; featuredPosts: Array<{ id: string }> }>('/feeds/home', zjuToken);
  assert(personalizedHome.schoolAnnouncement?.text === testAnnouncement, 'school announcement did not reach user home');
  assert(personalizedHome.latestTeams[0]?.id === 'local_zju_team', 'school recommended team did not reach user home');
  assert(personalizedHome.featuredPosts[0]?.id === 'local_zju_experience', 'school recommended post did not reach user home');

  const teamBodyMarker = `完整招募正文闭环 ${testRunId}`;
  const temporaryTeam = await request<{ id: string; moderationStatus?: string; fullDescription?: string }>('/teams', zjuToken, {
    method: 'POST',
    body: JSON.stringify({
      listingType: 'team_recruit',
      title: `本地完整招募正文测试 ${testRunId}`,
      compId: 'local_zju_competition',
      compName: '本地测试：浙江大学校级竞赛',
      target: '已完成选题和方案初稿，现补充一名技术开发同学。',
      fullDescription: `${teamBodyMarker}\n项目已有明确分工，加入后按周同步真实进展。`,
      missingRoles: ['技术开发'],
      deadline: '2099-12-31',
      requirements: ['每周按时同步进度'],
      goalTags: ['兴趣体验'],
      capabilities: ['方案设计'],
      collaborationMode: '线上线下均可',
      weeklyCommitment: '每周 3-5 小时',
      currentCount: 2,
      maxCount: 4,
      schoolLimit: false,
      visibilityScope: 'cross_school',
      contactHint: 'team-smoke@example.com',
      contactEmail: 'team-smoke@example.com',
    }),
  });
  temporaryTeamIds.push(temporaryTeam.id);
  assert(temporaryTeam.moderationStatus === 'pending', 'temporary team did not enter moderation queue');
  assert(temporaryTeam.fullDescription?.includes(teamBodyMarker), 'team full description missing from owner detail');
  await expectForbidden(`/teams/${temporaryTeam.id}`, zjuPeerToken);
  await expectForbidden(`/teams/${temporaryTeam.id}`, fduToken);

  const temporaryTeamTasks = await request<ModerationTaskResult[]>('/moderation/tasks?status=pending&targetType=team', zjuAdminToken);
  const temporaryTeamTask = temporaryTeamTasks.find((item) => item.targetId === temporaryTeam.id);
  assert(temporaryTeamTask, 'temporary team did not reach zju moderation queue');
  assert(temporaryTeamTask.targetVisibilityScope === 'cross_school', 'moderation task is missing team visibility scope');
  assert(temporaryTeamTask.targetContactEmail === 'team-smoke@example.com', 'moderation task is missing contact email');
  const fduTeamTasks = await request<ModerationTaskResult[]>('/moderation/tasks?status=pending&targetType=team', fduAdminToken);
  assert(!fduTeamTasks.some((item) => item.targetId === temporaryTeam.id), 'temporary zju team leaked to fdu moderation queue');
  await expectForbidden(`/moderation/tasks/${temporaryTeamTask.id}`, fduAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', note: 'cross-school operation must fail' }),
  });
  await request(`/moderation/tasks/${temporaryTeamTask.id}`, zjuAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', note: 'full-description smoke approved' }),
  });
  const approvedTeam = await request<{
    id: string;
    moderationStatus?: string;
    fullDescription?: string;
    visibilityScope?: string;
    contactEmail?: string;
  }>(`/teams/${temporaryTeam.id}`, zjuPeerToken);
  assert(approvedTeam.moderationStatus === 'approved', 'approved team is not visible to same-school peer');
  assert(approvedTeam.fullDescription?.includes(teamBodyMarker), 'approved team full description missing from detail');
  assert(approvedTeam.visibilityScope === 'cross_school', 'approved team visibility scope is incorrect');
  assert(approvedTeam.contactEmail === 'team-smoke@example.com', 'approved team contact email is missing');
  const crossSchoolTeam = await request<{ id: string; contactEmail?: string }>(`/teams/${temporaryTeam.id}`, fduToken);
  assert(crossSchoolTeam.contactEmail === 'team-smoke@example.com', 'cross-school viewer cannot access contact email');
  const fduOtherTeams = await request<Array<{ id: string }>>('/teams?schoolScope=other', fduToken);
  assert(fduOtherTeams.some((item) => item.id === temporaryTeam.id), 'cross-school team missing from other-school filter');
  const fduCurrentTeams = await request<Array<{ id: string }>>('/teams?schoolScope=current', fduToken);
  assert(!fduCurrentTeams.some((item) => item.id === temporaryTeam.id), 'cross-school team leaked into current-school filter');
  const fullDescriptionSearch = await request<Array<{ id: string }>>(`/teams?keyword=${encodeURIComponent(teamBodyMarker)}`, zjuPeerToken);
  assert(fullDescriptionSearch.some((item) => item.id === temporaryTeam.id), 'team full description is not searchable');

  const teamDb = new DatabaseSync(localDbPath, { readOnly: true });
  try {
    const storedTeam = teamDb.prepare(`SELECT full_description, visibility_scope, contact_email FROM teams WHERE id = @id`).get({ id: temporaryTeam.id }) as {
      full_description?: string;
      visibility_scope?: string;
      contact_email?: string;
    } | undefined;
    assert(storedTeam?.full_description?.includes(teamBodyMarker), 'team full description was not persisted in sqlite');
    assert(storedTeam?.visibility_scope === 'cross_school', 'team visibility scope was not persisted in sqlite');
    assert(storedTeam?.contact_email === 'team-smoke@example.com', 'team contact email was not persisted in sqlite');
  } finally {
    teamDb.close();
  }

  const seededZjuTasks = await request<ModerationTaskResult[]>('/moderation/tasks?status=pending', zjuAdminToken);
  const seededFduTasks = await request<ModerationTaskResult[]>('/moderation/tasks?status=pending', fduAdminToken);
  assert(seededZjuTasks.some((item) => item.id === 'local_zju_pending_post_task'), 'zju admin pending task missing');
  assert(!seededZjuTasks.some((item) => item.id === 'local_fdu_pending_post_task'), 'fdu task leaked to zju admin');
  assert(seededFduTasks.some((item) => item.id === 'local_fdu_pending_post_task'), 'fdu admin pending task missing');
  assert(!seededFduTasks.some((item) => item.id === 'local_zju_pending_post_task'), 'zju task leaked to fdu admin');
  await expectForbidden('/moderation/tasks/local_fdu_pending_post_task', zjuAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', note: 'cross-school operation must fail' }),
  });

  const temporaryPost = await request<{ id: string; moderationStatus?: string }>('/posts', zjuToken, {
    method: 'POST',
    body: JSON.stringify({
      title: `本地隔离审核测试 ${testRunId}`,
      category: '经验贴',
      content: '该临时内容用于验证学校管理员审核闭环，测试结束后自动清理。',
      tags: ['审核测试'],
    }),
  });
  temporaryPostIds.push(temporaryPost.id);
  assert(temporaryPost.moderationStatus === 'pending', 'temporary post did not enter moderation queue');
  await expectForbidden(`/posts/${temporaryPost.id}`, zjuPeerToken);

  const zjuPendingTasks = await request<ModerationTaskResult[]>('/moderation/tasks?status=pending&targetType=post', zjuAdminToken);
  const temporaryPostTask = zjuPendingTasks.find((item) => item.targetId === temporaryPost.id);
  assert(temporaryPostTask, 'zju admin cannot see temporary zju post task');
  const fduPendingTasks = await request<ModerationTaskResult[]>('/moderation/tasks?status=pending&targetType=post', fduAdminToken);
  assert(!fduPendingTasks.some((item) => item.targetId === temporaryPost.id), 'temporary zju task leaked to fdu admin');
  await expectForbidden(`/moderation/tasks/${temporaryPostTask.id}`, fduAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', note: 'cross-school operation must fail' }),
  });
  await request(`/moderation/tasks/${temporaryPostTask.id}`, zjuAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', note: 'local school isolation smoke approved' }),
  });
  const approvedPost = await request<{ id: string; moderationStatus?: string }>(`/posts/${temporaryPost.id}`, zjuPeerToken);
  assert(approvedPost.moderationStatus === 'approved', 'same-school approved post is not visible');
  await expectForbidden(`/posts/${temporaryPost.id}`, fduToken);

  const zjuReport = await request<{ reportId: string; status: string }>('/reports', zjuToken, {
    method: 'POST',
    body: JSON.stringify({ targetType: 'team', targetId: 'local_zju_team', reason: '其他', detail: '本地审核矩阵测试' }),
  });
  const fduReport = await request<{ reportId: string; status: string }>('/reports', fduToken, {
    method: 'POST',
    body: JSON.stringify({ targetType: 'team', targetId: 'local_fdu_team', reason: '其他', detail: '本地审核矩阵测试' }),
  });
  temporaryReportIds.push(zjuReport.reportId, fduReport.reportId);

  const zjuReports = await request<ReportListItem[]>('/reports', zjuAdminToken);
  const fduReports = await request<ReportListItem[]>('/reports', fduAdminToken);
  assert(zjuReports.some((item) => item.id === zjuReport.reportId), 'zju report missing from zju admin');
  assert(!zjuReports.some((item) => item.id === fduReport.reportId), 'fdu report leaked to zju admin');
  assert(fduReports.some((item) => item.id === fduReport.reportId), 'fdu report missing from fdu admin');
  assert(!fduReports.some((item) => item.id === zjuReport.reportId), 'zju report leaked to fdu admin');

  const zjuReportTasks = await request<ModerationTaskResult[]>('/moderation/tasks?status=pending&targetType=report', zjuAdminToken);
  const zjuReportTask = zjuReportTasks.find((item) => item.targetId === zjuReport.reportId);
  assert(zjuReportTask, 'zju report moderation task missing');
  await request(`/moderation/tasks/${zjuReportTask.id}`, zjuAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', note: 'local report isolation smoke resolved' }),
  });
  const resolvedReports = await request<ReportListItem[]>('/reports', zjuAdminToken);
  assert(resolvedReports.find((item) => item.id === zjuReport.reportId)?.status === 'resolved', 'zju report was not resolved');

  const schoolList = await request<{
    items: Array<{
      id: string;
      name: string;
      isOpen: boolean;
      admins: Array<{ id: string; username: string; status: string }>;
    }>;
    total: number;
  }>('/admin/schools?keyword=浙江大学&limit=10', platformAdminToken);
  const zjuSchool = schoolList.items.find((item) => item.name === '浙江大学');
  assert(zjuSchool && schoolList.total >= 1, 'platform school management cannot find zju');
  assert(zjuSchool.admins.some((item) => item.username === 'local_zju_admin'), 'zju school admin missing from management API');

  const temporaryAdmin = await request<{ id: string; username: string; status: string }>(
    `/admin/schools/${zjuSchool.id}/admins`,
    platformAdminToken,
    {
      method: 'POST',
      body: JSON.stringify({
        username: `local_temp_${testRunId}`,
        password: 'Temporary123!',
        displayName: '临时学校管理员',
      }),
    }
  );
  temporaryAdminIds.push(temporaryAdmin.id);
  assert(temporaryAdmin.status === 'active', 'temporary school admin was not created');
  const updatedTemporaryAdmin = await request<{ id: string; status: string }>(
    `/admin/school-admins/${temporaryAdmin.id}`,
    platformAdminToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ password: 'Temporary456!', status: 'disabled' }),
    }
  );
  assert(updatedTemporaryAdmin.status === 'disabled', 'temporary school admin was not disabled');

  const zjuAuditEntries = await request<Array<{ action: string; schoolName?: string; adminUserId: string }>>(
    `/admin/audit-logs?schoolId=${encodeURIComponent(zjuSchool.id)}&limit=100`,
    platformAdminToken
  );
  assert(zjuAuditEntries.some((item) => item.action === 'school_home.update' && item.schoolName === '浙江大学'), 'school-home audit entry missing');
  const platformAuditEntries = await request<Array<{ action: string; targetId?: string }>>(
    '/admin/audit-logs?action=school_admin&limit=100',
    platformAdminToken
  );
  assert(platformAuditEntries.some((item) => item.action === 'school_admin.create' && item.targetId === temporaryAdmin.id), 'school-admin create audit missing');
  assert(platformAuditEntries.some((item) => item.action === 'school_admin.update' && item.targetId === temporaryAdmin.id), 'school-admin update audit missing');

  const auditDb = new DatabaseSync(localDbPath, { readOnly: true });
  try {
    const auditCount = Number(
      (auditDb.prepare(`SELECT COUNT(*) AS count FROM admin_audit_logs WHERE user_agent = @userAgent`).get({
        userAgent: testUserAgent,
      }) as { count?: number } | undefined)?.count ?? 0
    );
    assert(auditCount >= 4, 'admin login and moderation actions were not written to audit logs');
  } finally {
    auditDb.close();
  }
} finally {
  if (zjuAdminToken) {
    await request('/admin/auth/logout', zjuAdminToken, { method: 'POST' }).catch(() => undefined);
  }
  if (fduAdminToken) {
    await request('/admin/auth/logout', fduAdminToken, { method: 'POST' }).catch(() => undefined);
  }
  if (platformAdminToken) {
    await request('/admin/auth/logout', platformAdminToken, { method: 'POST' }).catch(() => undefined);
  }
  cleanupTemporaryData(temporaryPostIds, temporaryTeamIds, temporaryReportIds, temporaryAdminIds, adminRateLimitKey, schoolHomeBackup);
}

console.log('Local core smoke passed: user/admin school matrix, team publishing, school operations, account management, moderation, reports, audit logs.');
