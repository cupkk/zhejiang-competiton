import Taro from '@tarojs/taro';
import { runtimeConfig, shouldUseRemoteApi } from '../config/runtime';
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
import type { FavoriteCollection, PostCommentItem, UserProfile } from '../types/entities';
import { isAuthExpiredError } from '../utils/request-error';
import * as remote from './backend-api';
import * as mock from './mock-api';
import { clearStoredSession, getStoredSession, setStoredSession } from './session';

async function resolveDataSource<T>(remoteTask: () => Promise<T>, mockTask: () => Promise<T>) {
  if (!shouldUseRemoteApi()) {
    return mockTask();
  }

  try {
    return await remoteTask();
  } catch (error) {
    if (isAuthExpiredError(error)) {
      throw error;
    }

    console.warn('Remote api failed, falling back to mock data.', error);

    if (runtimeConfig.enableMockFallback) {
      return mockTask();
    }

    throw error;
  }
}

export function getCurrentSession() {
  return getStoredSession();
}

export async function syncCurrentUser(): Promise<UserProfile | null> {
  const session = getStoredSession();
  if (!session) {
    return null;
  }

  if (!shouldUseRemoteApi()) {
    const user = await mock.fetchCurrentUser();
    setStoredSession({ ...session, user });
    return user;
  }

  try {
    const user = await remote.fetchCurrentUserRemote();
    setStoredSession({ ...session, user });
    return user;
  } catch (error) {
    if (isAuthExpiredError(error)) {
      return null;
    }

    if (!runtimeConfig.enableMockFallback) {
      throw error;
    }

    return session.user;
  }
}

export async function loginWithWechat(): Promise<LoginSession> {
  if (!shouldUseRemoteApi()) {
    const session = await mock.loginWithMockWechat();
    setStoredSession(session);
    return session;
  }

  try {
    const { code } = await Taro.login();
    const session = await remote.loginByWechatCode({ code });
    setStoredSession(session);
    return session;
  } catch (error) {
    if (!runtimeConfig.enableMockFallback) {
      throw error;
    }

    const session = await mock.loginWithMockWechat();
    setStoredSession(session);
    return session;
  }
}

export function logout() {
  clearStoredSession();
}

export function fetchHomeFeed() {
  return resolveDataSource(remote.fetchHomeFeedRemote, mock.fetchHomeFeed);
}

export function fetchAiConversationBootstrap(query: AiBootstrapQuery = {}) {
  return resolveDataSource(
    () => remote.fetchAiConversationBootstrapRemote(query),
    () => mock.fetchAiConversationBootstrap(query)
  );
}

export function sendAiMessage(payload: AiReplyPayload) {
  return resolveDataSource(
    () => remote.sendAiMessageRemote(payload),
    () => mock.sendAiMessage(payload)
  );
}

export function fetchCompetitionList(query: CompetitionQuery = {}) {
  return resolveDataSource(
    () => remote.fetchCompetitionListRemote(query),
    () => mock.fetchCompetitionList(query)
  );
}

export function fetchCompetitionDetail(id?: string) {
  return resolveDataSource(
    () => remote.fetchCompetitionDetailRemote(id),
    () => mock.fetchCompetitionDetail(id)
  );
}

export function toggleCompetitionFavorite(id: string, payload: ToggleFavoritePayload) {
  return resolveDataSource(
    () => remote.patchCompetitionFavoriteRemote(id, payload),
    () => mock.toggleCompetitionFavorite(id, payload)
  );
}

export function createCompetitionEnrollment(id: string) {
  return resolveDataSource<CompetitionEnrollmentResult>(
    () => remote.createCompetitionEnrollmentRemote(id),
    () => mock.createCompetitionEnrollment(id)
  );
}

export function fetchResourcesForCompetition(compId: string) {
  return resolveDataSource(
    () => remote.fetchResourcesForCompetitionRemote(compId),
    () => mock.fetchResourcesForCompetition(compId)
  );
}

export function fetchTeamsForCompetition(compId: string) {
  return resolveDataSource(
    () => remote.fetchTeamsForCompetitionRemote(compId),
    () => mock.fetchTeamsForCompetition(compId)
  );
}

export function fetchResourceList(query: ResourceQuery = {}) {
  return resolveDataSource(
    () => remote.fetchResourceListRemote(query),
    () => mock.fetchResourceList(query)
  );
}

export function fetchResourceDetail(id?: string) {
  return resolveDataSource(
    () => remote.fetchResourceDetailRemote(id),
    () => mock.fetchResourceDetail(id)
  );
}

export function toggleResourceFavorite(id: string, payload: ToggleFavoritePayload) {
  return resolveDataSource<FavoriteMutationResult>(
    () => remote.patchResourceFavoriteRemote(id, payload),
    () => mock.toggleResourceFavorite(id, payload)
  );
}

export function createResourceAcquire(id: string, payload: ResourceAcquirePayload) {
  return resolveDataSource<ResourceAcquireResult>(
    () => remote.createResourceAcquireRemote(id, payload),
    () => mock.createResourceAcquire(id, payload)
  );
}

export function createResourceDownload(id: string) {
  return resolveDataSource<ResourceDownloadResult>(
    () => remote.createResourceDownloadRemote(id),
    () => mock.createResourceDownload(id)
  );
}

export function fetchPostList(query: PostQuery = {}) {
  return resolveDataSource(
    () => remote.fetchPostListRemote(query),
    () => mock.fetchPostList(query)
  );
}

export function fetchPostDetail(id?: string) {
  return resolveDataSource(
    () => remote.fetchPostDetailRemote(id),
    () => mock.fetchPostDetail(id)
  );
}

export function togglePostFavorite(id: string, payload: ToggleFavoritePayload) {
  return resolveDataSource<FavoriteMutationResult>(
    () => remote.patchPostFavoriteRemote(id, payload),
    () => mock.togglePostFavorite(id, payload)
  );
}

export function fetchPostComments(id: string) {
  return resolveDataSource<PostCommentItem[]>(
    () => remote.fetchPostCommentsRemote(id),
    () => mock.fetchPostComments(id)
  );
}

export function createPostComment(id: string, payload: CommentPayload) {
  return resolveDataSource<CommentMutationResult>(
    () => remote.createPostCommentRemote(id, payload),
    () => mock.createPostComment(id, payload)
  );
}

export function togglePostLike(id: string, liked: boolean) {
  return resolveDataSource<LikeMutationResult>(
    () => remote.togglePostLikeRemote(id, liked),
    () => mock.togglePostLike(id, liked)
  );
}

export function toggleCommentLike(id: string, liked: boolean) {
  return resolveDataSource<LikeMutationResult>(
    () => remote.toggleCommentLikeRemote(id, liked),
    () => mock.toggleCommentLike(id, liked)
  );
}

export function createReport(payload: ReportPayload) {
  return resolveDataSource<ReportResult>(
    () => remote.createReportRemote(payload),
    () => mock.createReport(payload)
  );
}

export function fetchTeamList(query: TeamQuery = {}) {
  return resolveDataSource(
    () => remote.fetchTeamListRemote(query),
    () => mock.fetchTeamList(query)
  );
}

export function fetchTeamDetail(id?: string) {
  return resolveDataSource(
    () => remote.fetchTeamDetailRemote(id),
    () => mock.fetchTeamDetail(id)
  );
}

export function createTeamApplication(id: string, payload: TeamApplicationPayload = {}) {
  return resolveDataSource<TeamApplicationResult>(
    () => remote.createTeamApplicationRemote(id, payload),
    () => mock.createTeamApplication(id, payload)
  );
}

export function fetchMessages(query: MessageQuery = {}) {
  return resolveDataSource(
    () => remote.fetchMessagesRemote(query),
    () => mock.fetchMessages(query)
  );
}

export function markNotificationRead(id: string) {
  return resolveDataSource<NotificationReadResult>(
    () => remote.markNotificationReadRemote(id),
    () => mock.markNotificationRead(id)
  );
}

export function markNotificationsRead(payload: NotificationBatchReadPayload) {
  return resolveDataSource<NotificationBatchReadResult>(
    () => remote.markNotificationsReadRemote(payload),
    () => mock.markNotificationsRead(payload)
  );
}

export function fetchFavorites(query: FavoriteQuery = {}) {
  return resolveDataSource<FavoriteCollection>(
    () => remote.fetchFavoritesRemote(query),
    () => mock.fetchFavorites(query)
  );
}

export function fetchSearchSuggestions() {
  return resolveDataSource(remote.fetchSearchSuggestionsRemote, mock.fetchSearchSuggestions);
}

export function searchContent(query: SearchQuery) {
  return resolveDataSource(
    () => remote.searchContentRemote(query),
    () => mock.searchContent(query)
  );
}

export function publishTeamRecruit(payload: PublishTeamPayload) {
  return resolveDataSource(
    () => remote.publishTeamRecruitRemote(payload),
    () => mock.publishTeamRecruit(payload)
  );
}

export function publishPost(payload: PublishPostPayload) {
  return resolveDataSource(
    () => remote.publishPostRemote(payload),
    () => mock.publishPost(payload)
  );
}

export function fetchOwnedResources() {
  return resolveDataSource(remote.fetchOwnedResourcesRemote, mock.fetchOwnedResources);
}

export function fetchOrders() {
  return resolveDataSource(remote.fetchOrdersRemote, mock.fetchOrders);
}

export function fetchOrderDetail(id: string) {
  return resolveDataSource(
    () => remote.fetchOrderDetailRemote(id),
    () => mock.fetchOrderDetail(id)
  );
}

export function createOrderPayment(id: string) {
  return resolveDataSource<OrderPayResult>(
    () => remote.createOrderPaymentRemote(id),
    () => mock.createOrderPayment(id)
  );
}

export function createOrderRefund(id: string, payload: OrderRefundPayload) {
  return resolveDataSource<OrderRefundResult>(
    () => remote.createOrderRefundRemote(id, payload),
    () => mock.createOrderRefund(id, payload)
  );
}
