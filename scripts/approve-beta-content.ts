import 'dotenv/config';

type ApiResult<T> = {
  code: number;
  message: string;
  data: T;
};

type ModerationTask = {
  id: string;
  targetType: 'post' | 'comment' | 'team' | 'report' | 'resource';
  targetId: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
};

type CompetitionItem = {
  id: string;
  title: string;
};

type ResourceItem = {
  id: string;
  title: string;
};

type PostItem = {
  id: string;
  title: string;
};

type HomeBannerItem = {
  id: string;
  badge: string;
  title: string;
  imageUrl: string;
  link: string;
};

type HomeQuickLinkItem = {
  id: 'competitions' | 'resources' | 'teams' | 'community' | 'ai';
  enabled: boolean;
};

type HomeFeedConfig = {
  heroBadge: string;
  heroPrompt: string;
  heroImageUrl: string;
  banners: HomeBannerItem[];
  quickLinks: HomeQuickLinkItem[];
  publishStatus: 'draft' | 'scheduled' | 'online' | 'offline';
  publishAt?: string;
  offlineAt?: string;
  competitionLimit: number;
  resourceLimit: number;
  teamLimit: number;
  postLimit: number;
  competitionIds: string[];
  resourceIds: string[];
  teamIds: string[];
  postIds: string[];
  updatedAt?: string;
  effectiveStatus?: 'draft' | 'scheduled' | 'online' | 'offline';
};

const apiBaseUrl =
  process.env.BETA_APPROVAL_API_BASE_URL ||
  process.env.SMOKE_API_BASE_URL ||
  (process.env.API_PUBLIC_ORIGIN
    ? `${process.env.API_PUBLIC_ORIGIN}${process.env.API_BASE_PATH || '/api'}`
    : `http://127.0.0.1:${process.env.API_PORT || '8080'}${process.env.API_BASE_PATH || '/api'}`);

const adminUsername = process.env.ADMIN_BOOTSTRAP_USERNAME;
const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const userAgent = 'campus-growth-beta-approval/20260706';

const selectedCompetitionIds = [
  'wl_china_innovation',
  'wl_tiaozhanbei_research',
  'wl_mcm',
  'wl_nuedc',
  'wl_computer_design',
  'wl_lanqiao',
];

const selectedResourceIds = [
  'official_resource_whitelist_catalog',
  'official_resource_wl_china_innovation',
  'official_resource_wl_tiaozhanbei_research',
  'official_resource_wl_mcm',
  'official_resource_wl_nuedc',
  'official_resource_wl_computer_design',
  'official_resource_wl_lanqiao',
  'official_resource_wl_smart_car',
];

const selectedPostIds = [
  'official_post_how_to_use_whitelist',
  'official_post_innovation_prepare',
  'official_post_programming_track',
  'official_post_hardware_track',
  'official_post_material_checklist',
  'official_post_schedule_check',
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function withQuery(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    expectedStatus?: number;
  } = {},
) {
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
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
  if (payload.code !== 0) {
    throw new Error(`API ${payload.code} for ${path}: ${payload.message}`);
  }
  return payload.data;
}

async function loginAdmin() {
  assert(adminUsername && adminPassword, 'ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD are required');
  return request<{ token: string }>('/admin/auth/login', {
    method: 'POST',
    body: { username: adminUsername, password: adminPassword },
  });
}

async function approveSelectedTasks(adminToken: string, targetType: 'resource' | 'post', selectedIds: string[]) {
  const tasks = await request<ModerationTask[]>(withQuery('/moderation/tasks', { targetType }), {
    token: adminToken,
  });
  const selected = new Set(selectedIds);
  const approved: string[] = [];
  const alreadyDone: string[] = [];
  const missing: string[] = [];

  for (const targetId of selectedIds) {
    const task = tasks.find((item) => item.targetId === targetId);
    if (!task) {
      missing.push(targetId);
      continue;
    }
    if (task.status === 'approved') {
      alreadyDone.push(targetId);
      continue;
    }
    if (!selected.has(task.targetId)) {
      continue;
    }
    await request(`/moderation/tasks/${task.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'approved',
        note: '上线前精选官方来源，已核对入口。',
      },
    });
    approved.push(targetId);
  }

  return { approved, alreadyDone, missing };
}

function filterExistingIds<T extends { id: string }>(items: T[], selectedIds: string[]) {
  const existing = new Set(items.map((item) => item.id));
  return selectedIds.filter((id) => existing.has(id));
}

function buildBanners(current: HomeFeedConfig): HomeBannerItem[] {
  const fallbackImages = current.banners.length > 0 ? current.banners.map((item) => item.imageUrl) : [];
  const campusImage =
    fallbackImages[0] ||
    'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?auto=format&fit=crop&w=1080&q=80';
  const competitionImage =
    fallbackImages[1] || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80';
  const resourceImage =
    fallbackImages[2] || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80';

  return [
    {
      id: 'banner-beta',
      badge: '推荐',
      title: '查竞赛，找资料，约队友。',
      imageUrl: campusImage,
      link: '/',
    },
    {
      id: 'banner-whitelist',
      badge: '白名单竞赛',
      title: '先看目录，再看官网通知。',
      imageUrl: competitionImage,
      link: '/competitions',
    },
    {
      id: 'banner-resources',
      badge: '资料入口',
      title: '官方入口和备赛清单。',
      imageUrl: resourceImage,
      link: '/resources',
    },
  ];
}

async function updateHome(adminToken: string) {
  const [current, competitions, resources, posts] = await Promise.all([
    request<HomeFeedConfig>('/admin/home-config', { token: adminToken }),
    request<CompetitionItem[]>(withQuery('/competitions', { limit: 100 })),
    request<ResourceItem[]>(withQuery('/resources', { limit: 100, priceType: '免费' })),
    request<PostItem[]>('/posts'),
  ]);

  const competitionIds = filterExistingIds(competitions, selectedCompetitionIds);
  const resourceIds = filterExistingIds(resources, selectedResourceIds);
  const postIds = filterExistingIds(posts, selectedPostIds);
  const banners = buildBanners(current);

  const next: HomeFeedConfig = {
    ...current,
    heroBadge: banners[0].badge,
    heroPrompt: banners[0].title,
    heroImageUrl: banners[0].imageUrl,
    banners,
    quickLinks: [
      { id: 'competitions', enabled: true },
      { id: 'resources', enabled: true },
      { id: 'teams', enabled: true },
      { id: 'community', enabled: true },
      { id: 'ai', enabled: false },
    ],
    publishStatus: 'online',
    publishAt: '',
    offlineAt: '',
    competitionLimit: Math.min(4, Math.max(1, competitionIds.length || 1)),
    resourceLimit: Math.min(4, Math.max(1, resourceIds.length || 1)),
    teamLimit: current.teamLimit || 2,
    postLimit: Math.min(4, Math.max(1, postIds.length || 1)),
    competitionIds,
    resourceIds,
    teamIds: current.teamIds || [],
    postIds,
  };

  const result = await request<HomeFeedConfig>('/admin/home-config', {
    method: 'PATCH',
    token: adminToken,
    body: next,
  });

  return {
    competitionIds,
    resourceIds,
    postIds,
    effectiveStatus: result.effectiveStatus || result.publishStatus,
  };
}

async function main() {
  const admin = await loginAdmin();
  const resourceResult = await approveSelectedTasks(admin.token, 'resource', selectedResourceIds);
  const postResult = await approveSelectedTasks(admin.token, 'post', selectedPostIds);
  const homeResult = await updateHome(admin.token);

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        resources: resourceResult,
        posts: postResult,
        home: homeResult,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
