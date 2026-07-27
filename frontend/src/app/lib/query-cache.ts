const cachePrefix = 'campus-growth:data-cache:v2:';
const defaultTtlMs = 5 * 60 * 1000;

interface CachedRecord<T> {
  value: T;
  ts: number;
}

const memoryCache = new Map<string, CachedRecord<unknown>>();

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function isFresh(record: CachedRecord<unknown>, ttlMs: number) {
  return Date.now() - record.ts <= ttlMs;
}

export function readCachedData<T>(key?: string, ttlMs = defaultTtlMs, allowStale = false): T | undefined {
  if (!key) {
    return undefined;
  }

  const memoryRecord = memoryCache.get(key);
  if (memoryRecord && (allowStale || isFresh(memoryRecord, ttlMs))) {
    return memoryRecord.value as T;
  }

  if (memoryRecord) {
    return undefined;
  }

  if (!canUseSessionStorage()) {
    return undefined;
  }

  try {
    const raw = window.sessionStorage.getItem(`${cachePrefix}${key}`);
    if (!raw) {
      return undefined;
    }

    const record = JSON.parse(raw) as CachedRecord<T>;
    if (!record || typeof record.ts !== 'number') {
      window.sessionStorage.removeItem(`${cachePrefix}${key}`);
      return undefined;
    }
    if (!allowStale && !isFresh(record, ttlMs)) {
      return undefined;
    }

    memoryCache.set(key, record as CachedRecord<unknown>);
    return record.value;
  } catch {
    return undefined;
  }
}

export function writeCachedData<T>(key: string | undefined, value: T) {
  if (!key) {
    return;
  }

  const record: CachedRecord<T> = { value, ts: Date.now() };
  memoryCache.set(key, record as CachedRecord<unknown>);

  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(`${cachePrefix}${key}`, JSON.stringify(record));
  } catch {
    // WebView storage quota can be tight. Memory cache still covers route back/forward.
  }
}

export function clearDataCache() {
  memoryCache.clear();

  if (!canUseSessionStorage()) {
    return;
  }

  try {
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index)).filter(
      (key): key is string => Boolean(key?.startsWith('campus-growth:data-cache:')),
    );
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Ignore storage cleanup errors.
  }
}

function normalizeCachePart(value?: string | number | boolean | null) {
  return encodeURIComponent(String(value ?? ''));
}

export const dataCacheKeys = {
  homeFeed: () => 'feed:home',
  competitionsList: (query: { keyword?: string; category?: string; level?: string; sort?: string }) =>
    `competitions:list:${normalizeCachePart(query.keyword)}:${normalizeCachePart(query.category)}:${normalizeCachePart(query.level)}:${normalizeCachePart(query.sort)}`,
  competitionDetail: (id: string) => `competitions:detail:${normalizeCachePart(id)}`,
  competitionResources: (id: string) => `competitions:resources:${normalizeCachePart(id)}`,
  competitionTeams: (id: string) => `competitions:teams:${normalizeCachePart(id)}`,
  competitionPosts: (id: string) => `competitions:posts:${normalizeCachePart(id)}`,
  resourcesList: (query: { keyword?: string; category?: string; priceType?: string }) =>
    `resources:list:${normalizeCachePart(query.keyword)}:${normalizeCachePart(query.category)}:${normalizeCachePart(query.priceType)}`,
  resourceDetail: (id: string) => `resources:detail:${normalizeCachePart(id)}`,
  resourceRelated: (id: string) => `resources:related:${normalizeCachePart(id)}`,
  postsList: (query: { keyword?: string; category?: string; questionFilter?: string }) =>
    `posts:list:${normalizeCachePart(query.keyword)}:${normalizeCachePart(query.category)}:${normalizeCachePart(query.questionFilter)}`,
  postDetail: (id: string) => `posts:detail:${normalizeCachePart(id)}`,
  postComments: (id: string) => `posts:comments:${normalizeCachePart(id)}`,
  teamsList: (query: { keyword?: string; listingType?: string; mineOnly?: boolean; showcase?: boolean; schoolScope?: string }) =>
    `teams:list:${normalizeCachePart(query.keyword)}:${normalizeCachePart(query.listingType)}:${normalizeCachePart(query.mineOnly)}:${normalizeCachePart(query.showcase)}:${normalizeCachePart(query.schoolScope)}`,
  teamDetail: (id: string) => `teams:detail:${normalizeCachePart(id)}`,
};
