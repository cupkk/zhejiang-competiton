import type { NotificationItem, SearchScope } from '../types/entities';

export const PAGE_PATHS = {
  home: 'pages/home/index',
  competitions: 'pages/competitions/index',
  resources: 'pages/resources/index',
  community: 'pages/community/index',
  profile: 'pages/profile/index',
  favorites: 'pages/favorites/index',
  competitionDetail: 'pages/competition-detail/index',
  resourceDetail: 'pages/resource-detail/index',
  teamDetail: 'pages/team-detail/index',
  ai: 'pages/ai/index',
  postDetail: 'pages/post-detail/index',
  search: 'pages/search/index',
  login: 'pages/login/index',
  teams: 'pages/teams/index',
  publishTeam: 'pages/publish-team/index',
  publishPost: 'pages/publish-post/index',
  messages: 'pages/messages/index',
  myResources: 'pages/my-resources/index',
  orders: 'pages/orders/index',
  refundResult: 'pages/refund-result/index',
} as const;

export const PAGE_ROUTES = {
  home: `/${PAGE_PATHS.home}`,
  competitions: `/${PAGE_PATHS.competitions}`,
  resources: `/${PAGE_PATHS.resources}`,
  community: `/${PAGE_PATHS.community}`,
  profile: `/${PAGE_PATHS.profile}`,
  favorites: `/${PAGE_PATHS.favorites}`,
  competitionDetail: `/${PAGE_PATHS.competitionDetail}`,
  resourceDetail: `/${PAGE_PATHS.resourceDetail}`,
  teamDetail: `/${PAGE_PATHS.teamDetail}`,
  ai: `/${PAGE_PATHS.ai}`,
  postDetail: `/${PAGE_PATHS.postDetail}`,
  search: `/${PAGE_PATHS.search}`,
  login: `/${PAGE_PATHS.login}`,
  teams: `/${PAGE_PATHS.teams}`,
  publishTeam: `/${PAGE_PATHS.publishTeam}`,
  publishPost: `/${PAGE_PATHS.publishPost}`,
  messages: `/${PAGE_PATHS.messages}`,
  myResources: `/${PAGE_PATHS.myResources}`,
  orders: `/${PAGE_PATHS.orders}`,
  refundResult: `/${PAGE_PATHS.refundResult}`,
} as const;

export const APP_PAGE_LIST = [
  PAGE_PATHS.home,
  PAGE_PATHS.competitions,
  PAGE_PATHS.resources,
  PAGE_PATHS.community,
  PAGE_PATHS.profile,
  PAGE_PATHS.favorites,
  PAGE_PATHS.competitionDetail,
  PAGE_PATHS.resourceDetail,
  PAGE_PATHS.teamDetail,
  PAGE_PATHS.ai,
  PAGE_PATHS.postDetail,
  PAGE_PATHS.search,
  PAGE_PATHS.login,
  PAGE_PATHS.teams,
  PAGE_PATHS.publishTeam,
  PAGE_PATHS.publishPost,
  PAGE_PATHS.messages,
  PAGE_PATHS.myResources,
  PAGE_PATHS.orders,
  PAGE_PATHS.refundResult,
] as const;

export const TAB_BAR_ITEMS = [
  { pagePath: PAGE_PATHS.home, text: '首页' },
  { pagePath: PAGE_PATHS.competitions, text: '竞赛' },
  { pagePath: PAGE_PATHS.resources, text: '资源' },
  { pagePath: PAGE_PATHS.community, text: '社区' },
  { pagePath: PAGE_PATHS.profile, text: '我的' },
] as const;

function buildQueryString(query: Record<string, string | number | boolean | undefined>) {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length === 0) {
    return '';
  }

  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function withQuery(path: string, query: Record<string, string | number | boolean | undefined>) {
  const queryString = buildQueryString(query);
  return queryString ? `${path}?${queryString}` : path;
}

export function buildCompetitionDetailRoute(id?: string) {
  return withQuery(PAGE_ROUTES.competitionDetail, { id });
}

export function buildResourceDetailRoute(id?: string) {
  return withQuery(PAGE_ROUTES.resourceDetail, { id });
}

export function buildTeamDetailRoute(id?: string) {
  return withQuery(PAGE_ROUTES.teamDetail, { id });
}

export function buildPostDetailRoute(
  id?: string,
  params: {
    commentId?: string;
  } = {}
) {
  return withQuery(PAGE_ROUTES.postDetail, { id, commentId: params.commentId });
}

export function buildSearchRoute(params: { scope?: SearchScope; keyword?: string } = {}) {
  return withQuery(PAGE_ROUTES.search, params);
}

export function buildRefundResultRoute(id?: string) {
  return withQuery(PAGE_ROUTES.refundResult, { id });
}

export function buildFavoritesRoute(params: { scope?: string } = {}) {
  return withQuery(PAGE_ROUTES.favorites, params);
}

export function buildAiRoute(params: { source?: string; id?: string } = {}) {
  return withQuery(PAGE_ROUTES.ai, params);
}

export function buildPublishTeamRoute(params: {
  compId?: string;
  compName?: string;
  mine?: boolean;
} = {}) {
  return withQuery(PAGE_ROUTES.publishTeam, params);
}

export function buildTeamsRoute(params: { mine?: boolean } = {}) {
  return withQuery(PAGE_ROUTES.teams, params);
}

export function buildMessageTargetRoute(
  target: Pick<NotificationItem, 'linkType' | 'linkId' | 'linkScene' | 'commentId'>
) {
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
    return target.linkScene === 'refund_result' ? buildRefundResultRoute(target.linkId) : PAGE_ROUTES.orders;
  }

  return buildPostDetailRoute(target.linkId, { commentId: target.commentId });
}
