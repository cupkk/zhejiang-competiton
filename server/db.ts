import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MessageChannel, MessagePort, Worker, receiveMessageOnPort } from 'node:worker_threads';
import * as seedModule from '../frontend/src/data/mock.ts';
import { hashAdminPassword } from './admin-security.ts';
import { serverConfig } from './config.ts';

type FrontendSeedModule = typeof import('../frontend/src/data/mock');

const seedData = (seedModule as FrontendSeedModule & { default?: FrontendSeedModule }).default ?? seedModule;

type SqlValue = string | number | bigint | Uint8Array | null;

interface SchoolSeedItem {
  id: string;
  sourceId: string;
  code: string;
  name: string;
  shortName: string;
  province: string;
  city: string;
  logoUrl: string;
  isHot: boolean;
  sortOrder: number;
}

interface SchoolSeedPayload {
  schools: SchoolSeedItem[];
}

interface PreparedStatementAdapter {
  get(params?: Record<string, SqlValue>): unknown;
  all(params?: Record<string, SqlValue>): unknown[];
  run(params?: Record<string, SqlValue>): { changes?: number };
}

interface DatabaseAdapter {
  prepare(sql: string): PreparedStatementAdapter;
  exec(sql: string): void;
}

interface PostgresWorkerResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

class SqliteDatabaseAdapter implements DatabaseAdapter {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string): PreparedStatementAdapter {
    const statement = this.database.prepare(sql);
    return {
      get: (params = {}) => statement.get(params),
      all: (params = {}) => statement.all(params),
      run: (params = {}) => {
        const result = statement.run(params);
        return {
          changes: Number(result.changes || 0),
        };
      },
    };
  }

  exec(sql: string) {
    this.database.exec(sql);
  }
}

class PostgresDatabaseAdapter implements DatabaseAdapter {
  private readonly worker: Worker;
  private readonly requestPort: MessagePort;
  private readonly waitBuffer = new Int32Array(new SharedArrayBuffer(4));

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new Error('postgres_url_missing');
    }

    this.worker = new Worker(new URL('./postgres-sync-worker.ts', import.meta.url), {
      execArgv: ['--import=tsx'],
      workerData: {
        postgresUrl: connectionString,
      },
    });
    const channel = new MessageChannel();
    this.requestPort = channel.port1;
    this.requestPort.start();
    this.worker.postMessage(channel.port2, [channel.port2]);
  }

  private request<T>(payload: Record<string, unknown>) {
    const id = `pg_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    this.requestPort.postMessage({ ...payload, id });
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const packet = receiveMessageOnPort(this.requestPort) as { message: PostgresWorkerResponse } | undefined;
      if (packet?.message?.id === id) {
        if (!packet.message.ok) {
          throw new Error(packet.message.error || 'postgres_query_failed');
        }
        return packet.message.result as T;
      }

      Atomics.wait(this.waitBuffer, 0, 0, 10);
    }

    throw new Error('postgres_query_timeout');
  }

  prepare(sql: string): PreparedStatementAdapter {
    return {
      get: (params = {}) => this.request({ type: 'get', sql, params }),
      all: (params = {}) => this.request({ type: 'all', sql, params }),
      run: (params = {}) => this.request<{ changes?: number }>({ type: 'run', sql, params }),
    };
  }

  exec(sql: string) {
    this.request({ type: 'exec', sql });
  }
}

function createDatabaseAdapter(): DatabaseAdapter {
  if (serverConfig.databaseProvider === 'postgres') {
    return new PostgresDatabaseAdapter(serverConfig.postgresUrl);
  }

  mkdirSync(dirname(serverConfig.dbPath), { recursive: true });
  const database = new DatabaseSync(serverConfig.dbPath);
  database.exec('PRAGMA foreign_keys = ON;');
  return new SqliteDatabaseAdapter(database);
}

export const db = createDatabaseAdapter();

function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

function tableHasData(tableName: string) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number | string };
  return Number(row.count || 0) > 0;
}

function tableHasColumn(tableName: string, columnName: string) {
  if (serverConfig.databaseProvider === 'postgres') {
    const row = db
      .prepare(
        `
          SELECT 1 AS found
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = @tableName AND column_name = @columnName
          LIMIT 1
        `
      )
      .get({ tableName, columnName }) as { found: number } | null;
    return Boolean(row?.found);
  }

  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function ensureBootstrapAdminUser() {
  const now = new Date().toISOString();
  const existing = db
    .prepare(`SELECT id FROM admin_users WHERE username = @username`)
    .get({ username: serverConfig.adminBootstrap.username }) as { id: string } | undefined;

  if (!existing) {
    db.prepare(
      `
        INSERT INTO admin_users (
          id, username, password_hash, display_name, role, permissions_json, school_id, school_name, status, created_at, updated_at
        ) VALUES (
          @id, @username, @passwordHash, @displayName, 'super_admin', @permissionsJson, NULL, NULL, 'active', @createdAt, @updatedAt
        )
      `
    ).run({
      id: `adm_${Math.random().toString(16).slice(2, 10)}`,
      username: serverConfig.adminBootstrap.username,
      passwordHash: hashAdminPassword(serverConfig.adminBootstrap.password),
      displayName: serverConfig.adminBootstrap.displayName,
      permissionsJson: JSON.stringify(serverConfig.adminPermissions.super_admin),
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  db.prepare(
    `
      UPDATE admin_users
      SET display_name = @displayName,
          password_hash = @passwordHash,
          role = 'super_admin',
          permissions_json = @permissionsJson,
          school_id = NULL,
          school_name = NULL,
          updated_at = @updatedAt
      WHERE username = @username
    `
  ).run({
    username: serverConfig.adminBootstrap.username,
    displayName: serverConfig.adminBootstrap.displayName,
    passwordHash: hashAdminPassword(serverConfig.adminBootstrap.password),
    permissionsJson: JSON.stringify(serverConfig.adminPermissions.super_admin),
    updatedAt: now,
  });
}

function ensureColumn(tableName: string, columnDefinition: string) {
  const columnName = columnDefinition.trim().split(/\s+/, 1)[0];
  if (serverConfig.databaseProvider === 'postgres') {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnDefinition}`);
    return;
  }

  if (tableHasColumn(tableName, columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
}

function readSchoolSeedPayload(): SchoolSeedPayload {
  const seedPath = resolve(process.cwd(), 'server/schools-seed.json');
  return JSON.parse(readFileSync(seedPath, 'utf8')) as SchoolSeedPayload;
}

function seedSchools() {
  const payload = readSchoolSeedPayload();
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO schools (
      id, source_id, code, name, short_name, province, city, logo_url, is_open, is_hot, sort_order, created_at, updated_at
    ) VALUES (
      @id, @sourceId, @code, @name, @shortName, @province, @city, @logoUrl, 1, @isHot, @sortOrder, @createdAt, @updatedAt
    )
    ON CONFLICT (id) DO UPDATE SET
      source_id = excluded.source_id,
      code = excluded.code,
      name = excluded.name,
      short_name = excluded.short_name,
      province = excluded.province,
      city = excluded.city,
      logo_url = excluded.logo_url,
      is_open = excluded.is_open,
      is_hot = excluded.is_hot,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);

  for (const item of payload.schools) {
    insert.run({
      id: item.id,
      sourceId: item.sourceId || '',
      code: item.code || '',
      name: item.name,
      shortName: item.shortName,
      province: item.province || '',
      city: item.city || '',
      logoUrl: item.logoUrl || '',
      isHot: item.isHot ? 1 : 0,
      sortOrder: item.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function getSchoolIdByName(name: string | null | undefined) {
  const value = name?.trim();
  if (!value || value.startsWith('待补充')) {
    return null;
  }

  return (
    db
      .prepare(
        `
          SELECT id
          FROM schools
          WHERE name = @name
          ORDER BY is_hot DESC,
                   CASE WHEN id LIKE 'sch_%' THEN 0 ELSE 1 END,
                   sort_order ASC,
                   id ASC
          LIMIT 1
        `
      )
      .get({ name: value }) as { id: string } | undefined
  )?.id ?? null;
}

function ensureUserSchoolMemberships() {
  const now = new Date().toISOString();
  const users = db.prepare(`SELECT id, school FROM users`).all() as Array<{ id: string; school: string }>;
  const insert = db.prepare(`
    INSERT INTO user_school_memberships (
      id, user_id, school_id, school_name, role, certification_status,
      education_email, phone, email_verified, phone_verified, active, verified_at, created_at, updated_at
    ) VALUES (
      @id, @userId, @schoolId, @schoolName, 'student', 'unverified',
      NULL, NULL, 0, 0, 1, NULL, @createdAt, @updatedAt
    )
    ON CONFLICT (user_id, school_id) DO UPDATE SET
      school_name = excluded.school_name,
      active = 1,
      updated_at = excluded.updated_at
  `);

  for (const user of users) {
    const schoolId = getSchoolIdByName(user.school);
    if (!schoolId) {
      continue;
    }

    db.prepare(`UPDATE user_school_memberships SET active = 0 WHERE user_id = @userId`).run({ userId: user.id });
    insert.run({
      id: `usm_${user.id}_${schoolId}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48),
      userId: user.id,
      schoolId,
      schoolName: user.school,
      createdAt: now,
      updatedAt: now,
    });
    db.prepare(`UPDATE users SET school_id = @schoolId WHERE id = @userId`).run({ schoolId, userId: user.id });
  }
}

function backfillContentSchoolIds() {
  db.prepare(
    `
      UPDATE resources
      SET school_id = (
        SELECT usm.school_id
        FROM user_school_memberships usm
        WHERE usm.user_id = resources.author_user_id AND usm.active = 1
        LIMIT 1
      )
      WHERE author_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM user_school_memberships usm
          WHERE usm.user_id = resources.author_user_id AND usm.active = 1
        )
    `
  ).run();

  db.prepare(
    `
      UPDATE teams
      SET school_id = (
        SELECT usm.school_id
        FROM user_school_memberships usm
        WHERE usm.user_id = teams.author_user_id AND usm.active = 1
        LIMIT 1
      )
      WHERE author_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM user_school_memberships usm
          WHERE usm.user_id = teams.author_user_id AND usm.active = 1
        )
    `
  ).run();

  db.prepare(
    `
      UPDATE posts
      SET school_id = (
        SELECT usm.school_id
        FROM user_school_memberships usm
        WHERE usm.user_id = posts.author_user_id AND usm.active = 1
        LIMIT 1
      )
      WHERE author_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM user_school_memberships usm
          WHERE usm.user_id = posts.author_user_id AND usm.active = 1
        )
    `
  ).run();
}

const normalizedCompetitionCategories = new Set([
  '创新创业',
  '数学建模',
  '编程算法',
  '商科案例',
  '电子硬件',
  '设计艺术',
  '学术科研',
  '语言外语',
]);

function normalizeCompetitionCategory(title: string, currentCategory: string, tagsJson: string) {
  const text = `${title} ${tagsJson}`;
  if (/创新|创业|挑战杯|互联网\+/.test(text)) return '创新创业';
  if (/数学|建模|力学/.test(text)) return '数学建模';
  if (/英语|外语|翻译|语言/.test(text)) return '语言外语';
  if (/市场|商业|商科|电商|电子商务|物流|服务外包|财税|企业经营|沙盘/.test(text)) return '商科案例';
  if (/电子|通信|芯片|机器人|机械|智能车|工程|光电|嵌入式|物联网/.test(text)) return '电子硬件';
  if (/程序|软件|计算机|信息安全|算法|网络/.test(text)) return '编程算法';
  if (/设计|广告|艺术|成图/.test(text)) return '设计艺术';
  if (normalizedCompetitionCategories.has(currentCategory)) return currentCategory;
  return '学术科研';
}

function migrateCompetitionStructure() {
  const rows = db
    .prepare(
      `
        SELECT id, title, category, tags_json, status, deadline, days_left, action_hints_json,
               registration_end, team_size, stages_json, awards, fee_description,
               source_url, last_verified_at, schedule_status, quality_status, created_at
        FROM competitions
      `
    )
    .all() as Array<{
      id: string;
      title: string;
      category: string;
      tags_json: string;
      status: string;
      deadline: string;
      days_left: number;
      action_hints_json: string;
      registration_end: string | null;
      team_size: string | null;
      stages_json: string | null;
      awards: string | null;
      fee_description: string | null;
      source_url: string | null;
      last_verified_at: string | null;
      schedule_status: string;
      quality_status: string;
      created_at: string | null;
    }>;

  const now = new Date().toISOString();
  const update = db.prepare(
    `
      UPDATE competitions
      SET category = @category,
          status = CASE WHEN @preserveVerified = 1 THEN status ELSE @status END,
          days_left = @daysLeft,
          registration_end = COALESCE(registration_end, @registrationEnd),
          team_size = CASE WHEN @preserveVerified = 1 THEN team_size ELSE COALESCE(team_size, @teamSize) END,
          stages_json = CASE WHEN stages_json IS NULL OR stages_json = '[]' THEN @stagesJson ELSE stages_json END,
          awards = CASE WHEN @preserveVerified = 1 THEN awards ELSE COALESCE(awards, @awards) END,
          fee_description = CASE WHEN @preserveVerified = 1 THEN fee_description ELSE COALESCE(fee_description, @feeDescription) END,
          source_url = COALESCE(source_url, @sourceUrl),
          last_verified_at = COALESCE(last_verified_at, @lastVerifiedAt),
          created_at = COALESCE(created_at, @createdAt)
      WHERE id = @id
    `
  );
  const insertNotice = db.prepare(
    `
      INSERT INTO competition_notices (
        id, competition_id, title, published_at, source_url, file_type, storage_url, created_at
      ) VALUES (
        @id, @competitionId, @title, NULL, @sourceUrl, '网页', NULL, @createdAt
      )
      ON CONFLICT (id) DO NOTHING
    `
  );

  for (const row of rows) {
    let actionHints: string[] = [];
    try {
      actionHints = JSON.parse(row.action_hints_json || '[]') as string[];
    } catch {
      actionHints = [];
    }
    const isChallengeCup = /挑战杯/.test(row.title);
    const sourceUrl =
      row.source_url ||
      actionHints.find((item) => /^官网[：:]/.test(item))?.replace(/^官网[：:]\s*/, '').trim() ||
      (isChallengeCup ? 'https://www.tiaozhanbei.net/' : '');
    const stagesJson = row.stages_json && row.stages_json !== '[]'
      ? row.stages_json
      : JSON.stringify(isChallengeCup ? ['校级遴选', '省级竞赛', '全国决赛'] : []);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
    const hasExactDeadline = /^\d{4}-\d{2}-\d{2}$/.test(row.deadline);
    const daysLeft = hasExactDeadline
      ? Math.ceil((Date.parse(`${row.deadline}T00:00:00+08:00`) - Date.parse(`${today}T00:00:00+08:00`)) / 86_400_000)
      : row.days_left;
    const status = !hasExactDeadline
      ? row.status
      : daysLeft < 0
        ? '已截止'
        : daysLeft <= 7
          ? '即将截止'
          : row.status === '报名未开始'
            ? row.status
            : '报名中';

    update.run({
      id: row.id,
      preserveVerified: row.quality_status === 'verified' ? 1 : 0,
      category: normalizeCompetitionCategory(row.title, row.category, row.tags_json),
      status,
      daysLeft,
      registrationEnd: row.deadline,
      teamSize: row.team_size || (isChallengeCup ? '以当届赛事通知和校内选拔要求为准' : null),
      stagesJson,
      awards: row.awards || (isChallengeCup ? '按当届通知设置金、银、铜奖等' : null),
      feeDescription: '以官方通知为准',
      sourceUrl: sourceUrl || null,
      lastVerifiedAt: row.last_verified_at || (isChallengeCup ? '2026-07-22' : null),
      createdAt: now,
    });

    if (sourceUrl) {
      insertNotice.run({
        id: `notice_${row.id}_official`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
        competitionId: row.id,
        title: '赛事官网与通知入口',
        sourceUrl,
        createdAt: now,
      });
    }
  }
}

function seedUsers() {
  const user = seedData.userProfile;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (
      id, open_id, union_id, session_key, name, mark, avatar_url, school, major, grade, bio, focus_tags_json, created_at, updated_at
    ) VALUES (
      @id, @openId, NULL, NULL, @name, @mark, NULL, @school, @major, @grade, @bio, @focusTagsJson, @createdAt, @updatedAt
    )
  `).run({
    id: user.id,
    openId: 'mock:u1',
    name: user.name,
    mark: user.mark,
    school: user.school,
    major: user.major,
    grade: user.grade,
    bio: user.bio,
    focusTagsJson: serializeJson(user.focusTags),
    createdAt,
    updatedAt: createdAt,
  });
}

function seedCompetitions() {
  const insert = db.prepare(`
    INSERT INTO competitions (
      id, title, level, category, host, target, status, deadline, days_left, views, difficulty,
      cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json
    ) VALUES (
      @id, @title, @level, @category, @host, @target, @status, @deadline, @daysLeft, @views, @difficulty,
      @coverLabel, @coverGradient, @tagsJson, @description, @recommendedForJson, @actionHintsJson
    )
  `);

  for (const item of seedData.competitions) {
    insert.run({
      id: item.id,
      title: item.title,
      level: item.level,
      category: item.category,
      host: item.host,
      target: item.target,
      status: item.status,
      deadline: item.deadline,
      daysLeft: item.daysLeft,
      views: item.views,
      difficulty: item.difficulty,
      coverLabel: item.coverLabel,
      coverGradient: item.coverGradient,
      tagsJson: serializeJson(item.tags),
      description: item.description,
      recommendedForJson: serializeJson(item.recommendedFor),
      actionHintsJson: serializeJson(item.actionHints),
    });
  }
}

function seedResources() {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO resources (
      id, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
      cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json,
      author_user_id, file_asset_id, moderation_status, review_note, created_at, updated_at
    ) VALUES (
      @id, @title, @type, @category, @price, @downloads, @rating, @authorName, @authorMark, @authorTitle,
      @coverLabel, @coverGradient, @tagsJson, @description, @sizeLabel, @suitableFor, @previewPointsJson,
      NULL, NULL, 'approved', NULL, @createdAt, @updatedAt
    )
  `);

  const relationInsert = db.prepare(`
    INSERT INTO resource_competitions (resource_id, competition_id) VALUES (@resourceId, @competitionId)
  `);

  for (const item of seedData.resources) {
    insert.run({
      id: item.id,
      title: item.title,
      type: item.type,
      category: item.category,
      price: item.price,
      downloads: item.downloads,
      rating: item.rating,
      authorName: item.authorName,
      authorMark: item.authorMark,
      authorTitle: item.authorTitle,
      coverLabel: item.coverLabel,
      coverGradient: item.coverGradient,
      tagsJson: serializeJson(item.tags),
      description: item.description,
      sizeLabel: item.sizeLabel,
      suitableFor: item.suitableFor,
      previewPointsJson: serializeJson(item.previewPoints),
      createdAt,
      updatedAt: createdAt,
    });

    for (const competitionId of item.relatedCompetitionIds) {
      relationInsert.run({ resourceId: item.id, competitionId });
    }
  }
}

function seedTeams() {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO teams (
      id, title, comp_id, comp_name, status, target, full_description, current_count, max_count, missing_roles_json,
      deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
      requirements_json, contact_hint, moderation_status, created_at, updated_at
    ) VALUES (
      @id, @title, @compId, @compName, @status, @target, @fullDescription, @currentCount, @maxCount, @missingRolesJson,
      @deadline, @authorUserId, @authorName, @authorMark, @authorGrade, @authorMajor, @schoolLimit,
      @requirementsJson, @contactHint, 'approved', @createdAt, @updatedAt
    )
  `);

  for (const item of seedData.teams) {
    insert.run({
      id: item.id,
      title: item.title,
      compId: item.compId || null,
      compName: item.compName,
      status: item.status,
      target: item.target,
      fullDescription: item.fullDescription || '',
      currentCount: item.current,
      maxCount: item.max,
      missingRolesJson: serializeJson(item.missingRoles),
      deadline: item.deadline,
      authorUserId: item.authorName === seedData.userProfile.name ? seedData.userProfile.id : null,
      authorName: item.authorName,
      authorMark: item.authorMark,
      authorGrade: item.authorGrade,
      authorMajor: item.authorMajor,
      schoolLimit: item.schoolLimit ? 1 : 0,
      requirementsJson: serializeJson(item.requirements),
      contactHint: item.contactHint,
      createdAt,
      updatedAt: createdAt,
    });
  }
}

function seedPosts() {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO posts (
      id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
      likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
      moderation_status, created_at, updated_at
    ) VALUES (
      @id, @title, @excerpt, @contentJson, @category, @authorUserId, @authorName, @authorMark,
      @likesCount, @commentsCount, @tagsJson, @timeLabel, @relatedCompetitionId, @relatedResourceId,
      'approved', @createdAt, @updatedAt
    )
  `);

  for (const item of seedData.posts) {
    insert.run({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      contentJson: serializeJson(item.content),
      category: item.category,
      authorUserId: item.authorName === seedData.userProfile.name ? seedData.userProfile.id : null,
      authorName: item.authorName,
      authorMark: item.authorMark,
      likesCount: item.likes,
      commentsCount: item.comments,
      tagsJson: serializeJson(item.tags),
      timeLabel: item.time,
      relatedCompetitionId: item.relatedCompetitionId || null,
      relatedResourceId: item.relatedResourceId || null,
      createdAt,
      updatedAt: createdAt,
    });
  }
}

function seedNotifications() {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO notifications (
      id, user_id, category, title, content, time_label, unread, link_type, link_id, link_scene, comment_id, cta_text, created_at
    ) VALUES (
      @id, @userId, @category, @title, @content, @timeLabel, @unread, @linkType, @linkId, @linkScene, @commentId, @ctaText, @createdAt
    )
  `);

  for (const item of seedData.notifications) {
    insert.run({
      id: item.id,
      userId: seedData.userProfile.id,
      category: item.category,
      title: item.title,
      content: item.content,
      timeLabel: item.time,
      unread: item.unread ? 1 : 0,
      linkType: item.linkType,
      linkId: item.linkId || null,
      linkScene: item.linkScene || null,
      commentId: item.commentId || null,
      ctaText: item.ctaText,
      createdAt,
    });
  }
}

function seedSearchSuggestions() {
  const insert = db.prepare(`
    INSERT INTO search_suggestions (id, label, scope, sort_order)
    VALUES (@id, @label, @scope, @sortOrder)
  `);

  seedData.searchSuggestions.forEach((item, index) => {
    insert.run({
      id: item.id,
      label: item.label,
      scope: item.scope,
      sortOrder: index + 1,
    });
  });
}

function seedHomeFeedConfig() {
  const publishedAt = new Date().toISOString();
  const defaultBanners = [
    {
      id: 'banner-campus',
      badge: '校园成长',
      title: '看见机会，找到资源，拉起队伍，然后真正开始行动。',
      imageUrl:
        'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1MTg0OTU0fDA&ixlib=rb-4.1.0&q=80&w=1080',
      link: '/',
    },
    {
      id: 'banner-competition',
      badge: '近期赛事',
      title: '把近期高转化竞赛先报上，别等到截止前再仓促准备。',
      imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
      link: '/competitions',
    },
    {
      id: 'banner-team',
      badge: '组队专区',
      title: '找到靠谱队友，比一个人盲目硬撑更快把项目跑起来。',
      imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
      link: '/teams',
    },
  ];
  const defaultQuickLinks = ['competitions', 'resources', 'teams', 'community', 'ai'].map((id) => ({ id, enabled: true }));
  db.prepare(`
    INSERT INTO home_feed_configs (
      id, hero_badge, hero_prompt, hero_image_url,
      banners_json, quick_links_json, publish_status, publish_at, offline_at,
      competition_limit, resource_limit, team_limit, post_limit,
      competition_ids_json, resource_ids_json, team_ids_json, post_ids_json, updated_at
    ) VALUES (
      'default', @heroBadge, @heroPrompt, @heroImageUrl,
      @bannersJson, @quickLinksJson, 'online', @publishAt, NULL,
      2, 2, 2, 2, @competitionIdsJson, @resourceIdsJson, @teamIdsJson, @postIdsJson, @updatedAt
    )
  `).run({
    heroBadge: '校园成长',
    heroPrompt: '看见机会，找到资源，拉起队伍，然后真正开始行动。',
    heroImageUrl:
      'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1MTg0OTU0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    bannersJson: serializeJson(defaultBanners),
    quickLinksJson: serializeJson(defaultQuickLinks),
    competitionIdsJson: serializeJson([]),
    resourceIdsJson: serializeJson([]),
    teamIdsJson: serializeJson([]),
    postIdsJson: serializeJson([]),
    publishAt: publishedAt,
    updatedAt: publishedAt,
  });
}

function migrateHomeFeedConfig() {
  const row = db
    .prepare(
      `
        SELECT id, hero_badge, hero_prompt, hero_image_url, banners_json, quick_links_json,
               competition_limit, resource_limit, team_limit, post_limit
        FROM home_feed_configs
        WHERE id = 'default'
      `
    )
    .get() as
    | {
        id: string;
        hero_badge?: string | null;
        hero_prompt?: string | null;
        hero_image_url?: string | null;
        banners_json?: string | null;
        quick_links_json?: string | null;
        competition_limit?: number | null;
        resource_limit?: number | null;
        team_limit?: number | null;
        post_limit?: number | null;
      }
    | undefined;

  if (!row) {
    return;
  }

  const defaultHeroBadge = row.hero_badge || '校园成长';
  const defaultHeroPrompt = row.hero_prompt || '看见机会，找到资源，拉起队伍，然后真正开始行动。';
  const defaultHeroImage =
    row.hero_image_url ||
    'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1MTg0OTU0fDA&ixlib=rb-4.1.0&q=80&w=1080';

  const nextBanners =
    row.banners_json && row.banners_json !== '[]'
      ? row.banners_json
      : serializeJson([
          {
            id: 'banner-campus',
            badge: defaultHeroBadge,
            title: defaultHeroPrompt,
            imageUrl: defaultHeroImage,
            link: '/',
          },
          {
            id: 'banner-competition',
            badge: '近期赛事',
            title: '把近期高转化竞赛先报上，别等到截止前再仓促准备。',
            imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
            link: '/competitions',
          },
          {
            id: 'banner-team',
            badge: '组队专区',
            title: '找到靠谱队友，比一个人盲目硬撑更快把项目跑起来。',
            imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
            link: '/teams',
          },
        ]);

  const nextQuickLinks =
    row.quick_links_json && row.quick_links_json !== '[]'
      ? row.quick_links_json
      : serializeJson(['competitions', 'resources', 'teams', 'community', 'ai'].map((id) => ({ id, enabled: true })));

  db.prepare(
    `
      UPDATE home_feed_configs
      SET hero_badge = COALESCE(hero_badge, @heroBadge),
          hero_prompt = COALESCE(hero_prompt, @heroPrompt),
          hero_image_url = COALESCE(hero_image_url, @heroImageUrl),
          banners_json = @bannersJson,
          quick_links_json = @quickLinksJson,
          competition_limit = COALESCE(competition_limit, 2),
          resource_limit = COALESCE(resource_limit, 2),
          team_limit = COALESCE(team_limit, 2),
          post_limit = COALESCE(post_limit, 2)
      WHERE id = 'default'
    `
  ).run({
    heroBadge: defaultHeroBadge,
    heroPrompt: defaultHeroPrompt,
    heroImageUrl: defaultHeroImage,
    bannersJson: nextBanners,
    quickLinksJson: nextQuickLinks,
  });
}

function seedFavorites() {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
    VALUES (@id, @userId, @targetType, @targetId, @createdAt)
  `);

  insert.run({
    id: 'fav_competition_c2',
    userId: seedData.userProfile.id,
    targetType: 'competition',
    targetId: 'c2',
    createdAt,
  });

  insert.run({
    id: 'fav_resource_r1',
    userId: seedData.userProfile.id,
    targetType: 'resource',
    targetId: 'r1',
    createdAt,
  });
}

function seedOwnedResources() {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO owned_resources (
      id, user_id, resource_id, title, type, access_type, acquired_at, download_count, tags_json, created_at
    ) VALUES (
      @id, @userId, @resourceId, @title, @type, @accessType, @acquiredAt, @downloadCount, @tagsJson, @createdAt
    )
  `);

  for (const item of seedData.ownedResources) {
    insert.run({
      id: item.id,
      userId: seedData.userProfile.id,
      resourceId: item.resourceId,
      title: item.title,
      type: item.type,
      accessType: item.accessType,
      acquiredAt: item.acquiredAt,
      downloadCount: item.downloadCount,
      tagsJson: serializeJson(item.tags),
      createdAt,
    });
  }
}

function seedOrders() {
  const insert = db.prepare(`
    INSERT INTO orders (
      id, user_id, title, item_type, amount, status, created_at, paid_at, resource_id, cover_label,
      payment_provider, payment_ref, notify_payload_json, updated_at
    ) VALUES (
      @id, @userId, @title, @itemType, @amount, @status, @createdAt, @paidAt, @resourceId, @coverLabel,
      'wechat', NULL, NULL, @updatedAt
    )
  `);

  for (const item of seedData.orders) {
    insert.run({
      id: item.id,
      userId: seedData.userProfile.id,
      title: item.title,
      itemType: item.itemType,
      amount: item.amount,
      status: item.status,
      createdAt: item.createdAt,
      paidAt: item.paidAt || null,
      resourceId: item.resourceId || null,
      coverLabel: item.coverLabel,
      updatedAt: item.paidAt || item.createdAt,
    });
  }
}

function seedDownloadGrants() {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO resource_download_grants (
      id, user_id, resource_id, order_id, grant_type, download_url, expires_at, created_at
    ) VALUES (
      @id, @userId, @resourceId, NULL, @grantType, @downloadUrl, NULL, @createdAt
    )
  `);

  for (const item of seedData.ownedResources) {
    insert.run({
      id: `grant_${item.id}`,
      userId: seedData.userProfile.id,
      resourceId: item.resourceId,
      grantType: item.accessType,
      downloadUrl: `https://download.example.com/resources/${item.resourceId}`,
      createdAt,
    });
  }
}

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      school_id TEXT,
      school_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      detail_json TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      open_id TEXT UNIQUE NOT NULL,
      union_id TEXT,
      session_key TEXT,
      name TEXT NOT NULL,
      mark TEXT NOT NULL,
      avatar_url TEXT,
      school_id TEXT,
      school TEXT NOT NULL,
      major TEXT NOT NULL,
      grade TEXT NOT NULL,
      bio TEXT NOT NULL,
      focus_tags_json TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      checkin_streak INTEGER NOT NULL DEFAULT 0,
      last_checkin_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      source_id TEXT UNIQUE,
      code TEXT,
      name TEXT NOT NULL UNIQUE,
      short_name TEXT NOT NULL,
      province TEXT,
      city TEXT,
      logo_url TEXT,
      is_open INTEGER NOT NULL DEFAULT 1,
      is_hot INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_school_memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      school_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      certification_status TEXT NOT NULL DEFAULT 'unverified',
      education_email TEXT,
      phone TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, school_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_verification_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS competitions (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      content_scope TEXT NOT NULL DEFAULT 'platform',
      title TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      host TEXT NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      deadline TEXT NOT NULL,
      days_left INTEGER NOT NULL,
      views INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      cover_label TEXT NOT NULL,
      cover_gradient TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      description TEXT NOT NULL,
      recommended_for_json TEXT NOT NULL,
      action_hints_json TEXT NOT NULL,
      registration_start TEXT,
      registration_end TEXT,
      competition_start TEXT,
      competition_end TEXT,
      team_size TEXT,
      stages_json TEXT NOT NULL DEFAULT '[]',
      submission_materials_json TEXT NOT NULL DEFAULT '[]',
      awards TEXT,
      fee_description TEXT,
      official_contact TEXT,
      source_url TEXT,
      last_verified_at TEXT,
      edition_label TEXT NOT NULL DEFAULT '',
      current_edition_label TEXT,
      reference_edition_label TEXT,
      reference_notice_url TEXT,
      schedule_note TEXT,
      data_freshness TEXT NOT NULL DEFAULT 'current',
      schedule_status TEXT NOT NULL DEFAULT 'not_announced',
      registration_method TEXT,
      tracks_json TEXT NOT NULL DEFAULT '[]',
      quality_status TEXT NOT NULL DEFAULT 'pending_review',
      publish_status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      bucket_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at BIGINT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS competition_notices (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT,
      source_url TEXT NOT NULL,
      file_type TEXT NOT NULL,
      storage_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS competition_source_snapshots (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      http_status INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      content_length INTEGER NOT NULL,
      extracted_json TEXT NOT NULL DEFAULT '{}',
      previous_hash TEXT,
      review_status TEXT NOT NULL DEFAULT 'pending_review',
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS competition_view_events (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      viewer_key TEXT NOT NULL,
      viewed_on TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (competition_id, viewer_key, viewed_on),
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resource_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      storage_provider TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      local_path TEXT,
      original_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      content_scope TEXT NOT NULL DEFAULT 'platform',
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      downloads INTEGER NOT NULL,
      rating REAL NOT NULL,
      author_name TEXT NOT NULL,
      author_mark TEXT NOT NULL,
      author_title TEXT NOT NULL,
      cover_label TEXT NOT NULL,
      cover_gradient TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      description TEXT NOT NULL,
      size_label TEXT NOT NULL,
      suitable_for TEXT NOT NULL,
      preview_points_json TEXT NOT NULL,
      author_user_id TEXT,
      file_asset_id TEXT,
      source_url TEXT,
      moderation_status TEXT NOT NULL DEFAULT 'approved',
      review_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (file_asset_id) REFERENCES resource_assets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS resource_competitions (
      resource_id TEXT NOT NULL,
      competition_id TEXT NOT NULL,
      PRIMARY KEY (resource_id, competition_id),
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      content_scope TEXT NOT NULL DEFAULT 'school',
      listing_type TEXT NOT NULL DEFAULT 'team_recruit',
      title TEXT NOT NULL,
      comp_id TEXT,
      comp_name TEXT NOT NULL,
      status TEXT NOT NULL,
      target TEXT NOT NULL,
      full_description TEXT NOT NULL DEFAULT '',
      current_count INTEGER NOT NULL,
      max_count INTEGER NOT NULL,
      missing_roles_json TEXT NOT NULL,
      deadline TEXT NOT NULL,
      author_user_id TEXT,
      author_name TEXT NOT NULL,
      author_mark TEXT NOT NULL,
      author_grade TEXT NOT NULL,
      author_major TEXT NOT NULL,
      school_limit INTEGER NOT NULL,
      visibility_scope TEXT NOT NULL DEFAULT 'school',
      requirements_json TEXT NOT NULL,
      goal_tags_json TEXT NOT NULL DEFAULT '[]',
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      collaboration_mode TEXT NOT NULL DEFAULT '',
      weekly_commitment TEXT NOT NULL DEFAULT '',
      contact_hint TEXT NOT NULL,
      contact_email TEXT,
      is_example INTEGER NOT NULL DEFAULT 0,
      example_expires_at TEXT,
      moderation_status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team_contact_views (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      viewer_user_id TEXT NOT NULL,
      viewed_on TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (team_id, viewer_user_id, viewed_on),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      content_scope TEXT NOT NULL DEFAULT 'school',
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content_json TEXT NOT NULL,
      category TEXT NOT NULL,
      author_user_id TEXT,
      author_name TEXT NOT NULL,
      author_mark TEXT NOT NULL,
      likes_count INTEGER NOT NULL,
      comments_count INTEGER NOT NULL,
      tags_json TEXT NOT NULL,
      time_label TEXT NOT NULL,
      related_competition_id TEXT,
      related_resource_id TEXT,
      question_status TEXT NOT NULL DEFAULT 'open',
      accepted_comment_id TEXT,
      moderation_status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      time_label TEXT NOT NULL,
      unread INTEGER NOT NULL,
      link_type TEXT NOT NULL,
      link_id TEXT,
      link_scene TEXT,
      comment_id TEXT,
      cta_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS search_suggestions (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      scope TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, target_type, target_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      note TEXT NOT NULL,
      ref_type TEXT,
      ref_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS competition_enrollments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      competition_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, competition_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_applications (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (team_id, user_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS owned_resources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      access_type TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      download_count INTEGER NOT NULL,
      tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, resource_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      item_type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      resource_id TEXT,
      cover_label TEXT NOT NULL,
      payment_provider TEXT NOT NULL,
      payment_ref TEXT,
      notify_payload_json TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_comment_id TEXT,
      reply_to_comment_id TEXT,
      author_name TEXT NOT NULL,
      author_mark TEXT NOT NULL,
      content TEXT NOT NULL,
      likes_count INTEGER NOT NULL DEFAULT 0,
      moderation_status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to_comment_id) REFERENCES comments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS moderation_tasks (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS resource_download_grants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      order_id TEXT,
      grant_type TEXT NOT NULL,
      download_url TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      out_refund_no TEXT NOT NULL UNIQUE,
      refund_id TEXT,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      transaction_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS home_feed_configs (
      id TEXT PRIMARY KEY,
      hero_badge TEXT NOT NULL,
      hero_prompt TEXT NOT NULL,
      hero_image_url TEXT NOT NULL,
      banners_json TEXT NOT NULL,
      quick_links_json TEXT NOT NULL,
      publish_status TEXT NOT NULL DEFAULT 'online',
      publish_at TEXT,
      offline_at TEXT,
      competition_limit INTEGER NOT NULL DEFAULT 2,
      resource_limit INTEGER NOT NULL DEFAULT 2,
      team_limit INTEGER NOT NULL DEFAULT 2,
      post_limit INTEGER NOT NULL DEFAULT 2,
      competition_ids_json TEXT NOT NULL,
      resource_ids_json TEXT NOT NULL,
      team_ids_json TEXT NOT NULL,
      post_ids_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS school_home_configs (
      school_id TEXT PRIMARY KEY,
      announcement TEXT NOT NULL DEFAULT '',
      team_ids_json TEXT NOT NULL DEFAULT '[]',
      post_ids_json TEXT NOT NULL DEFAULT '[]',
      updated_by_admin_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
    );

  `);

  ensureColumn('admin_users', 'school_id TEXT');
  ensureColumn('admin_users', 'school_name TEXT');
  ensureColumn('users', 'school_id TEXT');
  ensureColumn('users', 'points INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'checkin_streak INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'last_checkin_date TEXT');
  ensureColumn('schools', 'source_id TEXT');
  ensureColumn('schools', 'code TEXT');
  ensureColumn('schools', 'short_name TEXT');
  ensureColumn('schools', 'province TEXT');
  ensureColumn('schools', 'city TEXT');
  ensureColumn('schools', 'logo_url TEXT');
  ensureColumn('schools', 'is_open INTEGER NOT NULL DEFAULT 1');
  ensureColumn('schools', 'is_hot INTEGER NOT NULL DEFAULT 0');
  ensureColumn('schools', 'sort_order INTEGER NOT NULL DEFAULT 0');
  ensureColumn('schools', 'created_at TEXT');
  ensureColumn('schools', 'updated_at TEXT');
  ensureColumn('comments', 'parent_comment_id TEXT');
  ensureColumn('comments', 'reply_to_comment_id TEXT');
  ensureColumn('notifications', 'link_scene TEXT');
  ensureColumn('notifications', 'comment_id TEXT');
  ensureColumn('users', 'avatar_url TEXT');
  ensureColumn('competitions', 'school_id TEXT');
  ensureColumn('competitions', `content_scope TEXT NOT NULL DEFAULT 'platform'`);
  ensureColumn('competitions', 'registration_start TEXT');
  ensureColumn('competitions', 'registration_end TEXT');
  ensureColumn('competitions', 'competition_start TEXT');
  ensureColumn('competitions', 'competition_end TEXT');
  ensureColumn('competitions', 'team_size TEXT');
  ensureColumn('competitions', `stages_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn('competitions', `submission_materials_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn('competitions', 'awards TEXT');
  ensureColumn('competitions', 'fee_description TEXT');
  ensureColumn('competitions', 'official_contact TEXT');
  ensureColumn('competitions', 'source_url TEXT');
  ensureColumn('competitions', 'last_verified_at TEXT');
  ensureColumn('competitions', `edition_label TEXT NOT NULL DEFAULT ''`);
  ensureColumn('competitions', 'current_edition_label TEXT');
  ensureColumn('competitions', 'reference_edition_label TEXT');
  ensureColumn('competitions', 'reference_notice_url TEXT');
  ensureColumn('competitions', 'schedule_note TEXT');
  ensureColumn('competitions', `data_freshness TEXT NOT NULL DEFAULT 'current'`);
  ensureColumn('competitions', `schedule_status TEXT NOT NULL DEFAULT 'not_announced'`);
  ensureColumn('competitions', 'registration_method TEXT');
  ensureColumn('competitions', `tracks_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn('competitions', `quality_status TEXT NOT NULL DEFAULT 'pending_review'`);
  ensureColumn('competitions', `publish_status TEXT NOT NULL DEFAULT 'published'`);
  ensureColumn('competitions', 'created_at TEXT');
  ensureColumn('competitions', 'updated_at TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS competition_source_snapshots (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      http_status INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      content_length INTEGER NOT NULL,
      extracted_json TEXT NOT NULL DEFAULT '{}',
      previous_hash TEXT,
      review_status TEXT NOT NULL DEFAULT 'pending_review',
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_competition_source_snapshots_review
      ON competition_source_snapshots (review_status, fetched_at);
    CREATE INDEX IF NOT EXISTS idx_competition_source_snapshots_competition
      ON competition_source_snapshots (competition_id, fetched_at);
  `);
  ensureColumn('resources', 'school_id TEXT');
  ensureColumn('resources', `content_scope TEXT NOT NULL DEFAULT 'platform'`);
  ensureColumn('resources', 'author_user_id TEXT');
  ensureColumn('resources', 'file_asset_id TEXT');
  ensureColumn('resources', 'source_url TEXT');
  ensureColumn(`resources`, `moderation_status TEXT NOT NULL DEFAULT 'approved'`);
  ensureColumn('resources', 'review_note TEXT');
  ensureColumn('resources', 'created_at TEXT');
  ensureColumn('resources', 'updated_at TEXT');
  ensureColumn('home_feed_configs', `hero_badge TEXT NOT NULL DEFAULT '校园成长'`);
  ensureColumn('home_feed_configs', `hero_prompt TEXT NOT NULL DEFAULT '看见机会，找到资源，拉起队伍，然后真正开始行动。'`);
  ensureColumn('home_feed_configs', `hero_image_url TEXT NOT NULL DEFAULT ''`);
  ensureColumn('home_feed_configs', `banners_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn('home_feed_configs', `quick_links_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn(`home_feed_configs`, `publish_status TEXT NOT NULL DEFAULT 'online'`);
  ensureColumn('home_feed_configs', 'publish_at TEXT');
  ensureColumn('home_feed_configs', 'offline_at TEXT');
  ensureColumn('home_feed_configs', 'competition_limit INTEGER NOT NULL DEFAULT 2');
  ensureColumn('home_feed_configs', 'resource_limit INTEGER NOT NULL DEFAULT 2');
  ensureColumn('home_feed_configs', 'team_limit INTEGER NOT NULL DEFAULT 2');
  ensureColumn('home_feed_configs', 'post_limit INTEGER NOT NULL DEFAULT 2');
  ensureColumn('teams', 'school_id TEXT');
  ensureColumn('teams', `content_scope TEXT NOT NULL DEFAULT 'school'`);
  ensureColumn('teams', `visibility_scope TEXT NOT NULL DEFAULT 'school'`);
  ensureColumn('teams', `listing_type TEXT NOT NULL DEFAULT 'team_recruit'`);
  ensureColumn('teams', `goal_tags_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn('teams', `capabilities_json TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn('teams', `collaboration_mode TEXT NOT NULL DEFAULT ''`);
  ensureColumn('teams', `weekly_commitment TEXT NOT NULL DEFAULT ''`);
  ensureColumn('teams', `full_description TEXT NOT NULL DEFAULT ''`);
  ensureColumn('teams', 'contact_email TEXT');
  ensureColumn('teams', 'is_example INTEGER NOT NULL DEFAULT 0');
  ensureColumn('teams', 'example_expires_at TEXT');
  ensureColumn('posts', 'school_id TEXT');
  ensureColumn('posts', `content_scope TEXT NOT NULL DEFAULT 'school'`);
  ensureColumn('posts', `question_status TEXT NOT NULL DEFAULT 'open'`);
  ensureColumn('posts', 'accepted_comment_id TEXT');

  db.prepare(
    `UPDATE admin_users SET permissions_json = @permissionsJson, updated_at = @updatedAt WHERE role = 'school_admin'`
  ).run({
    permissionsJson: JSON.stringify(serverConfig.adminPermissions.school_admin),
    updatedAt: new Date().toISOString(),
  });

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_schools_search ON schools (name, province, city);
    CREATE INDEX IF NOT EXISTS idx_admin_users_school ON admin_users (school_id);
    CREATE INDEX IF NOT EXISTS idx_user_school_memberships_user_active ON user_school_memberships (user_id, active);
    CREATE INDEX IF NOT EXISTS idx_point_ledger_user_created ON point_ledger (user_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_point_ledger_user_checkin_date ON point_ledger (user_id, ref_type, ref_id) WHERE type = 'checkin';
    CREATE INDEX IF NOT EXISTS idx_competitions_school ON competitions (school_id);
    CREATE INDEX IF NOT EXISTS idx_competitions_category_level ON competitions (category, level);
    CREATE INDEX IF NOT EXISTS idx_competitions_public_quality ON competitions (publish_status, quality_status);
    CREATE INDEX IF NOT EXISTS idx_competition_notices_competition ON competition_notices (competition_id, published_at);
    CREATE INDEX IF NOT EXISTS idx_competition_view_events_competition_date ON competition_view_events (competition_id, viewed_on);
    CREATE INDEX IF NOT EXISTS idx_resources_school ON resources (school_id);
    CREATE INDEX IF NOT EXISTS idx_teams_school ON teams (school_id);
    CREATE INDEX IF NOT EXISTS idx_teams_listing_type ON teams (listing_type);
    CREATE INDEX IF NOT EXISTS idx_teams_example_expiry ON teams (school_id, is_example, example_expires_at);
    CREATE INDEX IF NOT EXISTS idx_team_contact_views_team_date ON team_contact_views (team_id, viewed_on);
    CREATE INDEX IF NOT EXISTS idx_posts_school ON posts (school_id);
    CREATE INDEX IF NOT EXISTS idx_posts_question_status ON posts (category, question_status, comments_count);
  `);

  const nowIso = new Date().toISOString();
  const schoolCount = Number(
    (db.prepare(`SELECT COUNT(*) AS count FROM schools`).get() as { count?: number | string } | undefined)?.count ?? 0
  );
  if (schoolCount < 1000) {
    seedSchools();
  }
  ensureUserSchoolMemberships();
  backfillContentSchoolIds();
  db.exec(`
    UPDATE competitions
    SET content_scope = 'platform'
    WHERE school_id IS NULL;
    UPDATE competitions
    SET content_scope = 'school'
    WHERE school_id IS NOT NULL;
    UPDATE resources
    SET content_scope = 'school'
    WHERE school_id IS NOT NULL
       OR (author_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users resource_author
        WHERE resource_author.id = resources.author_user_id
          AND resource_author.open_id LIKE 'system:%'
      ));
    UPDATE resources
    SET content_scope = 'platform'
    WHERE school_id IS NULL
      AND (author_user_id IS NULL
       OR EXISTS (
         SELECT 1 FROM users resource_author
         WHERE resource_author.id = resources.author_user_id
           AND resource_author.open_id LIKE 'system:%'
       ));
    UPDATE resources
    SET moderation_status = 'rejected',
        review_note = COALESCE(review_note, '作者未完成学校认证')
    WHERE content_scope = 'school' AND school_id IS NULL;
    UPDATE teams SET content_scope = 'school';
    UPDATE posts
    SET content_scope = 'platform', school_id = NULL
    WHERE (category = '资讯' AND author_user_id IS NULL) OR id LIKE 'official_%';
    UPDATE posts
    SET content_scope = 'school'
    WHERE NOT ((category = '资讯' AND author_user_id IS NULL) OR id LIKE 'official_%');
    UPDATE teams
    SET school_id = NULL,
        moderation_status = 'pending'
    WHERE content_scope = 'school'
      AND is_example = 0
      AND NOT EXISTS (
        SELECT 1
        FROM user_school_memberships usm
        WHERE usm.user_id = teams.author_user_id
          AND usm.school_id = teams.school_id
          AND usm.active = 1
          AND usm.certification_status = 'verified'
          AND usm.email_verified = 1
          AND usm.phone_verified = 1
      );
    UPDATE posts
    SET school_id = NULL,
        moderation_status = 'pending'
    WHERE content_scope = 'school'
      AND NOT EXISTS (
        SELECT 1
        FROM user_school_memberships usm
        WHERE usm.user_id = posts.author_user_id
          AND usm.school_id = posts.school_id
          AND usm.active = 1
          AND usm.certification_status = 'verified'
          AND usm.email_verified = 1
          AND usm.phone_verified = 1
      );
    INSERT INTO moderation_tasks (
      id, target_type, target_id, action, status, note, created_at, reviewed_at
    )
    SELECT 'scope_review_team_' || id, 'team', id, 'content_scope_review', 'pending',
           '历史内容缺少可核验的学校归属', COALESCE(created_at, CAST(CURRENT_TIMESTAMP AS TEXT)), NULL
    FROM teams
    WHERE content_scope = 'school' AND is_example = 0 AND school_id IS NULL AND moderation_status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM moderation_tasks mt WHERE mt.target_type = 'team' AND mt.target_id = teams.id
      )
    ON CONFLICT DO NOTHING;
    INSERT INTO moderation_tasks (
      id, target_type, target_id, action, status, note, created_at, reviewed_at
    )
    SELECT 'scope_review_post_' || id, 'post', id, 'content_scope_review', 'pending',
           '历史内容缺少可核验的学校归属', COALESCE(created_at, CAST(CURRENT_TIMESTAMP AS TEXT)), NULL
    FROM posts
    WHERE content_scope = 'school' AND school_id IS NULL AND moderation_status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM moderation_tasks mt WHERE mt.target_type = 'post' AND mt.target_id = posts.id
      )
    ON CONFLICT DO NOTHING;
  `);
  migrateCompetitionStructure();

  db.prepare(
    `
      UPDATE resources
      SET moderation_status = COALESCE(moderation_status, 'approved'),
          created_at = COALESCE(created_at, @nowValue),
          updated_at = COALESCE(updated_at, @nowValue)
    `
  ).run({ nowValue: nowIso });

  db.prepare(
    `
      UPDATE home_feed_configs
      SET publish_status = COALESCE(publish_status, 'online'),
          publish_at = COALESCE(publish_at, @nowValue)
    `
  ).run({ nowValue: nowIso });
  migrateHomeFeedConfig();

  if (tableHasData('competitions')) {
    ensureBootstrapAdminUser();
    if (!tableHasData('home_feed_configs')) {
      seedHomeFeedConfig();
    }
    return;
  }

  if (!tableHasData('home_feed_configs')) {
    seedHomeFeedConfig();
  }

  ensureBootstrapAdminUser();
}

initializeDatabase();
