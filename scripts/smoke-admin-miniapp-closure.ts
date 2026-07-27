import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

type ApiResult<T> = {
  code: number;
  message: string;
  data: T;
};

type ModerationTask = {
  id: string;
  targetType: string;
  targetId: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
};

const postgresUrl = process.env.POSTGRES_URL;
const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ||
  (process.env.API_PUBLIC_ORIGIN
    ? `${process.env.API_PUBLIC_ORIGIN}${process.env.API_BASE_PATH || '/api'}`
    : `http://127.0.0.1:${process.env.API_PORT || '8080'}${process.env.API_BASE_PATH || '/api'}`);
const adminUsername = process.env.ADMIN_BOOTSTRAP_USERNAME;
const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const userAgent = 'campus-growth-smoke/20260706';
const runId = `cg_smoke_${Date.now()}_${randomBytes(3).toString('hex')}`;
const smokeSchool = {
  id: 'sch_114',
  name: '浙江大学',
};

const created = {
  userIds: [] as string[],
  membershipIds: [] as string[],
  sessionTokens: [] as string[],
  postIds: [] as string[],
  commentIds: [] as string[],
  teamIds: [] as string[],
  applicationIds: [] as string[],
  resourceIds: [] as string[],
  assetIds: [] as string[],
  reportIds: [] as string[],
  taskIds: [] as string[],
};

function token() {
  return randomBytes(24).toString('hex');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    expectedStatus?: number;
  } = {}
) {
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const text = await response.text();
  const expectedStatus = options.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    throw new Error(`HTTP ${response.status} for ${path}: ${text.slice(0, 240)}`);
  }

  if (!text) {
    return null as T;
  }

  const payload = JSON.parse(text) as ApiResult<T>;
  if (payload.code !== 0 && expectedStatus < 400) {
    throw new Error(`API ${payload.code} for ${path}: ${payload.message}`);
  }
  return payload.data;
}

async function createSmokeUser(client: Client, suffix: string) {
  const id = `${runId}_${suffix}`;
  const sessionToken = token();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await client.query(
    `
      INSERT INTO users (
        id, open_id, union_id, session_key, name, mark, school, school_id, major, grade, bio, focus_tags_json, created_at, updated_at
      ) VALUES (
        $1, $2, NULL, NULL, $3, $4, $5, $6, '计算机科学与技术', '2026级', '生产闭环测试账号，测试结束后自动清理。', $7, $8, $8
      )
    `,
    [
      id,
      `${runId}_openid_${suffix}`,
      `闭环测试${suffix}`,
      suffix === 'owner' ? '发' : '申',
      smokeSchool.name,
      smokeSchool.id,
      JSON.stringify(['竞赛', '组队']),
      now,
    ]
  );
  const membershipId = `${id}_${smokeSchool.id}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
  await client.query(
    `
      INSERT INTO user_school_memberships (
        id, user_id, school_id, school_name, role, certification_status,
        education_email, phone, email_verified, phone_verified, active, verified_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'student', 'verified',
        $5, $6, 1, 1, 1, $7, $7, $7
      )
    `,
    [
      membershipId,
      id,
      smokeSchool.id,
      smokeSchool.name,
      `${suffix}.${runId}@zju.edu.cn`,
      suffix === 'owner' ? '13900000001' : '13900000002',
      now,
    ]
  );
  await client.query(
    `INSERT INTO sessions (token, user_id, mode, expires_at, created_at) VALUES ($1, $2, 'remote', $3, $4)`,
    [sessionToken, id, expiresAt, now]
  );
  created.userIds.push(id);
  created.membershipIds.push(membershipId);
  created.sessionTokens.push(sessionToken);
  return { id, token: sessionToken };
}

async function findTask(adminToken: string, targetType: string, targetId: string, status?: string) {
  const query = new URLSearchParams({ targetType });
  if (status) {
    query.set('status', status);
  }
  const tasks = await request<ModerationTask[]>(`/moderation/tasks?${query.toString()}`, { token: adminToken });
  const task = tasks.find((item) => item.targetId === targetId);
  assert(task, `missing moderation task for ${targetType}:${targetId}`);
  if (!created.taskIds.includes(task.id)) {
    created.taskIds.push(task.id);
  }
  return task;
}

async function reviewTask(adminToken: string, task: ModerationTask, status: 'processing' | 'approved' | 'rejected') {
  await request(`/moderation/tasks/${task.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status, note: `${runId} ${status}` },
  });
}

function containsId(items: Array<{ id: string }>, id: string) {
  return items.some((item) => item.id === id);
}

async function deleteAny(client: Client, sql: string, values: string[]) {
  if (values.length === 0) {
    return;
  }
  await client.query(sql, [values]);
}

async function cleanup(client: Client) {
  await client.query('BEGIN');
  try {
    await client.query(`DELETE FROM admin_audit_logs WHERE user_agent = $1`, [userAgent]);
    await deleteAny(client, `DELETE FROM payment_events WHERE order_id = ANY($1::text[])`, []);
    await deleteAny(client, `DELETE FROM refunds WHERE order_id = ANY($1::text[])`, []);
    await deleteAny(client, `DELETE FROM resource_download_grants WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM resource_download_grants WHERE resource_id = ANY($1::text[])`, created.resourceIds);
    await deleteAny(client, `DELETE FROM owned_resources WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM favorites WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM reports WHERE id = ANY($1::text[])`, created.reportIds);
    await deleteAny(client, `DELETE FROM reports WHERE reporter_user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM moderation_tasks WHERE id = ANY($1::text[])`, created.taskIds);
    await deleteAny(
      client,
      `DELETE FROM moderation_tasks WHERE target_id = ANY($1::text[])`,
      [...created.postIds, ...created.commentIds, ...created.teamIds, ...created.resourceIds, ...created.reportIds]
    );
    await deleteAny(client, `DELETE FROM comment_likes WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM post_likes WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM comments WHERE id = ANY($1::text[])`, created.commentIds);
    await deleteAny(client, `DELETE FROM comments WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM team_applications WHERE id = ANY($1::text[])`, created.applicationIds);
    await deleteAny(client, `DELETE FROM team_applications WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM notifications WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM resource_competitions WHERE resource_id = ANY($1::text[])`, created.resourceIds);
    await deleteAny(client, `DELETE FROM resources WHERE id = ANY($1::text[])`, created.resourceIds);
    await deleteAny(client, `DELETE FROM resource_assets WHERE id = ANY($1::text[])`, created.assetIds);
    await deleteAny(client, `DELETE FROM teams WHERE id = ANY($1::text[])`, created.teamIds);
    await deleteAny(client, `DELETE FROM posts WHERE id = ANY($1::text[])`, created.postIds);
    await deleteAny(client, `DELETE FROM sessions WHERE token = ANY($1::text[])`, created.sessionTokens);
    await deleteAny(client, `DELETE FROM sessions WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM user_school_memberships WHERE id = ANY($1::text[])`, created.membershipIds);
    await deleteAny(client, `DELETE FROM user_school_memberships WHERE user_id = ANY($1::text[])`, created.userIds);
    await deleteAny(client, `DELETE FROM users WHERE id = ANY($1::text[])`, created.userIds);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  assert(postgresUrl, 'POSTGRES_URL is required');
  assert(adminUsername && adminPassword, 'ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD are required');

  const client = new Client({ connectionString: postgresUrl });
  await client.connect();

  try {
    const owner = await createSmokeUser(client, 'owner');
    const applicant = await createSmokeUser(client, 'applicant');
    const admin = await request<{ token: string }>('/admin/auth/login', {
      method: 'POST',
      body: { username: adminUsername, password: adminPassword },
    });

    const post = await request<{ id: string; moderationStatus?: string }>('/posts', {
      method: 'POST',
      token: owner.token,
      body: {
        title: `${runId} 帖子闭环`,
        category: '经验贴',
        content: '这是生产闭环 smoke 帖子，审核后才应该公开。',
        tags: ['闭环测试'],
      },
    });
    created.postIds.push(post.id);
    assert(post.moderationStatus === 'pending', 'post should be pending after submit');
    assert(!containsId(await request<Array<{ id: string }>>('/posts', { token: applicant.token }), post.id), 'pending post leaked to same-school list');
    const postTask = await findTask(admin.token, 'post', post.id, 'pending');
    await reviewTask(admin.token, postTask, 'processing');
    assert(!containsId(await request<Array<{ id: string }>>('/posts', { token: applicant.token }), post.id), 'processing post leaked to same-school list');
    await reviewTask(admin.token, postTask, 'approved');
    assert(containsId(await request<Array<{ id: string }>>('/posts', { token: applicant.token }), post.id), 'approved post missing from same-school list');

    const comment = await request<{ commentId: string; status: string }>(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: applicant.token,
      body: { content: `${runId} 评论闭环` },
    });
    created.commentIds.push(comment.commentId);
    assert(comment.status === 'pending', 'comment should be pending after submit');
    assert(!containsId(await request<Array<{ id: string }>>(`/posts/${post.id}/comments`, { token: owner.token }), comment.commentId), 'pending comment leaked');
    const commentTask = await findTask(admin.token, 'comment', comment.commentId, 'pending');
    await reviewTask(admin.token, commentTask, 'approved');
    assert(containsId(await request<Array<{ id: string }>>(`/posts/${post.id}/comments`, { token: owner.token }), comment.commentId), 'approved comment missing');

    const team = await request<{ id: string; moderationStatus?: string }>('/teams', {
      method: 'POST',
      token: owner.token,
      body: {
        title: `${runId} 组队闭环`,
        compName: '国家级白名单竞赛闭环测试',
        target: '验证组队发布、后台审核、跨校展示与邮件联系全链路。',
        missingRoles: ['前端', '资料整理'],
        deadline: '2026-12-31',
        requirements: ['每周同步一次', '能按时提交材料'],
        schoolLimit: false,
        visibilityScope: 'cross_school',
        contactHint: 'team-closure@example.com',
        contactEmail: 'team-closure@example.com',
      },
    });
    created.teamIds.push(team.id);
    assert(team.moderationStatus === 'pending', 'team should be pending after submit');
    assert(!containsId(await request<Array<{ id: string }>>('/teams', { token: applicant.token }), team.id), 'pending team leaked to same-school list');
    const teamTask = await findTask(admin.token, 'team', team.id, 'pending');
    await reviewTask(admin.token, teamTask, 'approved');
    assert(containsId(await request<Array<{ id: string }>>('/teams', { token: applicant.token }), team.id), 'approved team missing from same-school list');

    const applicantTeam = await request<{ contactEmail?: string; visibilityScope?: string }>(`/teams/${team.id}`, {
      token: applicant.token,
    });
    assert(applicantTeam.visibilityScope === 'cross_school', 'approved team visibility scope is incorrect');
    assert(applicantTeam.contactEmail === 'team-closure@example.com', 'approved team email is unavailable');
    await request(`/teams/${team.id}/applications`, {
      method: 'POST',
      token: applicant.token,
      body: { message: '我可以参与资料整理和路演准备。' },
      expectedStatus: 403,
    });

    const form = new FormData();
    form.append('file', new Blob([`smoke ${runId}`], { type: 'text/plain' }), `${runId}.txt`);
    const asset = await request<{ assetId: string }>('/uploads/resource-file', {
      method: 'POST',
      token: owner.token,
      body: form,
    });
    created.assetIds.push(asset.assetId);
    const resource = await request<{ id: string; moderationStatus?: string }>('/resources', {
      method: 'POST',
      token: owner.token,
      body: {
        title: `${runId} 资源闭环`,
        type: '模板',
        category: '竞赛资料',
        price: 0,
        description: '生产闭环 smoke 资源，审核后可领取。',
        sizeLabel: '1 KB',
        suitableFor: '竞赛准备',
        tags: ['闭环测试'],
        previewPoints: ['审核闭环', '免费领取'],
        relatedCompetitionIds: [],
        assetId: asset.assetId,
      },
    });
    created.resourceIds.push(resource.id);
    assert(resource.moderationStatus === 'pending', 'resource should be pending after submit');
    assert(!containsId(await request<Array<{ id: string }>>('/resources', { token: applicant.token }), resource.id), 'pending resource leaked to same-school list');
    const resourceTask = await findTask(admin.token, 'resource', resource.id, 'pending');
    await reviewTask(admin.token, resourceTask, 'approved');
    assert(containsId(await request<Array<{ id: string }>>('/resources', { token: applicant.token }), resource.id), 'approved resource missing from same-school list');

    await request(`/resources/${resource.id}/favorite`, {
      method: 'PATCH',
      token: applicant.token,
      body: { favorite: true },
    });
    await request(`/resources/${resource.id}/acquisitions`, {
      method: 'POST',
      token: applicant.token,
      body: { mode: 'free' },
    });
    assert(
      containsId(await request<Array<{ id: string; resourceId?: string }>>('/users/resources', { token: applicant.token }), resource.id) ||
        (await request<Array<{ resourceId: string }>>('/users/resources', { token: applicant.token })).some((item) => item.resourceId === resource.id),
      'free resource acquisition did not sync to my resources'
    );

    const report = await request<{ reportId: string; status: string }>('/reports', {
      method: 'POST',
      token: applicant.token,
      body: {
        targetType: 'post',
        targetId: post.id,
        reason: '闭环测试举报',
        detail: '生产 smoke 自动创建，稍后清理。',
      },
    });
    created.reportIds.push(report.reportId);
    const reportTask = await findTask(admin.token, 'report', report.reportId, 'pending');
    await reviewTask(admin.token, reportTask, 'processing');
    await reviewTask(admin.token, reportTask, 'approved');
    const reports = await request<Array<{ id: string; status: string }>>('/reports', { token: admin.token });
    assert(reports.find((item) => item.id === report.reportId)?.status === 'resolved', 'report did not resolve after admin approval');

    const ownerMessages = await request<Array<{ title: string }>>('/notifications', { token: owner.token });
    assert(ownerMessages.some((item) => item.title.includes('审核')), 'owner did not receive moderation notification');

    console.log(
      JSON.stringify(
        {
          ok: true,
          apiBaseUrl,
          runId,
          checked: [
            'post submit -> hidden -> processing hidden -> approved same-school visible',
            'comment submit -> hidden -> approved same-school visible',
            'team submit -> hidden -> approved same-school visible',
      'team publish -> admin approve -> email visible -> in-app application disabled',
            'resource upload -> submit -> hidden -> approved same-school visible -> favorite -> free acquire',
            'report submit -> admin process -> resolved',
            'moderation notifications',
          ],
        },
        null,
        2
      )
    );
  } finally {
    await cleanup(client);
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
