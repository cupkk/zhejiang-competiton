import type { NotificationItem, SearchScope } from '../../types/entities';

export const routes = {
  home: '/',
  competitions: '/competitions',
  resources: '/resources',
  community: '/community',
  profile: '/profile',
  checkin: '/checkin',
  profileEdit: '/profile/edit',
  schools: '/schools',
  schoolVerify: '/school-verify',
  myActivity: '/my-activity',
  history: '/history',
  accountSettings: '/account-settings',
  competitionDetail: '/competitions/:id',
  resourceDetail: '/resources/:id',
  teams: '/teams',
  teamDetail: '/teams/:id',
  postDetail: '/posts/:id',
  search: '/search',
  login: '/login',
  messages: '/messages',
  favorites: '/favorites',
  myResources: '/my-resources',
  publishResource: '/publish-resource',
  resourceSubmissions: '/resource-submissions',
  orders: '/orders',
  refundResult: '/orders/:id/refund',
  publishTeam: '/publish-team',
  publishPost: '/publish-post',
  ai: '/ai',
  adminLogin: '/admin/login',
  admin: '/admin',
  adminHome: '/admin/home',
  adminSchoolHome: '/admin/school-home',
  adminSchools: '/admin/schools',
  adminAudit: '/admin/audit',
  adminModeration: '/admin/moderation',
  adminReports: '/admin/reports',
  adminResources: '/admin/resources',
  adminCompetitions: '/admin/competitions',
  adminResourceNew: '/admin/resources/new',
} as const;

const internalRouteOrigin = 'https://campus-growth.invalid';
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function decodeRouteLayers(value: string) {
  let decoded = value;

  for (let index = 0; index < 8; index += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) return decoded;
    decoded = next;
  }

  try {
    return decodeURIComponent(decoded) === decoded ? decoded : null;
  } catch {
    return null;
  }
}

export function normalizeInternalRoute(value: string | null | undefined, fallback: string = routes.home) {
  if (!value || value !== value.trim()) return fallback;

  const decoded = decodeRouteLayers(value);
  if (
    !decoded ||
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    controlCharacterPattern.test(decoded)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(decoded, internalRouteOrigin);
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (parsed.origin !== internalRouteOrigin || normalized.startsWith('//') || normalized.includes('\\')) {
      return fallback;
    }
    return normalized;
  } catch {
    return fallback;
  }
}

function buildQueryString(query: Record<string, string | number | boolean | undefined>) {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== '');
  const params = new URLSearchParams(entries.map(([key, value]) => [key, String(value)]));
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export function buildCompetitionDetailRoute(id?: string) {
  return id ? `/competitions/${id}` : routes.competitions;
}

export function buildResourceDetailRoute(id?: string) {
  return id ? `/resources/${id}` : routes.resources;
}

export function buildTeamDetailRoute(id?: string) {
  return id ? `/teams/${id}` : routes.teams;
}

export function buildPostDetailRoute(id?: string, params: { commentId?: string } = {}) {
  return id ? `/posts/${id}${buildQueryString(params)}` : routes.community;
}

export function buildSearchRoute(params: { scope?: SearchScope; keyword?: string } = {}) {
  return `${routes.search}${buildQueryString(params)}`;
}

export function buildRefundResultRoute(id?: string) {
  return id ? `/orders/${id}/refund` : routes.orders;
}

export function buildFavoritesRoute(params: { scope?: string } = {}) {
  return `${routes.favorites}${buildQueryString(params)}`;
}

export function buildAiRoute(params: { source?: string; id?: string } = {}) {
  return `${routes.ai}${buildQueryString(params)}`;
}

export function buildPublishTeamRoute(params: { compId?: string; compName?: string; type?: string } = {}) {
  return `${routes.publishTeam}${buildQueryString(params)}`;
}

export function buildTeamsRoute(params: { mine?: boolean; type?: string } = {}) {
  return `${routes.teams}${buildQueryString(params)}`;
}

export function buildSchoolSelectRoute(params: { next?: string } = {}) {
  return `${routes.schools}${buildQueryString(params)}`;
}

export function buildSchoolVerifyRoute(params: { next?: string } = {}) {
  return `${routes.schoolVerify}${buildQueryString(params)}`;
}

export function buildLoginRoute(next?: string) {
  return `${routes.login}${buildQueryString({ next })}`;
}

export function buildAdminLoginRoute(next?: string) {
  return `${routes.adminLogin}${buildQueryString({ next })}`;
}

export function buildMessageTargetRoute(target: Pick<NotificationItem, 'linkType' | 'linkId' | 'linkScene' | 'commentId'>) {
  if (!target.linkId) {
    return '';
  }

  if (target.linkType === 'competition') {
    return buildCompetitionDetailRoute(target.linkId);
  }

  if (target.linkType === 'resource') {
    return buildResourceDetailRoute(target.linkId);
  }

  if (target.linkType === 'team') {
    return buildTeamDetailRoute(target.linkId);
  }

  if (target.linkType === 'order') {
    return target.linkScene === 'refund_result' ? buildRefundResultRoute(target.linkId) : routes.orders;
  }

  return buildPostDetailRoute(target.linkId, { commentId: target.commentId });
}
