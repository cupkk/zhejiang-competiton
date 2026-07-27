import { createHash } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api';
const localDbPath = resolve('server/data/campus-growth-local-preview.db');
const testRunId = Date.now().toString(36);
const testUserAgent = `campus-growth-admin-content-security/${testRunId}`;
const zjuToken = 'local-zju-session-token';
const fduToken = 'local-fdu-session-token';
const unverifiedToken = 'local-zju-unverified-session-token';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function rawRequest(path: string, token?: string, init: RequestInit = {}) {
  const hasJsonBody = Boolean(init.body) && !(init.body instanceof FormData);
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'User-Agent': testUserAgent,
      'X-Forwarded-For': '203.0.113.41',
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function request<T>(path: string, token?: string, init: RequestInit = {}) {
  const response = await rawRequest(path, token, init);
  const payload = await response.json() as { code: number; message: string; data: T };
  if (!response.ok || payload.code !== 0) throw new Error(`${path}: ${response.status} ${payload.message}`);
  return payload.data;
}

async function expectStatus(path: string, status: number, token?: string, init: RequestInit = {}) {
  const response = await rawRequest(path, token, init);
  const payload = await response.json() as { code: number; message: string };
  assert(response.status === status, `${path}: expected ${status}, received ${response.status} ${payload.message}`);
  return response;
}

function resourceForm(title: string, file: File) {
  const form = new FormData();
  form.set('title', title);
  form.set('category', '竞赛工具');
  form.set('description', '本地自动化测试资源，验证管理员发布范围和文件校验。');
  form.set('suitableFor', '本地测试用户');
  form.set('tags', JSON.stringify(['自动化测试']));
  form.set('previewPoints', JSON.stringify(['验证真实文件发布']));
  form.set('relatedCompetitionIds', JSON.stringify([]));
  form.set('schoolId', 'attempted-scope-spoof');
  form.set('file', file);
  return form;
}

function cleanup(competitionIds: string[], resourceIds: string[], rateLimitKeys: string[]) {
  if (!/campus-growth-local-preview\.db$/i.test(localDbPath)) {
    throw new Error(`refusing cleanup outside local preview database: ${localDbPath}`);
  }

  const db = new DatabaseSync(localDbPath);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    for (const resourceId of resourceIds) {
      const asset = db.prepare(
        `SELECT a.id, a.local_path FROM resource_assets a JOIN resources r ON r.file_asset_id = a.id WHERE r.id = @resourceId`
      ).get({ resourceId }) as { id: string; local_path?: string | null } | undefined;
      db.prepare('DELETE FROM resource_competitions WHERE resource_id = @resourceId').run({ resourceId });
      db.prepare('DELETE FROM favorites WHERE target_type = \'resource\' AND target_id = @resourceId').run({ resourceId });
      db.prepare('DELETE FROM resources WHERE id = @resourceId').run({ resourceId });
      if (asset) {
        db.prepare('DELETE FROM resource_assets WHERE id = @id').run({ id: asset.id });
        if (asset.local_path && existsSync(asset.local_path)) unlinkSync(asset.local_path);
      }
    }
    for (const competitionId of competitionIds) {
      db.prepare('DELETE FROM resource_competitions WHERE competition_id = @competitionId').run({ competitionId });
      db.prepare('DELETE FROM competition_view_events WHERE competition_id = @competitionId').run({ competitionId });
      db.prepare('DELETE FROM favorites WHERE target_type = \'competition\' AND target_id = @competitionId').run({ competitionId });
      db.prepare('DELETE FROM competitions WHERE id = @competitionId').run({ competitionId });
    }
    db.prepare('DELETE FROM admin_audit_logs WHERE user_agent = @userAgent').run({ userAgent: testUserAgent });
    for (const rateLimitKey of rateLimitKeys) {
      db.prepare('DELETE FROM rate_limit_buckets WHERE bucket_key = @rateLimitKey').run({ rateLimitKey });
    }
  } finally {
    db.close();
  }
}

type AdminSession = {
  token: string;
  admin: { id: string; role: string; schoolId?: string; permissions: string[] };
};

type AdminCompetition = {
  id: string;
  title: string;
  publishStatus: 'draft' | 'published' | 'archived';
};

type PublishedResource = {
  id: string;
  title: string;
  schoolId?: string;
  contentScope: 'platform' | 'school';
  fileAssetId: string;
};

const competitionIds: string[] = [];
const resourceIds: string[] = [];
let platformAdminToken = '';
let zjuAdminToken = '';
const rateLimitIp = '203.0.113.99';
const rateLimitKey = createHash('sha256').update(`auth:admin-login:${rateLimitIp}`).digest('hex');
const requestRateLimitKey = createHash('sha256').update('auth:admin-login:203.0.113.41').digest('hex');

try {
  const healthResponse = await rawRequest('/health');
  assert(!healthResponse.headers.has('x-powered-by'), 'Express implementation header is exposed');

  const platformAdmin = await request<AdminSession>('/admin/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username: 'local_platform_admin', password: 'LocalPlatform123!' }),
  });
  platformAdminToken = platformAdmin.token;
  const zjuAdmin = await request<AdminSession>('/admin/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username: 'local_zju_admin', password: 'LocalTest123!' }),
  });
  zjuAdminToken = zjuAdmin.token;
  assert(zjuAdmin.admin.role === 'school_admin' && zjuAdmin.admin.schoolId, 'zju school admin scope missing');

  await expectStatus('/admin/competitions', 403, zjuAdminToken);
  await expectStatus('/admin/competitions', 403, zjuAdminToken, {
    method: 'POST',
    body: JSON.stringify({ title: '越权竞赛', host: '测试', target: '测试', description: '必须被拒绝' }),
  });

  const title = `自动化竞赛目录 ${testRunId}`;
  const baseCompetitionPayload = {
    title,
    level: '国家级',
    category: '创新创业',
    host: '本地自动化测试主办方',
    target: '普通高等学校在校生',
    status: '报名中',
    deadline: '2026-12-31',
    difficulty: '中',
    description: '用于验证竞赛人工目录的草稿、发布和归档闭环。',
    teamSize: '3-5 人团队参赛',
    stages: ['校内准备', '正式报名', '结果公示'],
    submissionMaterials: ['报名表', '项目说明', '诚信承诺书'],
    tags: ['自动化测试'],
    recommendedFor: ['准备参赛的学生'],
    actionHints: ['发布前人工核验'],
    sourceUrl: 'https://www.gov.cn/',
    lastVerifiedAt: '2026-07-25',
    editionLabel: '2026 届自动化测试',
    scheduleStatus: 'announced',
    registrationMethod: '由学校管理员统一提交报名材料。',
    tracks: ['综合测试赛道'],
    qualityStatus: 'verified',
  };
  const draft = await request<AdminCompetition>('/admin/competitions', platformAdminToken, {
    method: 'POST',
    body: JSON.stringify({ ...baseCompetitionPayload, publishStatus: 'draft' }),
  });
  competitionIds.push(draft.id);
  assert(draft.publishStatus === 'draft', 'competition draft status was not saved');
  const draftPublicList = await request<Array<{ id: string }>>(`/competitions?keyword=${encodeURIComponent(title)}`);
  assert(!draftPublicList.some((item) => item.id === draft.id), 'draft competition leaked into public list');
  await expectStatus(`/competitions/${draft.id}`, 404);
  await expectStatus(`/competitions/${draft.id}/resources`, 404);
  await expectStatus(`/competitions/${draft.id}/teams`, 404);

  const published = await request<AdminCompetition>(`/admin/competitions/${draft.id}`, platformAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ ...baseCompetitionPayload, publishStatus: 'published' }),
  });
  assert(published.publishStatus === 'published', 'competition was not published');
  const publishedList = await request<Array<{ id: string }>>(`/competitions?keyword=${encodeURIComponent(title)}`);
  assert(publishedList.some((item) => item.id === draft.id), 'published competition missing from public list');
  await request(`/competitions/${draft.id}`);
  await request(`/competitions/${draft.id}/resources`);
  await request(`/competitions/${draft.id}/teams`);

  const archived = await request<AdminCompetition>(`/admin/competitions/${draft.id}`, platformAdminToken, {
    method: 'PATCH',
    body: JSON.stringify({ ...baseCompetitionPayload, publishStatus: 'archived' }),
  });
  assert(archived.publishStatus === 'archived', 'competition was not archived');
  const archivedList = await request<Array<{ id: string }>>(`/competitions?keyword=${encodeURIComponent(title)}`);
  assert(!archivedList.some((item) => item.id === draft.id), 'archived competition leaked into public list');
  await expectStatus(`/competitions/${draft.id}`, 404);
  await expectStatus(`/competitions/${draft.id}/resources`, 404);
  await expectStatus(`/competitions/${draft.id}/teams`, 404);

  const markdownFile = new File(['# 本地自动化测试\n\n该文件用于验证管理员真实文件发布。'], 'admin-smoke.md', {
    type: 'text/markdown',
  });
  const platformResource = await request<PublishedResource>('/admin/resources/publish', platformAdminToken, {
    method: 'POST',
    body: resourceForm(`平台管理员资源 ${testRunId}`, markdownFile),
  });
  resourceIds.push(platformResource.id);
  assert(platformResource.contentScope === 'platform' && !platformResource.schoolId, 'platform resource scope was spoofed');
  await request(`/resources/${platformResource.id}`, unverifiedToken);

  const schoolResource = await request<PublishedResource>('/admin/resources/publish', zjuAdminToken, {
    method: 'POST',
    body: resourceForm(`浙江大学管理员资源 ${testRunId}`, markdownFile),
  });
  resourceIds.push(schoolResource.id);
  assert(
    schoolResource.contentScope === 'school' && schoolResource.schoolId === zjuAdmin.admin.schoolId,
    'school resource escaped the authenticated admin school scope'
  );
  await request(`/resources/${schoolResource.id}`, zjuToken);
  await expectStatus(`/resources/${schoolResource.id}`, 403, fduToken);
  await expectStatus(`/resources/${schoolResource.id}`, 403, unverifiedToken);

  const fakePdf = new File(['# This is Markdown, not PDF'], 'fake.pdf', { type: 'application/pdf' });
  await expectStatus('/admin/resources/publish', 415, platformAdminToken, {
    method: 'POST',
    body: resourceForm(`伪装 PDF ${testRunId}`, fakePdf),
  });

  for (let attempt = 1; attempt <= 11; attempt += 1) {
    const response = await rawRequest('/admin/auth/login', undefined, {
      method: 'POST',
      headers: { 'X-Forwarded-For': rateLimitIp },
      body: JSON.stringify({ username: `missing_${testRunId}`, password: 'wrong-password' }),
    });
    const expected = attempt <= 10 ? 401 : 429;
    assert(response.status === expected, `admin rate limit attempt ${attempt}: expected ${expected}, received ${response.status}`);
    if (attempt === 11) assert(response.headers.has('retry-after'), 'rate-limited response lacks Retry-After');
  }
  const rateDb = new DatabaseSync(localDbPath, { readOnly: true });
  try {
    const bucket = rateDb.prepare('SELECT bucket_key, count FROM rate_limit_buckets WHERE bucket_key = @rateLimitKey').get({ rateLimitKey }) as
      | { bucket_key: string; count: number }
      | undefined;
    assert(bucket?.count === 11, 'persistent rate-limit bucket was not written to sqlite');
    assert(bucket.bucket_key.length === 64 && !bucket.bucket_key.includes(rateLimitIp), 'rate-limit bucket stored plaintext identity');
  } finally {
    rateDb.close();
  }

  const auditEntries = await request<Array<{ action: string; targetId?: string }>>(
    `/admin/audit-logs?limit=100`,
    platformAdminToken
  );
  assert(auditEntries.some((item) => item.action === 'competition.create' && item.targetId === draft.id), 'competition create audit missing');
  assert(auditEntries.some((item) => item.action === 'competition.update' && item.targetId === draft.id), 'competition update audit missing');
  assert(auditEntries.some((item) => item.action === 'resource.publish' && item.targetId === platformResource.id), 'resource publish audit missing');
} finally {
  if (platformAdminToken) await request('/admin/auth/logout', platformAdminToken, { method: 'POST' }).catch(() => undefined);
  if (zjuAdminToken) await request('/admin/auth/logout', zjuAdminToken, { method: 'POST' }).catch(() => undefined);
  cleanup(competitionIds, resourceIds, [rateLimitKey, requestRateLimitKey]);
}

console.log('Admin content/security smoke passed: publish lifecycle, scope isolation, upload magic, audit, headers, and persistent rate limit.');
