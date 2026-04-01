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
  ResourceItem,
  SearchResultItem,
  SearchSuggestion,
  TeamItem,
  UserProfile,
} from '../types/entities';
import type {
  AiBootstrapQuery,
  AiReplyPayload,
  CommentMutationResult,
  CommentPayload,
  CompetitionQuery,
  CompetitionEnrollmentResult,
  FavoriteQuery,
  FavoriteMutationResult,
  LikeMutationResult,
  LoginPayload,
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
import { request } from './http';

export function loginByWechatCode(payload: LoginPayload) {
  return request<LoginSession, LoginPayload>({
    url: '/auth/wechat/login',
    method: 'POST',
    data: payload,
  });
}

export function fetchCurrentUserRemote() {
  return request<UserProfile>({
    url: '/users/me',
    auth: true,
  });
}

export function fetchHomeFeedRemote() {
  return request<HomeFeed>({
    url: '/feeds/home',
    auth: true,
  });
}

export function fetchAiConversationBootstrapRemote(query: AiBootstrapQuery = {}) {
  return request<AiConversationBootstrap, AiBootstrapQuery>({
    url: '/ai/bootstrap',
    data: query,
  });
}

export function sendAiMessageRemote(payload: AiReplyPayload) {
  return request<AiReplyResult, AiReplyPayload>({
    url: '/ai/reply',
    method: 'POST',
    data: payload,
  });
}

export function fetchCompetitionListRemote(query: CompetitionQuery = {}) {
  return request<Competition[], CompetitionQuery>({
    url: '/competitions',
    data: query,
    auth: true,
  });
}

export function fetchCompetitionDetailRemote(id?: string) {
  return request<Competition>({
    url: `/competitions/${id}`,
    auth: true,
  });
}

export function patchCompetitionFavoriteRemote(id: string, payload: ToggleFavoritePayload) {
  return request<FavoriteMutationResult, ToggleFavoritePayload>({
    url: `/competitions/${id}/favorite`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function createCompetitionEnrollmentRemote(id: string) {
  return request<CompetitionEnrollmentResult>({
    url: `/competitions/${id}/enrollments`,
    method: 'POST',
    auth: true,
  });
}

export function fetchResourcesForCompetitionRemote(compId: string) {
  return request<ResourceItem[]>({
    url: `/competitions/${compId}/resources`,
    auth: true,
  });
}

export function fetchTeamsForCompetitionRemote(compId: string) {
  return request<TeamItem[]>({
    url: `/competitions/${compId}/teams`,
    auth: true,
  });
}

export function fetchResourceListRemote(query: ResourceQuery = {}) {
  return request<ResourceItem[], ResourceQuery>({
    url: '/resources',
    data: query,
    auth: true,
  });
}

export function fetchResourceDetailRemote(id?: string) {
  return request<ResourceItem>({
    url: `/resources/${id}`,
    auth: true,
  });
}

export function patchResourceFavoriteRemote(id: string, payload: ToggleFavoritePayload) {
  return request<FavoriteMutationResult, ToggleFavoritePayload>({
    url: `/resources/${id}/favorite`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function createResourceAcquireRemote(id: string, payload: ResourceAcquirePayload) {
  return request<ResourceAcquireResult, ResourceAcquirePayload>({
    url: `/resources/${id}/acquisitions`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function createResourceDownloadRemote(id: string) {
  return request<ResourceDownloadResult>({
    url: `/resources/${id}/downloads`,
    method: 'POST',
    auth: true,
  });
}

export function fetchPostListRemote(query: PostQuery = {}) {
  return request<PostItem[], PostQuery>({
    url: '/posts',
    data: query,
    auth: true,
  });
}

export function fetchPostDetailRemote(id?: string) {
  return request<PostItem>({
    url: `/posts/${id}`,
    auth: true,
  });
}

export function patchPostFavoriteRemote(id: string, payload: ToggleFavoritePayload) {
  return request<FavoriteMutationResult, ToggleFavoritePayload>({
    url: `/posts/${id}/favorite`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function fetchPostCommentsRemote(id: string) {
  return request<PostCommentItem[]>({
    url: `/posts/${id}/comments`,
    auth: true,
  });
}

export function createPostCommentRemote(id: string, payload: CommentPayload) {
  return request<CommentMutationResult, CommentPayload>({
    url: `/posts/${id}/comments`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function togglePostLikeRemote(id: string, liked: boolean) {
  return request<LikeMutationResult, { liked: boolean }>({
    url: `/posts/${id}/like`,
    method: 'PATCH',
    data: { liked },
    auth: true,
  });
}

export function toggleCommentLikeRemote(id: string, liked: boolean) {
  return request<LikeMutationResult, { liked: boolean }>({
    url: `/comments/${id}/like`,
    method: 'PATCH',
    data: { liked },
    auth: true,
  });
}

export function createReportRemote(payload: ReportPayload) {
  return request<ReportResult, ReportPayload>({
    url: '/reports',
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function fetchTeamListRemote(query: TeamQuery = {}) {
  return request<TeamItem[], TeamQuery>({
    url: '/teams',
    data: query,
    auth: true,
  });
}

export function fetchTeamDetailRemote(id?: string) {
  return request<TeamItem>({
    url: `/teams/${id}`,
    auth: true,
  });
}

export function createTeamApplicationRemote(id: string, payload: TeamApplicationPayload = {}) {
  return request<TeamApplicationResult, TeamApplicationPayload>({
    url: `/teams/${id}/applications`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function publishTeamRecruitRemote(payload: PublishTeamPayload) {
  return request<TeamItem, PublishTeamPayload>({
    url: '/teams',
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function fetchMessagesRemote(query: MessageQuery = {}) {
  return request<NotificationItem[], MessageQuery>({
    url: '/notifications',
    data: query,
    auth: true,
  });
}

export function markNotificationReadRemote(id: string) {
  return request<NotificationReadResult>({
    url: `/notifications/${id}/read`,
    method: 'PATCH',
    auth: true,
  });
}

export function markNotificationsReadRemote(payload: NotificationBatchReadPayload) {
  return request<NotificationBatchReadResult, NotificationBatchReadPayload>({
    url: '/notifications/read',
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function fetchFavoritesRemote(query: FavoriteQuery = {}) {
  return request<FavoriteCollection, FavoriteQuery>({
    url: '/users/favorites',
    data: query,
    auth: true,
  });
}

export function fetchSearchSuggestionsRemote() {
  return request<SearchSuggestion[]>({
    url: '/search/suggestions',
  });
}

export function searchContentRemote(query: SearchQuery) {
  return request<SearchResultItem[], SearchQuery>({
    url: '/search',
    data: query,
  });
}

export function publishPostRemote(payload: PublishPostPayload) {
  return request<PostItem, PublishPostPayload>({
    url: '/posts',
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function fetchOwnedResourcesRemote() {
  return request<OwnedResourceItem[]>({
    url: '/users/resources',
    auth: true,
  });
}

export function fetchOrdersRemote() {
  return request<OrderItem[]>({
    url: '/orders',
    auth: true,
  });
}

export function fetchOrderDetailRemote(id: string) {
  return request<OrderItem>({
    url: `/orders/${id}`,
    auth: true,
  });
}

export function createOrderPaymentRemote(id: string) {
  return request<OrderPayResult>({
    url: `/orders/${id}/pay`,
    method: 'POST',
    auth: true,
  });
}

export function createOrderRefundRemote(id: string, payload: OrderRefundPayload) {
  return request<OrderRefundResult, OrderRefundPayload>({
    url: `/orders/${id}/refunds`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}
