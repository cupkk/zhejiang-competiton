import { resolve } from 'node:path';

const dbPath = process.env.DB_PATH || 'server/data/campus-growth-local-preview.db';
if (process.env.DB_PROVIDER === 'postgres' || !/(local-preview|p1-preview)/i.test(dbPath)) {
  throw new Error('local_seed_requires_isolated_sqlite_db');
}

process.env.DB_PROVIDER = 'sqlite';
process.env.DB_PATH = dbPath;
process.env.STORAGE_PROVIDER = 'local';
process.env.WECHAT_LOGIN_MODE = 'mock';
process.env.PAYMENTS_ENABLED = 'false';

const [{ db }, { hashAdminPassword }, { serverConfig }] = await Promise.all([
  import('../server/db.ts'),
  import('../server/admin-security.ts'),
  import('../server/config.ts'),
]);

const now = new Date().toISOString();
const expiresAt = '2099-12-31T23:59:59.000Z';

const staleResourceAssets = db.prepare(`
  SELECT file_asset_id AS id FROM resources
  WHERE title LIKE 'P3%' OR title LIKE '平台管理员资源 %' OR title LIKE '浙江大学管理员资源 %'
`).all() as Array<{ id: string | null }>;
db.prepare(`
  DELETE FROM resources
  WHERE title LIKE 'P3%' OR title LIKE '平台管理员资源 %' OR title LIKE '浙江大学管理员资源 %'
`).run();
for (const asset of staleResourceAssets) {
  if (asset.id) db.prepare('DELETE FROM resource_assets WHERE id = @id').run({ id: asset.id });
}

function getSchool(name: string) {
  const row = db.prepare(`SELECT id, name FROM schools WHERE name = @name ORDER BY id LIMIT 1`).get({ name }) as
    | { id: string; name: string }
    | undefined;
  if (!row) throw new Error(`local_seed_school_missing:${name}`);
  return row;
}

const zju = getSchool('浙江大学');
const fdu = getSchool('复旦大学');

const schoolCompetitionFixtures = [
  { id: 'local_zju_competition', schoolId: zju.id, schoolName: zju.name, title: '浙江大学校级创新实践赛（内测）' },
  { id: 'local_fdu_competition', schoolId: fdu.id, schoolName: fdu.name, title: '复旦大学校级创新实践赛（内测）' },
];
const upsertSchoolCompetition = db.prepare(`
  INSERT INTO competitions (
    id, school_id, content_scope, title, level, category, host, target, status,
    deadline, days_left, views, difficulty, cover_label, cover_gradient, tags_json,
    description, recommended_for_json, action_hints_json, registration_start,
    registration_end, competition_start, competition_end, team_size, stages_json,
    submission_materials_json, awards, fee_description, official_contact, source_url, last_verified_at,
    edition_label, schedule_status, registration_method, tracks_json, quality_status, publish_status, created_at
  ) VALUES (
    @id, @schoolId, 'school', @title, '校级', '创新创业', @host, '本校在读学生', '报名中',
    '2099-12-31', 999, 0, '入门', '校赛', 'linear-gradient(135deg, #2563eb 0%, #0f766e 100%)', @tagsJson,
    @description, @recommendedForJson, @actionHintsJson, NULL,
    '2099-12-31', NULL, NULL, '2-5 人', @stagesJson,
    @submissionMaterialsJson, NULL, '免费', NULL, NULL, @lastVerifiedAt,
    '内测届次', 'announced', '通过内测学校报名', @tracksJson, 'verified', 'published', @createdAt
  )
  ON CONFLICT (id) DO UPDATE SET
    school_id = excluded.school_id, content_scope = 'school', title = excluded.title,
    level = excluded.level, category = excluded.category, host = excluded.host,
    target = excluded.target, status = excluded.status, deadline = excluded.deadline,
    description = excluded.description, last_verified_at = excluded.last_verified_at,
    edition_label = excluded.edition_label, schedule_status = excluded.schedule_status,
    registration_method = excluded.registration_method, tracks_json = excluded.tracks_json,
    quality_status = 'verified', publish_status = 'published'
`);
for (const item of schoolCompetitionFixtures) {
  upsertSchoolCompetition.run({
    id: item.id,
    schoolId: item.schoolId,
    title: item.title,
    host: item.schoolName,
    tagsJson: JSON.stringify(['校赛', '创新实践']),
    description: `${item.schoolName}校级创新实践赛内测内容，用于检查列表、详情、搜索和学校隔离。`,
    recommendedForJson: JSON.stringify(['本校已认证学生']),
    actionHintsJson: JSON.stringify(['查看校内通知']),
    stagesJson: JSON.stringify(['报名', '校内评审', '结果公示']),
    submissionMaterialsJson: JSON.stringify(['报名表', '项目说明', '展示材料']),
    tracksJson: JSON.stringify(['校级创新实践']),
    lastVerifiedAt: now,
    createdAt: now,
  });
}

const competition = db.prepare(`
  SELECT id, title FROM competitions
  WHERE content_scope = 'platform'
  ORDER BY views DESC, id
  LIMIT 1
`).get() as
  | { id: string; title: string }
  | undefined;

const users = [
  { id: 'local_zju_student', openId: 'local:zju:student', name: '浙大测试同学', mark: '浙', school: zju, major: '计算机科学与技术', grade: '大三' },
  { id: 'local_zju_peer', openId: 'local:zju:peer', name: '浙大回答者', mark: '答', school: zju, major: '软件工程', grade: '大二' },
  { id: 'local_fdu_student', openId: 'local:fdu:student', name: '复旦测试同学', mark: '复', school: fdu, major: '新闻传播学', grade: '大三' },
  { id: 'local_fdu_peer', openId: 'local:fdu:peer', name: '复旦回答者', mark: '答', school: fdu, major: '数据科学', grade: '大二' },
  { id: 'local_zju_unverified', openId: 'local:zju:unverified', name: '浙大未认证用户', mark: '未', school: zju, major: '待认证专业', grade: '大一' },
];

const upsertUser = db.prepare(`
  INSERT INTO users (
    id, open_id, union_id, session_key, name, mark, avatar_url, school, school_id, major, grade, bio,
    focus_tags_json, points, checkin_streak, last_checkin_date, created_at, updated_at
  ) VALUES (
    @id, @openId, NULL, NULL, @name, @mark, NULL, @schoolName, @schoolId, @major, @grade, @bio,
    @focusTagsJson, 0, 0, NULL, @createdAt, @updatedAt
  )
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name, mark = excluded.mark, school = excluded.school, school_id = excluded.school_id,
    major = excluded.major, grade = excluded.grade, bio = excluded.bio,
    focus_tags_json = excluded.focus_tags_json, updated_at = excluded.updated_at
`);
const upsertMembership = db.prepare(`
  INSERT INTO user_school_memberships (
    id, user_id, school_id, school_name, role, certification_status, education_email, phone,
    email_verified, phone_verified, active, verified_at, created_at, updated_at
  ) VALUES (
    @id, @userId, @schoolId, @schoolName, 'student', 'verified', @email, @phone,
    1, 1, 1, @verifiedAt, @createdAt, @updatedAt
  )
  ON CONFLICT (user_id, school_id) DO UPDATE SET
    certification_status = 'verified', email_verified = 1, phone_verified = 1, active = 1,
    verified_at = excluded.verified_at, updated_at = excluded.updated_at
`);

for (const [index, user] of users.entries()) {
  upsertUser.run({
    id: user.id,
    openId: user.openId,
    name: user.name,
    mark: user.mark,
    schoolName: user.school.name,
    schoolId: user.school.id,
    major: user.major,
    grade: user.grade,
    bio: '本地学校隔离与核心流程测试账号。',
    focusTagsJson: JSON.stringify(['竞赛', '组队', '经验分享']),
    createdAt: now,
    updatedAt: now,
  });
  db.prepare(`UPDATE user_school_memberships SET active = 0 WHERE user_id = @userId`).run({ userId: user.id });
  upsertMembership.run({
    id: `local_membership_${user.id}`,
    userId: user.id,
    schoolId: user.school.id,
    schoolName: user.school.name,
    email: index < 2 ? `${user.id}@zju.edu.cn` : `${user.id}@fudan.edu.cn`,
    phone: `1380000000${index + 1}`,
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

db.prepare(`
  UPDATE user_school_memberships
  SET certification_status = 'unverified', education_email = NULL, phone = NULL,
      email_verified = 0, phone_verified = 0, verified_at = NULL, updated_at = @updatedAt
  WHERE user_id = 'local_zju_unverified' AND school_id = @schoolId
`).run({ schoolId: zju.id, updatedAt: now });

const sessions = [
  ['local-zju-session-token', 'local_zju_student'],
  ['local-zju-peer-session-token', 'local_zju_peer'],
  ['local-fdu-session-token', 'local_fdu_student'],
  ['local-fdu-peer-session-token', 'local_fdu_peer'],
  ['local-zju-unverified-session-token', 'local_zju_unverified'],
];
const upsertSession = db.prepare(`
  INSERT INTO sessions (token, user_id, mode, expires_at, created_at)
  VALUES (@token, @userId, 'mock', @expiresAt, @createdAt)
  ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, mode = 'mock', expires_at = excluded.expires_at
`);
for (const [token, userId] of sessions) upsertSession.run({ token, userId, expiresAt, createdAt: now });

const postFixtures = [
  { id: 'local_zju_question_open', schoolId: zju.id, title: '本地测试：校赛材料应该从哪里开始准备？', category: '问答', authorId: 'local_zju_student', authorName: '浙大测试同学', authorMark: '浙', content: ['准备参加校内选拔，目前不确定材料清单和时间安排。'], tags: ['材料'], status: 'open', acceptedCommentId: null, comments: 0, moderationStatus: 'approved' },
  { id: 'local_zju_question_acceptance', schoolId: zju.id, title: '本地测试：组队后如何安排第一次讨论？', category: '问答', authorId: 'local_zju_student', authorName: '浙大测试同学', authorMark: '浙', content: ['队伍刚组建完成，希望了解第一次讨论需要确认哪些事项。'], tags: ['组队'], status: 'open', acceptedCommentId: null, comments: 1, moderationStatus: 'approved' },
  { id: 'local_zju_experience', schoolId: zju.id, title: '本地测试：第一次参赛的材料整理顺序', category: '经验贴', authorId: 'local_zju_peer', authorName: '浙大回答者', authorMark: '答', content: ['先整理官方通知，再建立任务清单，最后按截止时间倒排。'], tags: ['材料', '经验'], status: 'open', acceptedCommentId: null, comments: 0, moderationStatus: 'approved' },
  { id: 'local_zju_pending_post', schoolId: zju.id, title: '本地测试：浙江大学待审核经验', category: '经验贴', authorId: 'local_zju_student', authorName: '浙大测试同学', authorMark: '浙', content: ['用于验证作者可查看自己的待审内容，同校其他用户和异校用户均不可查看。'], tags: ['审核'], status: 'open', acceptedCommentId: null, comments: 0, moderationStatus: 'pending' },
  { id: 'local_fdu_question_open', schoolId: fdu.id, title: '本地测试：复旦校内组队如何确定分工？', category: '问答', authorId: 'local_fdu_student', authorName: '复旦测试同学', authorMark: '复', content: ['想了解校内队伍确认职责和协作节奏的方法。'], tags: ['组队'], status: 'open', acceptedCommentId: null, comments: 0, moderationStatus: 'approved' },
  { id: 'local_fdu_experience', schoolId: fdu.id, title: '本地测试：复旦同学的赛前准备清单', category: '经验贴', authorId: 'local_fdu_peer', authorName: '复旦回答者', authorMark: '答', content: ['按照官网通知核对资格、材料和时间节点。'], tags: ['经验'], status: 'open', acceptedCommentId: null, comments: 0, moderationStatus: 'approved' },
  { id: 'local_fdu_pending_post', schoolId: fdu.id, title: '本地测试：复旦大学待审核经验', category: '经验贴', authorId: 'local_fdu_student', authorName: '复旦测试同学', authorMark: '复', content: ['用于验证复旦大学待审内容和学校管理员范围。'], tags: ['审核'], status: 'open', acceptedCommentId: null, comments: 0, moderationStatus: 'pending' },
];

const upsertPost = db.prepare(`
  INSERT INTO posts (
    id, school_id, content_scope, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
    likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
    question_status, accepted_comment_id, moderation_status, created_at, updated_at
  ) VALUES (
    @id, @schoolId, 'school', @title, @excerpt, @contentJson, @category, @authorId, @authorName, @authorMark,
    0, @comments, @tagsJson, '刚刚', @competitionId, NULL,
    @questionStatus, @acceptedCommentId, @moderationStatus, @createdAt, @updatedAt
  )
  ON CONFLICT (id) DO UPDATE SET
    school_id = excluded.school_id, title = excluded.title, excerpt = excluded.excerpt,
    content_json = excluded.content_json, category = excluded.category, author_user_id = excluded.author_user_id,
    author_name = excluded.author_name, author_mark = excluded.author_mark, comments_count = excluded.comments_count,
    tags_json = excluded.tags_json, related_competition_id = excluded.related_competition_id,
    question_status = excluded.question_status, accepted_comment_id = excluded.accepted_comment_id,
    moderation_status = excluded.moderation_status, updated_at = excluded.updated_at
`);

db.prepare(`DELETE FROM comments WHERE post_id = 'local_zju_question_acceptance'`).run();
for (const post of postFixtures) {
  upsertPost.run({
    id: post.id,
    schoolId: post.schoolId,
    title: post.title,
    category: post.category,
    authorId: post.authorId,
    authorName: post.authorName,
    authorMark: post.authorMark,
    comments: post.comments,
    acceptedCommentId: post.acceptedCommentId,
    excerpt: post.content[0].slice(0, 72),
    contentJson: JSON.stringify(post.content),
    tagsJson: JSON.stringify(post.tags),
    questionStatus: post.status,
    moderationStatus: post.moderationStatus,
    competitionId: competition?.id || null,
    createdAt: now,
    updatedAt: now,
  });
}

const upsertPendingPostTask = db.prepare(`
  INSERT INTO moderation_tasks (id, target_type, target_id, action, status, note, created_at, reviewed_at)
  VALUES (@id, 'post', @targetId, 'post_publish_review', 'pending', @note, @createdAt, NULL)
  ON CONFLICT (id) DO UPDATE SET
    target_type = 'post', target_id = excluded.target_id, action = excluded.action,
    status = 'pending', note = excluded.note, created_at = excluded.created_at, reviewed_at = NULL
`);
for (const item of [
  { id: 'local_zju_pending_post_task', targetId: 'local_zju_pending_post', note: '浙江大学待审帖子隔离测试' },
  { id: 'local_fdu_pending_post_task', targetId: 'local_fdu_pending_post', note: '复旦大学待审帖子隔离测试' },
]) {
  upsertPendingPostTask.run({ ...item, createdAt: now });
}

db.prepare(`
  INSERT INTO comments (
    id, post_id, user_id, parent_comment_id, reply_to_comment_id, author_name, author_mark,
    content, likes_count, moderation_status, created_at, updated_at
  ) VALUES (
    'local_zju_answer', 'local_zju_question_acceptance', 'local_zju_peer', NULL, NULL,
    '浙大回答者', '答', '先确认目标、分工和下次交付时间，并在会后留下简短记录。', 0, 'approved', @createdAt, @updatedAt
  )
` ).run({ createdAt: now, updatedAt: now });

const teamFixtures = [
  { id: 'local_zju_team', schoolId: zju.id, authorId: 'local_zju_peer', authorName: '浙大回答者', authorMark: '答', title: '浙江大学项目招募技术同学（闭环测试）' },
  { id: 'local_fdu_team', schoolId: fdu.id, authorId: 'local_fdu_peer', authorName: '复旦回答者', authorMark: '答', title: '复旦大学项目招募策划同学（闭环测试）' },
];
const upsertTeam = db.prepare(`
  INSERT INTO teams (
    id, school_id, content_scope, listing_type, title, comp_id, comp_name, status, target, full_description, current_count, max_count,
    missing_roles_json, deadline, author_user_id, author_name, author_mark, author_grade, author_major,
    school_limit, visibility_scope, requirements_json, goal_tags_json, capabilities_json, collaboration_mode,
    weekly_commitment, contact_hint, contact_email, is_example, example_expires_at, moderation_status, created_at, updated_at
  ) VALUES (
    @id, @schoolId, 'school', 'team_recruit', @title, @compId, @compName, '招募中', @target, @fullDescription, 2, 4,
    @rolesJson, '2099-12-31', @authorId, @authorName, @authorMark, '大二', '本地测试专业',
    1, 'school', @requirementsJson, @goalsJson, @capabilitiesJson, '线上线下均可',
    '每周 3-5 小时', @contactEmail, @contactEmail, 0, NULL, 'approved', @createdAt, @updatedAt
  )
  ON CONFLICT (id) DO UPDATE SET
    school_id = excluded.school_id, title = excluded.title, target = excluded.target,
    full_description = excluded.full_description, deadline = excluded.deadline,
    school_limit = 1, visibility_scope = 'school', contact_hint = excluded.contact_hint,
    contact_email = excluded.contact_email, is_example = 0, example_expires_at = NULL,
    moderation_status = 'approved', updated_at = excluded.updated_at
`);
for (const team of teamFixtures) {
  upsertTeam.run({
    ...team,
    compId: competition?.id || null,
    compName: competition?.title || '通用竞赛',
    target: '用于验证本校组队列表、详情和联系方式披露。',
    fullDescription: '项目已完成方向确认和初步分工，现招募一名技术开发同学。加入后先共同确认任务边界，再按周同步进展；本条内容仅用于双学校隔离和审核闭环测试。',
    rolesJson: JSON.stringify(['技术开发']),
    requirementsJson: JSON.stringify(['按时同步进度']),
    goalsJson: JSON.stringify(['兴趣体验']),
    capabilitiesJson: JSON.stringify(['方案设计']),
    contactEmail: team.schoolId === zju.id ? 'zju-team@example.com' : 'fdu-team@example.com',
    createdAt: now,
    updatedAt: now,
  });
}

const resourceFixtures = [
  { id: 'local_zju_resource', schoolId: zju.id, authorId: 'local_zju_peer', authorName: '浙大回答者', authorMark: '答', schoolName: zju.name, title: '浙江大学竞赛材料清单（预览）' },
  { id: 'local_fdu_resource', schoolId: fdu.id, authorId: 'local_fdu_peer', authorName: '复旦回答者', authorMark: '答', schoolName: fdu.name, title: '复旦大学竞赛准备清单（预览）' },
];
const upsertResource = db.prepare(`
  INSERT INTO resources (
    id, school_id, content_scope, title, type, category, price, downloads, rating,
    author_name, author_mark, author_title, cover_label, cover_gradient, tags_json,
    description, size_label, suitable_for, preview_points_json, author_user_id,
    file_asset_id, source_url, moderation_status, review_note, created_at, updated_at
  ) VALUES (
    @id, @schoolId, 'school', @title, '清单', '资料包', 0, 0, 5,
    @authorName, @authorMark, @authorTitle, '清单', 'linear-gradient(135deg, #2563eb 0%, #0f766e 100%)', @tagsJson,
    @description, '内测资料', '本校参赛同学', @previewPointsJson, @authorId,
    NULL, NULL, 'approved', NULL, @createdAt, @updatedAt
  )
  ON CONFLICT (id) DO UPDATE SET
    school_id = excluded.school_id, content_scope = 'school', title = excluded.title,
    author_user_id = excluded.author_user_id, author_name = excluded.author_name,
    author_mark = excluded.author_mark, author_title = excluded.author_title,
    moderation_status = 'approved', review_note = NULL, updated_at = excluded.updated_at
`);
for (const resource of resourceFixtures) {
  upsertResource.run({
    id: resource.id,
    schoolId: resource.schoolId,
    title: resource.title,
    authorId: resource.authorId,
    authorName: resource.authorName,
    authorMark: resource.authorMark,
    authorTitle: `${resource.schoolName} · 内测资料`,
    tagsJson: JSON.stringify(['材料', '清单']),
    description: '用于检查学校资源列表、详情、收藏和搜索隔离。',
    previewPointsJson: JSON.stringify(['只对已完成本校认证的用户可见']),
    createdAt: now,
    updatedAt: now,
  });
}

db.prepare(`DELETE FROM favorites WHERE id IN ('local_unverified_school_favorite', 'local_unverified_platform_favorite')`).run();
db.prepare(`
  INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
  VALUES ('local_unverified_school_favorite', 'local_zju_unverified', 'post', 'local_zju_question_open', @createdAt)
`).run({ createdAt: now });
if (competition) {
  db.prepare(`
    INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
    VALUES ('local_unverified_platform_favorite', 'local_zju_unverified', 'competition', @competitionId, @createdAt)
  `).run({ competitionId: competition.id, createdAt: now });
}

db.prepare(`DELETE FROM notifications WHERE id IN ('local_unverified_school_notice', 'local_unverified_platform_notice')`).run();
db.prepare(`
  INSERT INTO notifications (
    id, user_id, category, title, content, time_label, unread,
    link_type, link_id, link_scene, comment_id, cta_text, created_at
  ) VALUES (
    'local_unverified_school_notice', 'local_zju_unverified', '系统', '本校内容提醒',
    '该提醒用于验证未认证用户不会读取校内消息。', '刚刚', 1,
    'post', 'local_zju_question_open', NULL, NULL, '查看帖子', @createdAt
  )
`).run({ createdAt: now });
if (competition) {
  db.prepare(`
    INSERT INTO notifications (
      id, user_id, category, title, content, time_label, unread,
      link_type, link_id, link_scene, comment_id, cta_text, created_at
    ) VALUES (
      'local_unverified_platform_notice', 'local_zju_unverified', '系统', '平台竞赛提醒',
      '该提醒用于验证未认证用户仍能读取平台公共消息。', '刚刚', 1,
      'competition', @competitionId, NULL, NULL, '查看竞赛', @createdAt
    )
  `).run({ competitionId: competition.id, createdAt: now });
}

const upsertAdmin = db.prepare(`
  INSERT INTO admin_users (
    id, username, password_hash, display_name, role, permissions_json,
    school_id, school_name, status, created_at, updated_at
  ) VALUES (
    @id, @username, @passwordHash, @displayName, 'school_admin', @permissionsJson,
    @schoolId, @schoolName, 'active', @createdAt, @updatedAt
  )
  ON CONFLICT (username) DO UPDATE SET
    password_hash = excluded.password_hash, display_name = excluded.display_name,
    role = 'school_admin', permissions_json = excluded.permissions_json,
    school_id = excluded.school_id, school_name = excluded.school_name, status = 'active', updated_at = excluded.updated_at
`);
for (const school of [zju, fdu]) {
  upsertAdmin.run({
    id: `local_admin_${school.id}`,
    username: school.id === zju.id ? 'local_zju_admin' : 'local_fdu_admin',
    passwordHash: hashAdminPassword('LocalTest123!'),
    displayName: `${school.name}本地管理员`,
    permissionsJson: JSON.stringify(serverConfig.adminPermissions.school_admin),
    schoolId: school.id,
    schoolName: school.name,
    createdAt: now,
    updatedAt: now,
  });
}

db.prepare(`
  INSERT INTO admin_users (
    id, username, password_hash, display_name, role, permissions_json,
    school_id, school_name, status, created_at, updated_at
  ) VALUES (
    'local_platform_admin', 'local_platform_admin', @passwordHash, '本地平台管理员',
    'super_admin', @permissionsJson, NULL, NULL, 'active', @createdAt, @updatedAt
  )
  ON CONFLICT (username) DO UPDATE SET
    password_hash = excluded.password_hash, display_name = excluded.display_name,
    role = 'super_admin', permissions_json = excluded.permissions_json,
    school_id = NULL, school_name = NULL, status = 'active', updated_at = excluded.updated_at
`).run({
  passwordHash: hashAdminPassword('LocalPlatform123!'),
  permissionsJson: JSON.stringify(serverConfig.adminPermissions.super_admin),
  createdAt: now,
  updatedAt: now,
});

const upsertSchoolHomeConfig = db.prepare(`
  INSERT INTO school_home_configs (
    school_id, announcement, team_ids_json, post_ids_json, updated_by_admin_id, updated_at
  ) VALUES (
    @schoolId, @announcement, @teamIdsJson, @postIdsJson, @adminId, @updatedAt
  )
  ON CONFLICT (school_id) DO UPDATE SET
    announcement = excluded.announcement,
    team_ids_json = excluded.team_ids_json,
    post_ids_json = excluded.post_ids_json,
    updated_by_admin_id = excluded.updated_by_admin_id,
    updated_at = excluded.updated_at
`);
upsertSchoolHomeConfig.run({
  schoolId: zju.id,
  announcement: '浙江大学校内内容仅对完成学校认证的同学开放。',
  teamIdsJson: JSON.stringify([`example_team_${zju.id}_innovation-design`, `example_team_${zju.id}_mcm-code-writing`]),
  postIdsJson: JSON.stringify(['local_zju_experience']),
  adminId: `local_admin_${zju.id}`,
  updatedAt: now,
});
upsertSchoolHomeConfig.run({
  schoolId: fdu.id,
  announcement: '复旦大学校内内容仅对完成学校认证的同学开放。',
  teamIdsJson: JSON.stringify([`example_team_${fdu.id}_innovation-design`, `example_team_${fdu.id}_mcm-code-writing`]),
  postIdsJson: JSON.stringify(['local_fdu_experience']),
  adminId: `local_admin_${fdu.id}`,
  updatedAt: now,
});

console.log(`Local preview data ready: ${resolve(dbPath)}`);
console.log('Student fixtures: 浙江大学 / 复旦大学; admins: local_platform_admin / local_zju_admin / local_fdu_admin');
