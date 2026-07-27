import type {
  AiBootstrapQuery,
  AiReplyPayload,
  AdminLoginPayload,
  AdminSession,
  CommentPayload,
  CompetitionQuery,
  FavoriteQuery,
  LoginSession,
  MessageQuery,
  NotificationBatchReadPayload,
  OrderRefundPayload,
  PostQuery,
  PublishPostPayload,
  PublishTeamPayload,
  ReportPayload,
  ResourceAcquirePayload,
  ResourceQuery,
  SchoolQuery,
  SchoolVerificationCodePayload,
  SchoolVerificationVerifyPayload,
  SearchQuery,
  SelectSchoolPayload,
  TeamApplicationDecisionPayload,
  TeamApplicationPayload,
  TeamQuery,
  ToggleFavoritePayload,
  UpdateUserIdentityPayload,
  UpdateUserProfilePayload,
} from '../../types/api';
import type { UserProfile } from '../../types/entities';
import {
  type AdminCompetitionQuery,
  acceptPostAnswer,
  createCompetitionEnrollment,
  createAdminCompetition,
  createAdminSchoolAdmin,
  createDailyCheckin,
  createOrderPayment,
  createOrderRefund,
  createPostComment,
  createReport,
  createResourceAcquire,
  createResourceDownload,
  createTeamApplication,
  fetchAiConversationBootstrap,
  fetchCurrentAdmin,
  fetchCompetitionDetail,
  fetchCompetitionList,
  fetchCurrentUser,
  fetchCheckinState,
  fetchFavorites,
  fetchHomeFeed,
  fetchAdminHomeFeedConfig,
  fetchAdminCompetitions,
  fetchAdminAuditLogs,
  fetchAdminDashboardSummary,
  fetchAdminModerationTasks,
  fetchAdminTeamExamples,
  fetchAdminReports,
  fetchAdminSchoolHomeConfig,
  fetchAdminSchools,
  fetchMessages,
  fetchOrderDetail,
  fetchOrders,
  fetchMyResourceSubmissions,
  fetchOwnedResources,
  fetchPostComments,
  fetchPostDetail,
  fetchPostList,
  fetchPostsForCompetition,
  fetchResourceDetail,
  fetchResourceList,
  fetchResourcesForCompetition,
  fetchSearchSuggestions,
  fetchSchoolList,
  fetchSchoolMemberships,
  fetchTeamApplications,
  fetchTeamDetail,
  fetchTeamList,
  fetchTeamsForCompetition,
  fetchUserActivity,
  loginByWechatCode,
  loginAdmin,
  markNotificationRead,
  markNotificationsRead,
  publishPost,
  publishAdminResource,
  publishResource,
  publishTeamRecruit,
  requestSchoolVerificationCode,
  revealTeamContact,
  uploadAdminHomeFeedImage,
  updateAdminHomeFeedConfig,
  updateAdminCompetition,
  updateAdminSchool,
  updateAdminSchoolAdmin,
  updateAdminSchoolHomeConfig,
  reviewAdminModerationTask,
  archiveAdminTeamExamples,
  logoutAdmin as requestAdminLogout,
  reviewTeamApplication,
  searchContent,
  selectCurrentUserSchool,
  sendAiMessage,
  toggleCommentLike,
  toggleCompetitionFavorite,
  togglePostFavorite,
  togglePostLike,
  toggleResourceFavorite,
  uploadResourceAsset,
  uploadUserAvatarImage,
  updateCurrentUser,
  updateCurrentUserIdentity,
  verifySchoolVerificationCode,
} from './api';
import { clearStoredAdminSession, getStoredAdminSession, setStoredAdminSession } from './admin-session';
import { markOnboardingForReplay } from './onboarding-state';
import { clearDataCache } from './query-cache';
import { clearStoredSession, getStoredSession, setStoredSession } from './session';

export function getCurrentSession() {
  return getStoredSession();
}

export function getCurrentAdminSession() {
  return getStoredAdminSession();
}

let currentUserSyncRequest: { token: string; promise: Promise<UserProfile | null> } | null = null;

export function syncCurrentUser() {
  const session = getStoredSession();
  if (!session) {
    return Promise.resolve(null);
  }

  if (currentUserSyncRequest?.token === session.token) {
    return currentUserSyncRequest.promise;
  }

  const token = session.token;
  const promise = fetchCurrentUser()
    .then((user) => {
      const currentSession = getStoredSession();
      if (currentSession?.token === token) {
        setStoredSession({ ...currentSession, user });
      }
      return user;
    })
    .finally(() => {
      if (currentUserSyncRequest?.token === token) {
        currentUserSyncRequest = null;
      }
    });

  currentUserSyncRequest = { token, promise };
  return promise;
}

export async function saveCurrentUserProfile(payload: UpdateUserProfilePayload) {
  const session = getStoredSession();
  const user = await updateCurrentUser(payload);

  if (session) {
    setStoredSession({ ...session, user });
  }

  return user;
}

export async function saveCurrentUserIdentity(payload: UpdateUserIdentityPayload) {
  const session = getStoredSession();
  const user = await updateCurrentUserIdentity(payload);

  if (session) {
    setStoredSession({ ...session, user });
  }

  return user;
}

export async function saveCurrentUserSchool(payload: SelectSchoolPayload) {
  const session = getStoredSession();
  const user = await selectCurrentUserSchool(payload);

  if (session) {
    clearDataCache();
    setStoredSession({ ...session, user });
  }

  return user;
}

export function loadSchoolList(query: SchoolQuery = {}) {
  return fetchSchoolList(query);
}

export function loadSchoolMemberships() {
  return fetchSchoolMemberships();
}

export function sendCurrentUserSchoolVerificationCode(payload: SchoolVerificationCodePayload) {
  return requestSchoolVerificationCode(payload);
}

export async function verifyCurrentUserSchoolCode(payload: SchoolVerificationVerifyPayload) {
  const session = getStoredSession();
  const result = await verifySchoolVerificationCode(payload);

  if (session) {
    clearDataCache();
    setStoredSession({ ...session, user: result.user });
  }

  return result;
}

export async function checkinCurrentUser() {
  const session = getStoredSession();
  const result = await createDailyCheckin();

  if (session) {
    setStoredSession({ ...session, user: result.user });
  }

  return result;
}

export async function syncCurrentAdmin() {
  const session = getStoredAdminSession();
  if (!session) {
    return null;
  }

  const admin = await fetchCurrentAdmin();
  const nextSession: AdminSession = { ...session, admin };
  setStoredAdminSession(nextSession);
  return admin;
}

export async function loginWithWechatCode(code: string) {
  const session = await loginByWechatCode({ code });
  clearDataCache();
  setStoredSession(session);
  return session;
}

export async function loginAsAdmin(payload: AdminLoginPayload) {
  const session = await loginAdmin(payload);
  setStoredAdminSession(session);
  return session;
}

export function logout() {
  const session = getStoredSession();
  if (session?.user.id) {
    markOnboardingForReplay(session.user.id);
  }
  clearDataCache();
  clearStoredSession();
}

export async function logoutAdmin() {
  const session = getStoredAdminSession();
  try {
    if (session?.token) {
      await requestAdminLogout();
    }
  } catch {
    // ignore logout transport failures and clear local admin session anyway
  } finally {
    clearStoredAdminSession();
  }
}

export {
  acceptPostAnswer,
  createAdminCompetition,
  createCompetitionEnrollment,
  createAdminSchoolAdmin,
  createOrderPayment,
  createOrderRefund,
  createPostComment,
  createReport,
  createResourceAcquire,
  createResourceDownload,
  createTeamApplication,
  fetchAiConversationBootstrap,
  fetchCurrentAdmin,
  fetchCompetitionDetail,
  fetchCompetitionList,
  fetchCheckinState,
  fetchFavorites,
  fetchHomeFeed,
  fetchAdminHomeFeedConfig,
  fetchAdminCompetitions,
  fetchAdminAuditLogs,
  fetchAdminDashboardSummary,
  fetchAdminModerationTasks,
  fetchAdminTeamExamples,
  fetchAdminReports,
  fetchAdminSchoolHomeConfig,
  fetchAdminSchools,
  fetchMessages,
  fetchOrderDetail,
  fetchOrders,
  fetchMyResourceSubmissions,
  fetchOwnedResources,
  fetchPostComments,
  fetchPostDetail,
  fetchPostList,
  fetchPostsForCompetition,
  fetchResourceDetail,
  fetchResourceList,
  fetchResourcesForCompetition,
  fetchSearchSuggestions,
  fetchSchoolList,
  fetchSchoolMemberships,
  fetchTeamApplications,
  fetchTeamDetail,
  fetchTeamList,
  fetchTeamsForCompetition,
  fetchUserActivity,
  markNotificationRead,
  markNotificationsRead,
  publishPost,
  publishAdminResource,
  publishResource,
  publishTeamRecruit,
  requestSchoolVerificationCode,
  revealTeamContact,
  uploadAdminHomeFeedImage,
  updateAdminHomeFeedConfig,
  updateAdminCompetition,
  updateAdminSchool,
  updateAdminSchoolAdmin,
  updateAdminSchoolHomeConfig,
  reviewAdminModerationTask,
  archiveAdminTeamExamples,
  reviewTeamApplication,
  searchContent,
  selectCurrentUserSchool,
  sendAiMessage,
  toggleCommentLike,
  toggleCompetitionFavorite,
  togglePostFavorite,
  togglePostLike,
  toggleResourceFavorite,
  uploadResourceAsset,
  uploadUserAvatarImage,
  updateCurrentUser,
  updateCurrentUserIdentity,
  verifySchoolVerificationCode,
  loginAdmin,
};

export type {
  AiBootstrapQuery,
  AiReplyPayload,
  AdminLoginPayload,
  AdminCompetitionQuery,
  CommentPayload,
  CompetitionQuery,
  FavoriteQuery,
  MessageQuery,
  NotificationBatchReadPayload,
  OrderRefundPayload,
  PostQuery,
  PublishPostPayload,
  PublishTeamPayload,
  ReportPayload,
  ResourceAcquirePayload,
  ResourceQuery,
  SchoolQuery,
  SchoolVerificationCodePayload,
  SchoolVerificationVerifyPayload,
  SearchQuery,
  SelectSchoolPayload,
  TeamApplicationDecisionPayload,
  TeamApplicationPayload,
  TeamQuery,
  ToggleFavoritePayload,
  UpdateUserIdentityPayload,
  UpdateUserProfilePayload,
};
