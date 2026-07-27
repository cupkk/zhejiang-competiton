import { createHash } from 'node:crypto';

type HelpersModule = typeof import('../server/helpers.ts');

let helpers: HelpersModule | null = null;

async function loadDatabaseHelpers() {
  await import('../server/db.ts');
  helpers = await import('../server/helpers.ts');
}

function requireHelpers() {
  if (!helpers) {
    throw new Error('database_helpers_not_loaded');
  }
  return helpers;
}

function getOne<T>(sql: string, params?: Record<string, unknown>) {
  return requireHelpers().getOne<T>(sql, params as never);
}

function run(sql: string, params?: Record<string, unknown>) {
  return requireHelpers().run(sql, params as never);
}

function nowIso() {
  return requireHelpers().nowIso();
}

function createModerationTask(targetType: 'post', targetId: string, action: string, note?: string) {
  return requireHelpers().createModerationTask(targetType, targetId, action, note);
}

interface NewsSource {
  id: string;
  name: string;
  url: string;
  baseUrl: string;
  allowedHosts: string[];
  scopeLabel: string;
}

interface NewsItem {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  tags: string[];
}

const sources: NewsSource[] = [
  {
    id: 'ncss-cy',
    name: '全国大学生创业服务网',
    url: 'https://cy.ncss.cn/',
    baseUrl: 'https://cy.ncss.cn',
    allowedHosts: ['cy.ncss.cn'],
    scopeLabel: '国内官方竞赛',
  },
];

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const productionConfirmed = args.has('--confirm-production');
const limitArg = process.argv.find((item) => item.startsWith('--limit='));
const limit = Math.max(1, Number(limitArg?.replace('--limit=', '') || 8));

function digest(input: string) {
  return createHash('sha1').update(input).digest('hex').slice(0, 14);
}

function decodeHtml(input: string) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(input: string) {
  return decodeHtml(input.replace(/<[^>]*>/g, ''));
}

function absoluteUrl(source: NewsSource, href: string) {
  return new URL(href, source.baseUrl).toString();
}

function isAllowedOfficialDomesticUrl(source: NewsSource, url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && source.allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function inferTags(title: string) {
  const tags = new Set<string>(['官方通知', '白名单竞赛']);

  if (/创新|创业|互联网\+|国际大学生创新大赛/.test(title)) {
    tags.add('创新创业');
  }
  if (/获奖|公示|名单/.test(title)) {
    tags.add('结果公示');
  }
  if (/报名|参赛|启动|报送/.test(title)) {
    tags.add('报名通知');
  }
  if (/通知|公告/.test(title)) {
    tags.add('通知公告');
  }
  if (/就业|招聘|人才/.test(title)) {
    tags.add('就业服务');
  }

  return [...tags].slice(0, 4);
}

function isRelevantTitle(title: string) {
  const officialCompetitionSignal = /中国国际大学生创新大赛|挑战杯|全国大学生|大学生创新|大学生创业/.test(title);
  const operationalSignal = /大赛|竞赛|参赛|报名|报送|获奖|公示|通知|名单|总决赛/.test(title);
  return officialCompetitionSignal && operationalSignal;
}

function parseNcssHome(html: string, source: NewsSource) {
  const items: NewsItem[] = [];
  const pattern =
    /<a\s+href="(?<href>\/information\/(?!dsdt)[^"?]+)"[^>]*>[\s\S]*?<h2\s+class="dynamics-text-title">(?<title>[\s\S]*?)<\/h2>/g;

  for (const match of html.matchAll(pattern)) {
    const href = match.groups?.href;
    const rawTitle = match.groups?.title;
    if (!href || !rawTitle) {
      continue;
    }

    const title = stripTags(rawTitle);
    if (!title || !isRelevantTitle(title)) {
      continue;
    }

    const url = absoluteUrl(source, href);
    if (!isAllowedOfficialDomesticUrl(source, url)) {
      continue;
    }

    items.push({
      id: `news_${digest(url)}`,
      sourceId: source.id,
      sourceName: source.name,
      title,
      url,
      tags: inferTags(title),
    });
  }

  return items;
}

async function fetchSource(source: NewsSource) {
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'campus-growth-news-sync/0.1 (+https://campusgrow.top)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`${source.id} returned HTTP ${response.status}`);
  }

  const html = await response.text();
  if (source.id === 'ncss-cy') {
    return parseNcssHome(html, source);
  }

  return [];
}

function upsertNewsPost(item: NewsItem) {
  const existing = getOne<{
    id: string;
    title: string;
    excerpt: string;
    content_json: string;
    tags_json: string;
    moderation_status: string;
  }>(
    'SELECT id, title, excerpt, content_json, tags_json, moderation_status FROM posts WHERE id = @id',
    { id: item.id }
  );
  const now = nowIso();
  const content = [
    item.title,
    `来源：${item.sourceName}`,
    `原文：${item.url}`,
    '平台仅做国内官方竞赛信息索引，发布前需由后台人工确认。',
    '请以官方原文和学校通知为准。',
  ];
  const excerpt = `${item.sourceName}：${item.title}`.slice(0, 96);
  const contentJson = JSON.stringify(content);
  const tagsJson = JSON.stringify(item.tags);

  if (existing) {
    if (
      existing.title === item.title &&
      existing.excerpt === excerpt &&
      existing.content_json === contentJson &&
      existing.tags_json === tagsJson
    ) {
      return 'unchanged';
    }
    run(
      `
        UPDATE posts
        SET title = @title,
            excerpt = @excerpt,
            content_json = @contentJson,
            tags_json = @tagsJson,
            school_id = NULL,
            content_scope = 'platform',
            moderation_status = 'pending',
            updated_at = @updatedAt
        WHERE id = @id
      `,
      {
        id: item.id,
        title: item.title,
        excerpt,
        contentJson,
        tagsJson,
        updatedAt: now,
      }
    );
    const queued = ensureReviewTask(item);
    return queued ? 'queued' : 'pending';
  }

  run(
    `
      INSERT INTO posts (
        id, school_id, content_scope, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
        likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
        moderation_status, created_at, updated_at
      ) VALUES (
        @id, NULL, 'platform', @title, @excerpt, @contentJson, '资讯', NULL, @authorName, '讯',
        0, 0, @tagsJson, '今日', NULL, NULL, 'pending', @createdAt, @updatedAt
      )
    `,
    {
      id: item.id,
      title: item.title,
      excerpt,
      contentJson,
      authorName: item.sourceName,
      tagsJson,
      createdAt: now,
      updatedAt: now,
    }
  );
  ensureReviewTask(item);
  return 'queued';
}

function ensureReviewTask(item: NewsItem) {
  const existingTask = getOne<{ id: string }>(
    `
      SELECT id
      FROM moderation_tasks
      WHERE target_type = 'post'
        AND target_id = @targetId
        AND action = 'post_publish_review'
        AND status IN ('pending', 'processing')
      LIMIT 1
    `,
    { targetId: item.id }
  );

  if (existingTask) {
    return false;
  }

  createModerationTask(
    'post',
    item.id,
    'post_publish_review',
    `官方竞赛资讯待审核：${item.sourceName} / ${item.title}`
  );
  return true;
}

async function main() {
  const fetched = (
    await Promise.all(
      sources.map(async (source) => {
        try {
          return await fetchSource(source);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[${source.id}] ${message}`);
          return [];
        }
      })
    )
  ).flat();

  const unique = new Map<string, NewsItem>();
  for (const item of fetched) {
    unique.set(item.id, item);
  }

  const items = [...unique.values()].slice(0, limit);

  if (!shouldApply) {
    console.log(JSON.stringify({ mode: 'dry-run', scope: sources.map((item) => item.scopeLabel), count: items.length, items }, null, 2));
    console.log('Use --apply to write these items into the moderation queue.');
    return;
  }

  await loadDatabaseHelpers();
  const { serverConfig } = await import('../server/config.ts');
  if (serverConfig.databaseProvider === 'postgres' && !productionConfirmed) {
    throw new Error('production_confirmation_required');
  }

  const result = { queued: 0, pending: 0, unchanged: 0 };
  for (const item of items) {
    const status = upsertNewsPost(item);
    result[status] += 1;
  }

  console.log(JSON.stringify({ mode: 'apply', ...result }, null, 2));
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
