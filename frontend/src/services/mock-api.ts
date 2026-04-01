import {
  COMMON_FILTER_ALL,
  COMMON_FREE_LABEL,
  COMPETITION_SORT_OPTIONS,
  MESSAGE_CATEGORY_OPTIONS,
  ORDER_STATUS_OPTIONS,
  POST_CATEGORY_OPTIONS,
  RESOURCE_PRICE_OPTIONS,
  TEAM_RECRUIT_STATUS_OPTIONS,
} from '../constants/enums';
import {
  buildCompetitionDetailRoute,
  buildPostDetailRoute,
  buildResourceDetailRoute,
  buildTeamDetailRoute,
} from '../constants/routes';
import {
  competitions,
  getCompetitionById,
  getMyTeams,
  getPostById,
  getResourceById,
  getResourcesForCompetition,
  getTeamById,
  getTeamsForCompetition,
  notifications,
  orders,
  ownedResources,
  posts,
  resources,
  searchSuggestions,
  teams,
  userProfile,
} from '../data/mock';
import type {
  AiConversationBootstrap,
  AiReplyResult,
  Competition,
  FavoriteCollection,
  HomeFeed,
  NotificationItem,
  OrderItem,
  OwnedResourceItem,
  PostCommentItem,
  PostItem,
  ResourceAccessStatus,
  ResourceItem,
  SearchResultItem,
  SearchSuggestion,
  TeamApplicationStatus,
  TeamItem,
  UserProfile,
} from '../types/entities';
import type {
  AiBootstrapQuery,
  AiReplyPayload,
  CommentMutationResult,
  CommentPayload,
  CompetitionEnrollmentResult,
  CompetitionQuery,
  FavoriteQuery,
  FavoriteMutationResult,
  LikeMutationResult,
  LoginSession,
  MessageQuery,
  NotificationBatchReadPayload,
  NotificationBatchReadResult,
  NotificationReadResult,
  OrderPayResult,
  OrderRefundPayload,
  OrderRefundResult,
  PostQuery,
  PublishPostPayload,
  PublishTeamPayload,
  ReportPayload,
  ReportResult,
  ResourceAcquirePayload,
  ResourceAcquireResult,
  ResourceDownloadResult,
  ResourceQuery,
  SearchQuery,
  TeamApplicationPayload,
  TeamApplicationResult,
  TeamQuery,
  ToggleFavoritePayload,
} from '../types/api';

const ORDER_STATUS_COMPLETED = ORDER_STATUS_OPTIONS[0];
const ORDER_STATUS_PENDING = ORDER_STATUS_OPTIONS[1];
const ORDER_STATUS_REFUNDING = ORDER_STATUS_OPTIONS[2];
const ORDER_STATUS_REFUNDED = ORDER_STATUS_OPTIONS[3];
const TEAM_STATUS_RECRUITING = TEAM_RECRUIT_STATUS_OPTIONS[0];
const POST_CATEGORY_RECOMMENDED = POST_CATEGORY_OPTIONS[0];
const MESSAGE_CATEGORY_ALL = MESSAGE_CATEGORY_OPTIONS[0];

function simulate<T>(data: T, timeout = 80): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), timeout);
  });
}

function nowDateLabel() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeLabel() {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return `今天 ${time.slice(0, 5)}`;
}

function cloneCompetition(item: Competition): Competition {
  return {
    ...item,
    tags: [...item.tags],
    recommendedFor: [...item.recommendedFor],
    actionHints: [...item.actionHints],
    viewer: item.viewer ? { ...item.viewer } : undefined,
  };
}

function cloneResource(item: ResourceItem): ResourceItem {
  return {
    ...item,
    tags: [...item.tags],
    previewPoints: [...item.previewPoints],
    relatedCompetitionIds: [...item.relatedCompetitionIds],
    viewer: item.viewer ? { ...item.viewer } : undefined,
  };
}

function cloneTeam(item: TeamItem): TeamItem {
  return {
    ...item,
    missingRoles: [...item.missingRoles],
    requirements: [...item.requirements],
    viewer: item.viewer ? { ...item.viewer } : undefined,
  };
}

function clonePost(item: PostItem): PostItem {
  return {
    ...item,
    content: [...item.content],
    tags: [...item.tags],
    viewer: item.viewer ? { ...item.viewer } : undefined,
  };
}

function cloneOwnedResource(item: OwnedResourceItem): OwnedResourceItem {
  return {
    ...item,
    tags: [...item.tags],
  };
}

function cloneOrder(item: OrderItem): OrderItem {
  return { ...item };
}

function cloneNotification(item: NotificationItem): NotificationItem {
  return { ...item };
}

function buildMockUserProfile(): UserProfile {
  return {
    ...userProfile,
    focusTags: [...userProfile.focusTags],
    stats: {
      favorites: favoriteCompetitionIds.size + favoriteResourceIds.size + favoritePostIds.size,
      teams: getMyTeams().length + appliedTeamIds.size,
      resources: ownedResources.length,
      unreadMessages: notifications.filter((item) => item.unread).length,
    },
  };
}

function buildFavoriteCollection(scope: FavoriteQuery['scope'] = 'all'): FavoriteCollection {
  const includeCompetitions = scope === 'all' || scope === 'competition';
  const includeResources = scope === 'all' || scope === 'resource';
  const includePosts = scope === 'all' || scope === 'post';

  return {
    competitions: includeCompetitions
      ? sortByFavoriteTime(
          competitions.filter((item) => favoriteCompetitionIds.has(item.id)).map(decorateCompetition),
          (id) => getFavoriteTime(favoriteCompetitionTimeline, id)
        )
      : [],
    resources: includeResources
      ? sortByFavoriteTime(
          resources.filter((item) => favoriteResourceIds.has(item.id)).map(decorateResource),
          (id) => getFavoriteTime(favoriteResourceTimeline, id)
        )
      : [],
    posts: includePosts
      ? sortByFavoriteTime(
          posts.filter((item) => favoritePostIds.has(item.id)).map(decoratePost),
          (id) => getFavoriteTime(favoritePostTimeline, id)
        )
      : [],
  };
}

const favoriteCompetitionIds = new Set<string>(['c2']);
const enrolledCompetitionIds = new Set<string>();
const favoriteResourceIds = new Set<string>(['r1']);
const favoritePostIds = new Set<string>();
const favoriteCompetitionTimeline = new Map<string, string>([['c2', '2026-03-29T20:15:00.000Z']]);
const favoriteResourceTimeline = new Map<string, string>([['r1', '2026-03-28T09:20:00.000Z']]);
const favoritePostTimeline = new Map<string, string>();
const likedPostIds = new Set<string>(['p1']);
const likedCommentIds = new Set<string>(['pc1']);
const appliedTeamIds = new Set<string>();
const refundTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getFavoriteTime(map: Map<string, string>, id: string) {
  return map.get(id);
}

function rememberFavoriteTime(map: Map<string, string>, id: string) {
  map.set(id, new Date().toISOString());
}

function forgetFavoriteTime(map: Map<string, string>, id: string) {
  map.delete(id);
}

function sortByFavoriteTime<T extends { id: string }>(
  items: T[],
  getTime: (id: string) => string | undefined
) {
  return [...items].sort((left, right) => (getTime(right.id) || '').localeCompare(getTime(left.id) || ''));
}

const postCommentsStore: Record<string, PostCommentItem[]> = {
  p1: [
    {
      id: 'pc1',
      postId: 'p1',
      authorName: '产品复盘生',
      authorMark: '复',
      content: '这套拆解很实用，尤其是先搭材料骨架这一步，确实能少走很多弯路。',
      likes: 18,
      status: 'approved',
      createdAt: '1 小时前',
      viewer: { isLiked: true },
    },
    {
      id: 'pc1r1',
      postId: 'p1',
      parentCommentId: 'pc1',
      replyToCommentId: 'pc1',
      replyToAuthorName: '产品复盘生',
      authorName: userProfile.name,
      authorMark: userProfile.mark,
      content: '我也是这样整理的，先把材料骨架搭起来，后面每一版都会轻松很多。',
      likes: 4,
      status: 'approved',
      createdAt: '20 分钟前',
      viewer: { isLiked: false },
    },
    {
      id: 'pc2',
      postId: 'p1',
      authorName: '答辩焦虑人',
      authorMark: '答',
      content: '想问一下你们中期答辩的时候，PPT 和计划书是谁主导整合的？',
      likes: 6,
      status: 'approved',
      createdAt: '35 分钟前',
      viewer: { isLiked: false },
    },
  ],
  p2: [
    {
      id: 'pc3',
      postId: 'p2',
      authorName: '前端练级中',
      authorMark: '前',
      content: '情绪稳定这条太真实了，赶工阶段真的比技术细节更影响整体结果。',
      likes: 11,
      status: 'approved',
      createdAt: '今天 10:12',
      viewer: { isLiked: false },
    },
  ],
  p3: [],
};

function getPostCommentsById(postId: string) {
  return postCommentsStore[postId] ?? [];
}

function findFlatCommentById(commentId: string) {
  for (const items of Object.values(postCommentsStore)) {
    const target = items.find((item) => item.id === commentId);
    if (target) {
      return target;
    }
  }

  return null;
}

function buildCommentThread(postId: string): PostCommentItem[] {
  const list: PostCommentItem[] = getPostCommentsById(postId)
    .map((item) => ({
      ...item,
      viewer: {
        isLiked: likedCommentIds.has(item.id),
      },
      replies: [] as PostCommentItem[],
      replyCount: 0,
    }))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const map = new Map(list.map((item) => [item.id, item]));
  const roots: PostCommentItem[] = [];

  list.forEach((item) => {
    if (item.parentCommentId) {
      const parent = map.get(item.parentCommentId);
      if (parent) {
        parent.replies = [...(parent.replies ?? []), item];
        parent.replyCount = (parent.replyCount ?? 0) + 1;
        return;
      }
    }

    roots.push(item);
  });

  return roots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function updatePostCommentMetrics(postId: string) {
  const post = getPostById(postId);
  post.comments = getPostCommentsById(postId).length;
}

function decorateCompetition(item: Competition): Competition {
  return {
    ...cloneCompetition(item),
    viewer: {
      isFavorited: favoriteCompetitionIds.has(item.id),
      isEnrolled: enrolledCompetitionIds.has(item.id),
      favoritedAt: getFavoriteTime(favoriteCompetitionTimeline, item.id),
    },
  };
}

function getResourceAccessStatus(resourceId: string): ResourceAccessStatus {
  const owned = ownedResources.some((item) => item.resourceId === resourceId);
  if (owned) {
    return 'owned';
  }

  const pendingOrder = orders.some((item) => item.resourceId === resourceId && item.status === ORDER_STATUS_PENDING);
  return pendingOrder ? 'pending_payment' : 'not_acquired';
}

function decorateResource(item: ResourceItem): ResourceItem {
  return {
    ...cloneResource(item),
    viewer: {
      isFavorited: favoriteResourceIds.has(item.id),
      accessStatus: getResourceAccessStatus(item.id),
      favoritedAt: getFavoriteTime(favoriteResourceTimeline, item.id),
    },
  };
}

function getTeamApplicationStatus(teamId: string): TeamApplicationStatus {
  return appliedTeamIds.has(teamId) ? 'pending' : 'none';
}

function decorateTeam(item: TeamItem): TeamItem {
  const applicationStatus = getTeamApplicationStatus(item.id);
  return {
    ...cloneTeam(item),
    viewer: {
      hasApplied: applicationStatus !== 'none',
      applicationStatus,
    },
  };
}

function decoratePost(item: PostItem): PostItem {
  return {
    ...clonePost(item),
    viewer: {
      isLiked: likedPostIds.has(item.id),
      isFavorited: favoritePostIds.has(item.id),
      favoritedAt: getFavoriteTime(favoritePostTimeline, item.id),
    },
  };
}

function pushMockNotification(
  item: Omit<NotificationItem, 'id' | 'time' | 'unread'> & {
    time?: string;
    unread?: boolean;
  }
) {
  notifications.unshift({
    id: `m_${Date.now()}`,
    time: item.time || nowTimeLabel(),
    unread: item.unread ?? true,
    ...item,
  });
}

function scheduleRefundCompletion(orderId: string) {
  const existing = refundTimers.get(orderId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    const order = orders.find((item) => item.id === orderId);
    if (!order || order.status !== ORDER_STATUS_REFUNDING) {
      refundTimers.delete(orderId);
      return;
    }

    order.status = ORDER_STATUS_REFUNDED;
    order.refundCompletedAt = `${nowDateLabel()} 15:48`;

    if (order.resourceId) {
      const index = ownedResources.findIndex((item) => item.resourceId === order.resourceId);
      if (index >= 0) {
        ownedResources.splice(index, 1);
      }
    }

    pushMockNotification({
      category: notifications.find((item) => item.category)?.category ?? '订单',
      title: '退款已完成',
      content: `订单《${order.title}》已完成退款，相关资源权限也会同步更新。`,
      linkType: 'order',
      linkId: order.id,
      linkScene: 'refund_result',
      ctaText: '查看退款结果',
    });

    refundTimers.delete(orderId);
  }, 3600);

  refundTimers.set(orderId, timer);
}

function normalizeAiSource(source?: AiBootstrapQuery['source']) {
  if (source === 'competition' || source === 'resource') {
    return source;
  }

  return 'general' as const;
}

export async function loginWithMockWechat(): Promise<LoginSession> {
  return simulate({
    token: `mock-token-${Date.now()}`,
    user: buildMockUserProfile(),
    mode: 'mock',
  });
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return simulate(buildMockUserProfile());
}

export async function fetchHomeFeed(): Promise<HomeFeed> {
  const urgentCompetitions = [...competitions]
    .sort((left, right) => left.daysLeft - right.daysLeft)
    .slice(0, 2)
    .map(decorateCompetition);

  const hotResources = [...resources]
    .sort((left, right) => right.downloads - left.downloads)
    .slice(0, 2)
    .map(decorateResource);

  const latestTeams = [...teams].slice(0, 2).map(decorateTeam);
  const featuredPosts = [...posts].slice(0, 2).map(decoratePost);

  return simulate({
    heroPrompt: '先把近期最值得推进的竞赛、资源、组队和经验帖收拢到一个首页工作台。',
    urgentCompetitions,
    hotResources,
    latestTeams,
    featuredPosts,
  });
}

export async function fetchAiConversationBootstrap(
  query: AiBootstrapQuery = {}
): Promise<AiConversationBootstrap> {
  const source = normalizeAiSource(query.source);

  if (source === 'competition') {
    const targetCompetition = competitions.find((item) => item.id === query.id);
    if (targetCompetition) {
      return simulate({
        source,
        targetTitle: targetCompetition.title,
        openingMessage: `你正在查看《${targetCompetition.title}》。告诉我你的年级、专业和当前准备进度，我会从适配度、准备顺序和组队策略三个角度给你建议。`,
      });
    }
  }

  if (source === 'resource') {
    const targetResource = resources.find((item) => item.id === query.id);
    if (targetResource) {
      return simulate({
        source,
        targetTitle: targetResource.title,
        openingMessage: `这份《${targetResource.title}》更适合在什么阶段使用？你可以告诉我你的目标、时间预算和当前卡点，我会帮你判断是不是值得现在投入。`,
      });
    }
  }

  return simulate({
    source: 'general',
    openingMessage: '告诉我你最近两周想推进的目标，我会帮你判断先做竞赛、补资源还是尽快组队。',
  });
}

export async function sendAiMessage(_payload: AiReplyPayload): Promise<AiReplyResult> {
  return simulate({
    reply: '先聚焦一个最近两周能推进的目标，再围绕它补资源、找队友、做交付。不要同时铺太多线。',
  });
}

export async function fetchCompetitionList(query: CompetitionQuery = {}): Promise<Competition[]> {
  const keyword = query.keyword?.trim() ?? '';
  let list = competitions.filter((item) => {
    if (!keyword) {
      return true;
    }

    return [item.title, item.level, item.category, item.tags.join(' ')].some((field) => field.includes(keyword));
  });

  if (query.level && query.level !== COMMON_FILTER_ALL) {
    list = list.filter((item) => item.level === query.level);
  }

  const sort = query.sort ?? COMPETITION_SORT_OPTIONS[0];
  if (sort === COMPETITION_SORT_OPTIONS[1]) {
    list = [...list].sort((left, right) => right.views - left.views);
  } else if (sort === COMPETITION_SORT_OPTIONS[2]) {
    list = [...list].sort((left, right) => left.daysLeft - right.daysLeft);
  } else if (sort === COMPETITION_SORT_OPTIONS[3]) {
    list = [...list].sort((left, right) => right.deadline.localeCompare(left.deadline));
  }

  const limited = query.limit ? list.slice(0, query.limit) : list;
  return simulate(limited.map(decorateCompetition));
}

export async function fetchCompetitionDetail(id?: string): Promise<Competition> {
  return simulate(decorateCompetition(getCompetitionById(id)));
}

export async function toggleCompetitionFavorite(
  id: string,
  payload: ToggleFavoritePayload
): Promise<FavoriteMutationResult> {
  if (payload.favorite) {
    favoriteCompetitionIds.add(id);
    rememberFavoriteTime(favoriteCompetitionTimeline, id);
  } else {
    favoriteCompetitionIds.delete(id);
    forgetFavoriteTime(favoriteCompetitionTimeline, id);
  }

  return simulate({
    targetId: id,
    favorite: payload.favorite,
  });
}

export async function createCompetitionEnrollment(id: string): Promise<CompetitionEnrollmentResult> {
  enrolledCompetitionIds.add(id);
  return simulate({
    competitionId: id,
    enrolled: true,
    status: 'enrolled',
  });
}

export async function fetchResourcesForCompetition(compId: string): Promise<ResourceItem[]> {
  return simulate(getResourcesForCompetition(compId).map(decorateResource));
}

export async function fetchTeamsForCompetition(compId: string): Promise<TeamItem[]> {
  return simulate(getTeamsForCompetition(compId).map(decorateTeam));
}

export async function fetchResourceList(query: ResourceQuery = {}): Promise<ResourceItem[]> {
  const keyword = query.keyword?.trim() ?? '';
  let list = resources.filter((item) => {
    if (!keyword) {
      return true;
    }

    return [item.title, item.authorName, item.category, item.tags.join(' ')].some((field) => field.includes(keyword));
  });

  if (query.category && query.category !== COMMON_FILTER_ALL) {
    list = list.filter((item) => item.category === query.category);
  }

  if (query.priceType && query.priceType !== RESOURCE_PRICE_OPTIONS[0]) {
    list = list.filter((item) =>
      query.priceType === COMMON_FREE_LABEL ? item.price === 0 : item.price > 0
    );
  }

  list = [...list].sort((left, right) => right.downloads - left.downloads);
  const limited = query.limit ? list.slice(0, query.limit) : list;
  return simulate(limited.map(decorateResource));
}

export async function fetchResourceDetail(id?: string): Promise<ResourceItem> {
  return simulate(decorateResource(getResourceById(id)));
}

export async function toggleResourceFavorite(
  id: string,
  payload: ToggleFavoritePayload
): Promise<FavoriteMutationResult> {
  if (payload.favorite) {
    favoriteResourceIds.add(id);
    rememberFavoriteTime(favoriteResourceTimeline, id);
  } else {
    favoriteResourceIds.delete(id);
    forgetFavoriteTime(favoriteResourceTimeline, id);
  }

  return simulate({
    targetId: id,
    favorite: payload.favorite,
  });
}

export async function createResourceAcquire(
  id: string,
  payload: ResourceAcquirePayload
): Promise<ResourceAcquireResult> {
  const resource = getResourceById(id);

  if (payload.mode === 'free' || resource.price === 0) {
    const existing = ownedResources.find((item) => item.resourceId === id);
    const ownedResource =
      existing ??
      (() => {
        const created: OwnedResourceItem = {
          id: `mr${Date.now()}`,
          resourceId: resource.id,
          title: resource.title,
          type: resource.type,
          accessType: 'free',
          acquiredAt: nowDateLabel(),
          downloadCount: 0,
          tags: [...resource.tags],
        };
        ownedResources.unshift(created);
        return created;
      })();

    pushMockNotification({
      category: notifications.find((item) => item.category)?.category ?? '订单',
      title: '资源已加入我的资源',
      content: `你已领取《${resource.title}》，现在可以在“我的资源”里继续查看和下载。`,
      linkType: 'resource',
      linkId: resource.id,
      ctaText: '查看资源',
    });

    return simulate({
      resourceId: id,
      accessStatus: 'owned',
      ownedResource: cloneOwnedResource(ownedResource),
    });
  }

  let order = orders.find((item) => item.resourceId === id && item.status === ORDER_STATUS_PENDING);
  if (!order) {
    order = {
      id: `o${Date.now()}`,
      title: resource.title,
      itemType: 'resource',
      amount: resource.price,
      status: ORDER_STATUS_PENDING,
      createdAt: `${nowDateLabel()} 15:24`,
      resourceId: resource.id,
      coverLabel: '资源订单',
    };
    orders.unshift(order);

    pushMockNotification({
      category: notifications.find((item) => item.category)?.category ?? '订单',
      title: '资源订单已创建',
      content: `你已为《${resource.title}》创建订单，支付完成后会自动同步到“我的资源”。`,
      linkType: 'order',
      linkId: order.id,
      ctaText: '查看订单',
    });
  }

  return simulate({
    resourceId: id,
    accessStatus: 'pending_payment',
    order: cloneOrder(order),
  });
}

export async function createResourceDownload(id: string): Promise<ResourceDownloadResult> {
  const resource = getResourceById(id);
  const owned = ownedResources.find((item) => item.resourceId === id);
  if (!owned) {
    throw new Error('resource_not_owned');
  }

  owned.downloadCount += 1;

  return simulate({
    grantId: `grant_${id}_${Date.now()}`,
    downloadUrl: `https://mock-download.local/resources/${id}`,
    expiresAt: `${nowDateLabel()}T23:59:59.000Z`,
    filename: `${resource.title}.txt`,
  });
}

export async function fetchPostList(query: PostQuery = {}): Promise<PostItem[]> {
  const category = query.category ?? POST_CATEGORY_RECOMMENDED;
  const list = category === POST_CATEGORY_RECOMMENDED ? posts : posts.filter((item) => item.category === category);
  return simulate(list.map(decoratePost));
}

export async function fetchPostDetail(id?: string): Promise<PostItem> {
  return simulate(decoratePost(getPostById(id)));
}

export async function togglePostFavorite(
  id: string,
  payload: ToggleFavoritePayload
): Promise<FavoriteMutationResult> {
  if (payload.favorite) {
    favoritePostIds.add(id);
    rememberFavoriteTime(favoritePostTimeline, id);
  } else {
    favoritePostIds.delete(id);
    forgetFavoriteTime(favoritePostTimeline, id);
  }

  return simulate({
    targetId: id,
    favorite: payload.favorite,
  });
}

export async function fetchPostComments(id: string): Promise<PostCommentItem[]> {
  updatePostCommentMetrics(id);
  return simulate(buildCommentThread(id));
}

export async function createPostComment(
  id: string,
  payload: CommentPayload
): Promise<CommentMutationResult> {
  const post = getPostById(id);
  const parent = payload.parentCommentId ? findFlatCommentById(payload.parentCommentId) : null;
  const replyTo = payload.replyToCommentId ? findFlatCommentById(payload.replyToCommentId) : parent;
  const comment: PostCommentItem = {
    id: `pc${Date.now()}`,
    postId: id,
    parentCommentId: parent?.parentCommentId ?? parent?.id,
    replyToCommentId: replyTo?.id,
    replyToAuthorName: replyTo?.authorName,
    authorName: userProfile.name,
    authorMark: userProfile.mark,
    content: payload.content.trim(),
    likes: 0,
    status: 'approved',
    createdAt: nowTimeLabel(),
    viewer: {
      isLiked: false,
    },
  };

  postCommentsStore[id] = [comment, ...getPostCommentsById(id)];
  updatePostCommentMetrics(id);

  pushMockNotification({
    category: notifications.find((item) => item.category)?.category ?? '系统',
    title: replyTo ? '回复已发布' : '评论已发布',
    content: replyTo
      ? `你已经回复了《${post.title}》下的评论，后续互动会继续同步。`
      : `你已在《${post.title}》下发布评论，后续互动会继续同步。`,
    linkType: 'post',
    linkId: id,
    linkScene: replyTo ? 'comment_reply' : undefined,
    commentId: comment.id,
    ctaText: '查看帖子',
  });

  return simulate({
    commentId: comment.id,
    postId: id,
    parentCommentId: comment.parentCommentId,
    replyToCommentId: comment.replyToCommentId,
    status: 'approved',
  });
}

export async function togglePostLike(id: string, liked: boolean): Promise<LikeMutationResult> {
  const post = getPostById(id);

  if (liked) {
    likedPostIds.add(id);
    post.likes += 1;
  } else if (likedPostIds.has(id)) {
    likedPostIds.delete(id);
    post.likes = Math.max(0, post.likes - 1);
  }

  return simulate({
    targetId: id,
    liked,
    likes: post.likes,
  });
}

export async function toggleCommentLike(id: string, liked: boolean): Promise<LikeMutationResult> {
  const comment = findFlatCommentById(id);
  if (!comment) {
    throw new Error('comment_not_found');
  }

  if (liked) {
    likedCommentIds.add(id);
    comment.likes += 1;
  } else if (likedCommentIds.has(id)) {
    likedCommentIds.delete(id);
    comment.likes = Math.max(0, comment.likes - 1);
  }

  return simulate({
    targetId: id,
    liked,
    likes: comment.likes,
  });
}

export async function createReport(_payload: ReportPayload): Promise<ReportResult> {
  return simulate({
    reportId: `report_${Date.now()}`,
    status: 'pending',
  });
}

export async function fetchTeamList(query: TeamQuery = {}): Promise<TeamItem[]> {
  const keyword = query.keyword?.trim() ?? '';
  let list = teams.filter((item) => {
    if (!keyword) {
      return true;
    }

    return [item.title, item.compName, item.target, item.missingRoles.join(' ')].some((field) => field.includes(keyword));
  });

  if (query.compId) {
    list = list.filter((item) => item.compId === query.compId);
  }

  if (query.status && query.status !== COMMON_FILTER_ALL) {
    if (query.status === '我的') {
      list = list.filter((item) => item.authorName === userProfile.name || appliedTeamIds.has(item.id));
    } else {
      list = list.filter((item) => item.status === query.status);
    }
  }

  if (query.mineOnly) {
    list = list.filter((item) => item.authorName === userProfile.name || appliedTeamIds.has(item.id));
  }

  return simulate(list.map(decorateTeam));
}

export async function fetchTeamDetail(id?: string): Promise<TeamItem> {
  return simulate(decorateTeam(getTeamById(id)));
}

export async function createTeamApplication(
  id: string,
  _payload: TeamApplicationPayload = {}
): Promise<TeamApplicationResult> {
  appliedTeamIds.add(id);

  return simulate({
    teamId: id,
    applied: true,
    status: 'pending',
  });
}

export async function fetchMessages(query: MessageQuery = {}): Promise<NotificationItem[]> {
  const category = query.category;
  const list =
    !category || category === MESSAGE_CATEGORY_ALL
      ? notifications
      : notifications.filter((item) => item.category === category);

  return simulate(list.map(cloneNotification));
}

export async function markNotificationRead(id: string): Promise<NotificationReadResult> {
  const notification = notifications.find((item) => item.id === id);
  if (!notification) {
    throw new Error('notification_not_found');
  }

  notification.unread = false;

  return simulate({
    notificationId: id,
    unread: false,
    unreadCount: notifications.filter((item) => item.unread).length,
  });
}

export async function markNotificationsRead(
  payload: NotificationBatchReadPayload
): Promise<NotificationBatchReadResult> {
  let updatedCount = 0;

  if (payload.all) {
    notifications.forEach((item) => {
      if ((!payload.category || payload.category === MESSAGE_CATEGORY_ALL || item.category === payload.category) && item.unread) {
        item.unread = false;
        updatedCount += 1;
      }
    });
  } else {
    const idSet = new Set((payload.ids ?? []).filter(Boolean));
    notifications.forEach((item) => {
      if (idSet.has(item.id) && item.unread) {
        item.unread = false;
        updatedCount += 1;
      }
    });
  }

  return simulate({
    updatedCount,
    unreadCount: notifications.filter((item) => item.unread).length,
  });
}

export async function fetchFavorites(query: FavoriteQuery = {}): Promise<FavoriteCollection> {
  return simulate(buildFavoriteCollection(query.scope));
}

export async function fetchSearchSuggestions(): Promise<SearchSuggestion[]> {
  return simulate(searchSuggestions.map((item) => ({ ...item })));
}

export async function searchContent(query: SearchQuery): Promise<SearchResultItem[]> {
  const keyword = query.keyword.trim();
  if (!keyword) {
    return simulate([]);
  }

  const results: SearchResultItem[] = [];
  const scopes = query.scope === 'all' ? ['competitions', 'resources', 'posts', 'teams'] : [query.scope];

  if (scopes.includes('competitions')) {
    competitions
      .filter((item) => item.title.includes(keyword) || item.tags.join(' ').includes(keyword))
      .forEach((item) => {
        results.push({
          id: item.id,
          scope: 'competitions',
          title: item.title,
          subtitle: item.category,
          meta: `${item.level} · ${item.deadline}`,
          tags: [...item.tags],
          link: buildCompetitionDetailRoute(item.id),
        });
      });
  }

  if (scopes.includes('resources')) {
    resources
      .filter((item) => item.title.includes(keyword) || item.tags.join(' ').includes(keyword))
      .forEach((item) => {
        results.push({
          id: item.id,
          scope: 'resources',
          title: item.title,
          subtitle: item.type,
          meta: `${item.authorName} · ${item.downloads}`,
          tags: [...item.tags],
          link: buildResourceDetailRoute(item.id),
        });
      });
  }

  if (scopes.includes('posts')) {
    posts
      .filter((item) => item.title.includes(keyword) || item.tags.join(' ').includes(keyword))
      .forEach((item) => {
        results.push({
          id: item.id,
          scope: 'posts',
          title: item.title,
          subtitle: item.authorName,
          meta: `${item.likes} 点赞 · ${item.comments} 评论`,
          tags: [...item.tags],
          link: buildPostDetailRoute(item.id),
        });
      });
  }

  if (scopes.includes('teams')) {
    teams
      .filter((item) => item.title.includes(keyword) || item.target.includes(keyword))
      .forEach((item) => {
        results.push({
          id: item.id,
          scope: 'teams',
          title: item.title,
          subtitle: item.compName,
          meta: `${item.current}/${item.max} 人`,
          tags: [...item.missingRoles],
          link: buildTeamDetailRoute(item.id),
        });
      });
  }

  return simulate(results);
}

export async function publishTeamRecruit(payload: PublishTeamPayload): Promise<TeamItem> {
  const created: TeamItem = {
    id: `t${Date.now()}`,
    title: payload.title,
    compId: payload.compId,
    compName: payload.compName,
    status: TEAM_STATUS_RECRUITING,
    target: payload.target,
    current: 1,
    max: Math.max(payload.missingRoles.length + 1, 2),
    missingRoles: [...payload.missingRoles],
    deadline: payload.deadline,
    authorName: userProfile.name,
    authorMark: userProfile.mark,
    authorGrade: userProfile.grade,
    authorMajor: userProfile.major,
    schoolLimit: payload.schoolLimit,
    requirements: [...payload.requirements],
    contactHint: payload.contactHint,
  };
  teams.unshift(created);

  return simulate(decorateTeam(created));
}

export async function publishPost(payload: PublishPostPayload): Promise<PostItem> {
  const paragraphs = payload.content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const created: PostItem = {
    id: `p${Date.now()}`,
    title: payload.title,
    excerpt: paragraphs[0] || payload.content.slice(0, 80),
    content: paragraphs,
    category: payload.category,
    authorName: userProfile.name,
    authorMark: userProfile.mark,
    likes: 0,
    comments: 0,
    tags: [...payload.tags],
    time: nowTimeLabel(),
  };

  posts.unshift(created);
  return simulate(decoratePost(created));
}

export async function fetchOwnedResources(): Promise<OwnedResourceItem[]> {
  return simulate(ownedResources.map(cloneOwnedResource));
}

export async function fetchOrders(): Promise<OrderItem[]> {
  return simulate(orders.map(cloneOrder));
}

export async function fetchOrderDetail(id: string): Promise<OrderItem | null> {
  const order = orders.find((item) => item.id === id) ?? null;
  return simulate(order ? cloneOrder(order) : null);
}

export async function createOrderPayment(id: string): Promise<OrderPayResult> {
  const order = orders.find((item) => item.id === id);
  if (!order) {
    throw new Error('order_not_found');
  }

  if (order.status === ORDER_STATUS_PENDING) {
    order.status = ORDER_STATUS_COMPLETED;
    order.paidAt = `${nowDateLabel()} 15:30`;

    if (order.resourceId) {
      const resource = getResourceById(order.resourceId);
      const exists = ownedResources.some((item) => item.resourceId === order.resourceId);
      if (!exists) {
        ownedResources.unshift({
          id: `mr${Date.now()}`,
          resourceId: order.resourceId,
          title: resource.title,
          type: resource.type,
          accessType: 'paid',
          acquiredAt: nowDateLabel(),
          downloadCount: 0,
          tags: [...resource.tags],
        });
      }
    }

    pushMockNotification({
      category: notifications.find((item) => item.category)?.category ?? '订单',
      title: '订单支付已完成',
      content: `订单《${order.title}》已支付成功，资源权限会自动同步到账户。`,
      linkType: order.resourceId ? 'resource' : 'order',
      linkId: order.resourceId || order.id,
      ctaText: order.resourceId ? '查看资源' : '查看订单',
    });
  }

  return simulate({
    orderId: order.id,
    status: order.status,
    paymentMode: 'mock',
  });
}

export async function createOrderRefund(
  id: string,
  payload: OrderRefundPayload = {}
): Promise<OrderRefundResult> {
  const order = orders.find((item) => item.id === id);
  if (!order) {
    throw new Error('order_not_found');
  }

  if (order.status === ORDER_STATUS_REFUNDING || order.status === ORDER_STATUS_REFUNDED) {
    return simulate({
      orderId: order.id,
      status: order.status,
      refundMode: 'mock',
      refundId: order.refundId,
    });
  }

  if (order.status !== ORDER_STATUS_COMPLETED) {
    throw new Error('refund_not_available');
  }

  order.status = ORDER_STATUS_REFUNDING;
  order.refundId = `refund_${Date.now()}`;
  order.refundReason = payload.reason || '用户在前端发起退款申请';
  order.refundRequestedAt = `${nowDateLabel()} 15:44`;
  order.refundCompletedAt = undefined;

  pushMockNotification({
    category: notifications.find((item) => item.category)?.category ?? '订单',
    title: '退款请求已提交',
    content: `订单《${order.title}》已进入退款处理流程，结果会在订单页和消息中心同步。`,
    linkType: 'order',
    linkId: order.id,
    linkScene: 'refund_result',
    ctaText: '查看退款进度',
  });

  scheduleRefundCompletion(order.id);

  return simulate({
    orderId: order.id,
    status: order.status,
    refundMode: 'mock',
    refundId: order.refundId,
  });
}

export async function fetchMyTeams(): Promise<TeamItem[]> {
  return simulate(getMyTeams().map(decorateTeam));
}
