import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as seedModule from '../frontend/src/data/mock.ts';
import { serverConfig } from './config.ts';

type FrontendSeedModule = typeof import('../frontend/src/data/mock');

const seedData = (seedModule as FrontendSeedModule & { default?: FrontendSeedModule }).default ?? seedModule;

mkdirSync(dirname(serverConfig.dbPath), { recursive: true });

export const db = new DatabaseSync(serverConfig.dbPath);
db.exec('PRAGMA foreign_keys = ON;');

function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

function tableHasData(tableName: string) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number };
  return row.count > 0;
}

function tableHasColumn(tableName: string, columnName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function ensureColumn(tableName: string, columnDefinition: string) {
  const columnName = columnDefinition.trim().split(/\s+/, 1)[0];
  if (tableHasColumn(tableName, columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
}

function seedUsers() {
  const user = seedData.userProfile;
  db.prepare(`
    INSERT INTO users (
      id, open_id, union_id, session_key, name, mark, school, major, grade, bio, focus_tags_json, created_at, updated_at
    ) VALUES (
      @id, @openId, NULL, NULL, @name, @mark, @school, @major, @grade, @bio, @focusTagsJson, datetime('now'), datetime('now')
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
  const insert = db.prepare(`
    INSERT INTO resources (
      id, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
      cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json
    ) VALUES (
      @id, @title, @type, @category, @price, @downloads, @rating, @authorName, @authorMark, @authorTitle,
      @coverLabel, @coverGradient, @tagsJson, @description, @sizeLabel, @suitableFor, @previewPointsJson
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
    });

    for (const competitionId of item.relatedCompetitionIds) {
      relationInsert.run({ resourceId: item.id, competitionId });
    }
  }
}

function seedTeams() {
  const insert = db.prepare(`
    INSERT INTO teams (
      id, title, comp_id, comp_name, status, target, current_count, max_count, missing_roles_json,
      deadline, author_user_id, author_name, author_mark, author_grade, author_major, school_limit,
      requirements_json, contact_hint, moderation_status, created_at, updated_at
    ) VALUES (
      @id, @title, @compId, @compName, @status, @target, @currentCount, @maxCount, @missingRolesJson,
      @deadline, @authorUserId, @authorName, @authorMark, @authorGrade, @authorMajor, @schoolLimit,
      @requirementsJson, @contactHint, 'approved', datetime('now'), datetime('now')
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
    });
  }
}

function seedPosts() {
  const insert = db.prepare(`
    INSERT INTO posts (
      id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
      likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
      moderation_status, created_at, updated_at
    ) VALUES (
      @id, @title, @excerpt, @contentJson, @category, @authorUserId, @authorName, @authorMark,
      @likesCount, @commentsCount, @tagsJson, @timeLabel, @relatedCompetitionId, @relatedResourceId,
      'approved', datetime('now'), datetime('now')
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
    });
  }
}

function seedNotifications() {
  const insert = db.prepare(`
    INSERT INTO notifications (
      id, user_id, category, title, content, time_label, unread, link_type, link_id, link_scene, comment_id, cta_text, created_at
    ) VALUES (
      @id, @userId, @category, @title, @content, @timeLabel, @unread, @linkType, @linkId, @linkScene, @commentId, @ctaText, datetime('now')
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

function seedFavorites() {
  const insert = db.prepare(`
    INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
    VALUES (@id, @userId, @targetType, @targetId, datetime('now'))
  `);

  insert.run({
    id: 'fav_competition_c2',
    userId: seedData.userProfile.id,
    targetType: 'competition',
    targetId: 'c2',
  });

  insert.run({
    id: 'fav_resource_r1',
    userId: seedData.userProfile.id,
    targetType: 'resource',
    targetId: 'r1',
  });
}

function seedOwnedResources() {
  const insert = db.prepare(`
    INSERT INTO owned_resources (
      id, user_id, resource_id, title, type, access_type, acquired_at, download_count, tags_json, created_at
    ) VALUES (
      @id, @userId, @resourceId, @title, @type, @accessType, @acquiredAt, @downloadCount, @tagsJson, datetime('now')
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
      'wechat', NULL, NULL, datetime('now')
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
    });
  }
}

function seedDownloadGrants() {
  const insert = db.prepare(`
    INSERT INTO resource_download_grants (
      id, user_id, resource_id, order_id, grant_type, download_url, expires_at, created_at
    ) VALUES (
      @id, @userId, @resourceId, NULL, @grantType, @downloadUrl, NULL, datetime('now')
    )
  `);

  for (const item of seedData.ownedResources) {
    insert.run({
      id: `grant_${item.id}`,
      userId: seedData.userProfile.id,
      resourceId: item.resourceId,
      grantType: item.accessType,
      downloadUrl: `https://download.example.com/resources/${item.resourceId}`,
    });
  }
}

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      open_id TEXT UNIQUE NOT NULL,
      union_id TEXT,
      session_key TEXT,
      name TEXT NOT NULL,
      mark TEXT NOT NULL,
      school TEXT NOT NULL,
      major TEXT NOT NULL,
      grade TEXT NOT NULL,
      bio TEXT NOT NULL,
      focus_tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
      action_hints_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
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
      preview_points_json TEXT NOT NULL
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
      title TEXT NOT NULL,
      comp_id TEXT,
      comp_name TEXT NOT NULL,
      status TEXT NOT NULL,
      target TEXT NOT NULL,
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
      requirements_json TEXT NOT NULL,
      contact_hint TEXT NOT NULL,
      moderation_status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
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
  `);

  ensureColumn('comments', 'parent_comment_id TEXT');
  ensureColumn('comments', 'reply_to_comment_id TEXT');
  ensureColumn('notifications', 'link_scene TEXT');
  ensureColumn('notifications', 'comment_id TEXT');

  if (tableHasData('competitions')) {
    return;
  }

  db.exec('BEGIN');
  try {
    seedUsers();
    seedCompetitions();
    seedResources();
    seedTeams();
    seedPosts();
    seedNotifications();
    seedSearchSuggestions();
    seedFavorites();
    seedOwnedResources();
    seedOrders();
    seedDownloadGrants();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

initializeDatabase();
