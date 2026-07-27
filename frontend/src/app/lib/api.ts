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
  School,
  SchoolMembership,
  SchoolVerificationCodeResult,
  SchoolVerificationResult,
  SearchResultItem,
  SearchSuggestion,
  TeamApplicationItem,
  TeamItem,
  UserActivityCollection,
  UserProfile,
} from '../../types/entities';
import type {
  AiBootstrapQuery,
  AiReplyPayload,
  AcceptPostAnswerPayload,
  AdminLoginPayload,
  AdminProfile,
  AdminSession,
  AvatarImageUploadResult,
  CheckinResponse,
  CheckinStateResponse,
  CommentMutationResult,
  CommentPayload,
  CompetitionEnrollmentResult,
  CompetitionQuery,
  FavoriteMutationResult,
  FavoriteQuery,
  HomeFeedConfigPayload,
  HomeFeedConfigResult,
  HomeFeedImageUploadResult,
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
  PublishResourcePayload,
  PublishTeamPayload,
  ReportPayload,
  ReportResult,
  ResourceAcquirePayload,
  ResourceAcquireResult,
  ResourceAssetUploadResult,
  ResourceDownloadResult,
  ResourceQuery,
  SchoolQuery,
  SchoolVerificationCodePayload,
  SchoolVerificationVerifyPayload,
  SearchQuery,
  SelectSchoolPayload,
  TeamApplicationDecisionPayload,
  TeamApplicationDecisionResult,
  TeamApplicationPayload,
  TeamApplicationResult,
  TeamContactRevealResult,
  TeamQuery,
  ToggleFavoritePayload,
  UpdateUserIdentityPayload,
  UpdateUserProfilePayload,
} from '../../types/api';
import type {
  AdminModerationDecisionPayload,
  AdminModerationDecisionResult,
  AdminAuditLogItem,
  AdminCreateSchoolAdminPayload,
  AdminCompetitionItem,
  AdminCompetitionPayload,
  AdminCompetitionPublishStatus,
  AdminDashboardSummary,
  AdminHomeFeedConfig,
  AdminModerationTask,
  AdminReportItem,
  AdminResourcePublishPayload,
  AdminResourcePublishResult,
  AdminSchoolHomeConfig,
  AdminSchoolHomePayload,
  AdminSchoolItem,
  AdminSchoolListResult,
  AdminTeamExampleArchiveResult,
  AdminTeamExampleItem,
  AdminUpdateSchoolAdminPayload,
  ResourceSubmissionSummary,
} from './admin-types';
import { request } from './http';

interface AdminReportRow {
  id: string;
  reporter_user_id: string;
  target_type: AdminReportItem['targetType'];
  target_id: string;
  reason: string;
  detail?: string | null;
  status: AdminReportItem['status'];
  school_id?: string | null;
  school_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminModerationQuery {
  status?: string;
  targetType?: string;
  schoolId?: string;
}

export function loginByWechatCode(payload: LoginPayload) {
  return request<LoginSession, LoginPayload>({ url: '/auth/wechat/login', method: 'POST', data: payload });
}

export function loginAdmin(payload: AdminLoginPayload) {
  return request<AdminSession, AdminLoginPayload>({ url: '/admin/auth/login', method: 'POST', data: payload });
}

export function fetchCurrentAdmin() {
  return request<AdminProfile>({ url: '/admin/me', adminAuth: true });
}

export function logoutAdmin() {
  return request<{ success: boolean }>({ url: '/admin/auth/logout', method: 'POST', adminAuth: true });
}

export function fetchCurrentUser() {
  return request<UserProfile>({ url: '/users/me', auth: true });
}

export interface AdminCompetitionQuery {
  keyword?: string;
  publishStatus?: AdminCompetitionPublishStatus | '';
  limit?: number;
}

export function updateCurrentUser(payload: UpdateUserProfilePayload) {
  return request<UserProfile, UpdateUserProfilePayload>({
    url: '/users/me',
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function updateCurrentUserIdentity(payload: UpdateUserIdentityPayload) {
  return request<UserProfile, UpdateUserIdentityPayload>({
    url: '/users/me/identity',
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function selectCurrentUserSchool(payload: SelectSchoolPayload) {
  return request<UserProfile, SelectSchoolPayload>({
    url: '/users/me/school',
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function fetchSchoolList(query: SchoolQuery = {}) {
  return request<School[], SchoolQuery>({ url: '/schools', data: query });
}

export function fetchSchoolMemberships() {
  return request<SchoolMembership[]>({ url: '/users/me/school-memberships', auth: true });
}

export function requestSchoolVerificationCode(payload: SchoolVerificationCodePayload) {
  return request<SchoolVerificationCodeResult, SchoolVerificationCodePayload>({
    url: '/users/me/school-verification/code',
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function verifySchoolVerificationCode(payload: SchoolVerificationVerifyPayload) {
  return request<SchoolVerificationResult, SchoolVerificationVerifyPayload>({
    url: '/users/me/school-verification/verify',
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function fetchUserActivity() {
  return request<UserActivityCollection>({ url: '/users/activity', auth: true });
}

export function fetchCheckinState(month?: string) {
  return request<CheckinStateResponse, { month?: string }>({
    url: '/users/me/checkin',
    data: month ? { month } : {},
    auth: true,
  });
}

export function createDailyCheckin() {
  return request<CheckinResponse>({ url: '/users/me/checkin', method: 'POST', auth: true });
}

export function uploadUserAvatarImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return request<AvatarImageUploadResult, FormData>({
    url: '/uploads/avatar',
    method: 'POST',
    data: formData,
    auth: true,
    contentType: 'form',
  });
}

export function fetchHomeFeed() {
  return request<HomeFeed>({ url: '/feeds/home', auth: true });
}

export function fetchAiConversationBootstrap(query: AiBootstrapQuery = {}) {
  return request<AiConversationBootstrap, AiBootstrapQuery>({ url: '/ai/bootstrap', data: query });
}

export function sendAiMessage(payload: AiReplyPayload) {
  return request<AiReplyResult, AiReplyPayload>({ url: '/ai/reply', method: 'POST', data: payload });
}

export function fetchCompetitionList(query: CompetitionQuery = {}) {
  return request<Competition[], CompetitionQuery>({ url: '/competitions', data: query, auth: true });
}

export function fetchCompetitionDetail(id?: string) {
  return request<Competition>({ url: `/competitions/${id}`, auth: true });
}

export function toggleCompetitionFavorite(id: string, payload: ToggleFavoritePayload) {
  return request<FavoriteMutationResult, ToggleFavoritePayload>({
    url: `/competitions/${id}/favorite`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function createCompetitionEnrollment(id: string) {
  return request<CompetitionEnrollmentResult>({ url: `/competitions/${id}/enrollments`, method: 'POST', auth: true });
}

export function fetchResourcesForCompetition(id: string) {
  return request<ResourceItem[]>({ url: `/competitions/${id}/resources`, auth: true });
}

export function fetchTeamsForCompetition(id: string) {
  return request<TeamItem[]>({ url: `/competitions/${id}/teams`, auth: true });
}

export function fetchPostsForCompetition(id: string) {
  return request<PostItem[]>({ url: `/competitions/${id}/posts`, auth: true });
}

export function fetchResourceList(query: ResourceQuery = {}) {
  return request<ResourceItem[], ResourceQuery>({ url: '/resources', data: query, auth: true });
}

export function fetchResourceDetail(id?: string) {
  return request<ResourceItem>({ url: `/resources/${id}`, auth: true });
}

export function toggleResourceFavorite(id: string, payload: ToggleFavoritePayload) {
  return request<FavoriteMutationResult, ToggleFavoritePayload>({
    url: `/resources/${id}/favorite`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function createResourceAcquire(id: string, payload: ResourceAcquirePayload) {
  return request<ResourceAcquireResult, ResourceAcquirePayload>({
    url: `/resources/${id}/acquisitions`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function createResourceDownload(id: string) {
  return request<ResourceDownloadResult>({ url: `/resources/${id}/downloads`, method: 'POST', auth: true });
}

export function uploadResourceAsset(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return request<ResourceAssetUploadResult, FormData>({
    url: '/uploads/resource-file',
    method: 'POST',
    data: formData,
    auth: true,
    contentType: 'form',
  });
}

export function publishResource(payload: PublishResourcePayload) {
  return request<ResourceSubmissionSummary, PublishResourcePayload>({
    url: '/resources',
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function fetchMyResourceSubmissions() {
  return request<ResourceSubmissionSummary[]>({
    url: '/users/resource-submissions',
    auth: true,
  });
}

export function fetchPostList(query: PostQuery = {}) {
  return request<PostItem[], PostQuery>({ url: '/posts', data: query, auth: true });
}

export function fetchPostDetail(id?: string) {
  return request<PostItem>({ url: `/posts/${id}`, auth: true });
}

export function togglePostFavorite(id: string, payload: ToggleFavoritePayload) {
  return request<FavoriteMutationResult, ToggleFavoritePayload>({
    url: `/posts/${id}/favorite`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function fetchPostComments(id: string) {
  return request<PostCommentItem[]>({ url: `/posts/${id}/comments`, auth: true });
}

export function createPostComment(id: string, payload: CommentPayload) {
  return request<CommentMutationResult, CommentPayload>({
    url: `/posts/${id}/comments`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function togglePostLike(id: string, liked: boolean) {
  return request<LikeMutationResult, { liked: boolean }>({
    url: `/posts/${id}/like`,
    method: 'PATCH',
    data: { liked },
    auth: true,
  });
}

export function toggleCommentLike(id: string, liked: boolean) {
  return request<LikeMutationResult, { liked: boolean }>({
    url: `/comments/${id}/like`,
    method: 'PATCH',
    data: { liked },
    auth: true,
  });
}

export function createReport(payload: ReportPayload) {
  return request<ReportResult, ReportPayload>({ url: '/reports', method: 'POST', data: payload, auth: true });
}

export function fetchAdminReports(query: { schoolId?: string } = {}) {
  return request<AdminReportRow[]>({
    url: '/reports',
    data: query,
    adminAuth: true,
  }).then((items) =>
    items.map((item) => ({
      id: item.id,
      reporterUserId: item.reporter_user_id,
      targetType: item.target_type,
      targetId: item.target_id,
      reason: item.reason,
      detail: item.detail || undefined,
      status: item.status,
      schoolId: item.school_id || undefined,
      schoolName: item.school_name || undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
  );
}

export function fetchAdminModerationTasks(query: AdminModerationQuery = {}) {
  return request<AdminModerationTask[], AdminModerationQuery>({
    url: '/moderation/tasks',
    data: query,
    adminAuth: true,
  });
}

export function reviewAdminModerationTask(taskId: string, payload: AdminModerationDecisionPayload) {
  return request<AdminModerationDecisionResult, AdminModerationDecisionPayload>({
    url: `/moderation/tasks/${taskId}`,
    method: 'PATCH',
    data: payload,
    adminAuth: true,
  });
}

export function fetchAdminHomeFeedConfig() {
  return request<HomeFeedConfigResult>({
    url: '/admin/home-config',
    adminAuth: true,
  }).then((item): AdminHomeFeedConfig => item);
}

export function updateAdminHomeFeedConfig(payload: HomeFeedConfigPayload) {
  return request<HomeFeedConfigResult, HomeFeedConfigPayload>({
    url: '/admin/home-config',
    method: 'PATCH',
    data: payload,
    adminAuth: true,
  }).then((item): AdminHomeFeedConfig => item);
}

export function uploadAdminHomeFeedImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return request<HomeFeedImageUploadResult, FormData>({
    url: '/admin/home-config/hero-image',
    method: 'POST',
    data: formData,
    adminAuth: true,
    contentType: 'form',
  });
}

export function fetchTeamList(query: TeamQuery = {}) {
  return request<TeamItem[], TeamQuery>({ url: '/teams', data: query, auth: true });
}

export function fetchTeamDetail(id?: string) {
  return request<TeamItem>({ url: `/teams/${id}`, auth: true });
}

export function fetchAdminTeamExamples(query: { schoolId?: string; status?: string } = {}) {
  return request<AdminTeamExampleItem[], typeof query>({
    url: '/admin/team-examples',
    data: query,
    adminAuth: true,
  });
}

export function archiveAdminTeamExamples(ids: string[]) {
  return request<AdminTeamExampleArchiveResult, { ids: string[] }>({
    url: '/admin/team-examples/archive',
    method: 'PATCH',
    data: { ids },
    adminAuth: true,
  });
}

export function fetchAdminCompetitions(query: AdminCompetitionQuery = {}) {
  return request<AdminCompetitionItem[], AdminCompetitionQuery>({
    url: '/admin/competitions',
    data: query,
    adminAuth: true,
  });
}

export function createAdminCompetition(payload: AdminCompetitionPayload) {
  return request<AdminCompetitionItem, AdminCompetitionPayload>({
    url: '/admin/competitions',
    method: 'POST',
    data: payload,
    adminAuth: true,
  });
}

export function updateAdminCompetition(id: string, payload: AdminCompetitionPayload) {
  return request<AdminCompetitionItem, AdminCompetitionPayload>({
    url: `/admin/competitions/${id}`,
    method: 'PATCH',
    data: payload,
    adminAuth: true,
  });
}

export function publishAdminResource(file: File, payload: AdminResourcePublishPayload) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', payload.title);
  formData.append('category', payload.category);
  formData.append('description', payload.description);
  formData.append('suitableFor', payload.suitableFor);
  formData.append('tags', JSON.stringify(payload.tags));
  formData.append('previewPoints', JSON.stringify(payload.previewPoints));
  formData.append('relatedCompetitionIds', JSON.stringify(payload.relatedCompetitionIds));
  return request<AdminResourcePublishResult, FormData>({
    url: '/admin/resources/publish',
    method: 'POST',
    data: formData,
    adminAuth: true,
    contentType: 'form',
  });
}

export function fetchAdminDashboardSummary() {
  return request<AdminDashboardSummary>({ url: '/admin/dashboard', adminAuth: true });
}

export function fetchAdminSchoolHomeConfig(schoolId?: string) {
  return request<AdminSchoolHomeConfig, { schoolId?: string }>({
    url: '/admin/school-home-config',
    data: schoolId ? { schoolId } : {},
    adminAuth: true,
  });
}

export function updateAdminSchoolHomeConfig(payload: AdminSchoolHomePayload) {
  return request<AdminSchoolHomeConfig, AdminSchoolHomePayload>({
    url: '/admin/school-home-config',
    method: 'PATCH',
    data: payload,
    adminAuth: true,
  });
}

export function fetchAdminSchools(query: { keyword?: string; limit?: number; offset?: number } = {}) {
  return request<AdminSchoolListResult, typeof query>({ url: '/admin/schools', data: query, adminAuth: true });
}

export function updateAdminSchool(id: string, payload: { isOpen?: boolean; isHot?: boolean }) {
  return request<AdminSchoolItem, typeof payload>({
    url: `/admin/schools/${id}`,
    method: 'PATCH',
    data: payload,
    adminAuth: true,
  });
}

export function createAdminSchoolAdmin(schoolId: string, payload: AdminCreateSchoolAdminPayload) {
  return request<AdminSchoolItem['admins'][number], AdminCreateSchoolAdminPayload>({
    url: `/admin/schools/${schoolId}/admins`,
    method: 'POST',
    data: payload,
    adminAuth: true,
  });
}

export function updateAdminSchoolAdmin(adminId: string, payload: AdminUpdateSchoolAdminPayload) {
  return request<AdminSchoolItem['admins'][number], AdminUpdateSchoolAdminPayload>({
    url: `/admin/school-admins/${adminId}`,
    method: 'PATCH',
    data: payload,
    adminAuth: true,
  });
}

export function fetchAdminAuditLogs(query: {
  schoolId?: string;
  adminUserId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}) {
  return request<AdminAuditLogItem[], typeof query>({ url: '/admin/audit-logs', data: query, adminAuth: true });
}

export function acceptPostAnswer(id: string, payload: AcceptPostAnswerPayload) {
  return request<PostItem, AcceptPostAnswerPayload>({
    url: `/posts/${id}/accepted-comment`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function revealTeamContact(id: string) {
  return request<TeamContactRevealResult>({ url: `/teams/${id}/contact-views`, method: 'POST', auth: true });
}

export function publishTeamRecruit(payload: PublishTeamPayload) {
  return request<TeamItem, PublishTeamPayload>({ url: '/teams', method: 'POST', data: payload, auth: true });
}

export function createTeamApplication(id: string, payload: TeamApplicationPayload = {}) {
  return request<TeamApplicationResult, TeamApplicationPayload>({
    url: `/teams/${id}/applications`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}

export function fetchTeamApplications(teamId: string) {
  return request<TeamApplicationItem[]>({ url: `/teams/${teamId}/applications`, auth: true });
}

export function reviewTeamApplication(applicationId: string, payload: TeamApplicationDecisionPayload) {
  return request<TeamApplicationDecisionResult, TeamApplicationDecisionPayload>({
    url: `/team-applications/${applicationId}`,
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function fetchMessages(query: MessageQuery = {}) {
  return request<NotificationItem[], MessageQuery>({ url: '/notifications', data: query, auth: true });
}

export function markNotificationRead(id: string) {
  return request<NotificationReadResult>({ url: `/notifications/${id}/read`, method: 'PATCH', auth: true });
}

export function markNotificationsRead(payload: NotificationBatchReadPayload) {
  return request<NotificationBatchReadResult, NotificationBatchReadPayload>({
    url: '/notifications/read',
    method: 'PATCH',
    data: payload,
    auth: true,
  });
}

export function fetchFavorites(query: FavoriteQuery = {}) {
  return request<FavoriteCollection, FavoriteQuery>({ url: '/users/favorites', data: query, auth: true });
}

export function fetchSearchSuggestions() {
  return request<SearchSuggestion[]>({ url: '/search/suggestions' });
}

export function searchContent(query: SearchQuery) {
  return request<SearchResultItem[], SearchQuery>({ url: '/search', data: query, auth: true });
}

export function publishPost(payload: PublishPostPayload) {
  return request<PostItem, PublishPostPayload>({ url: '/posts', method: 'POST', data: payload, auth: true });
}

export function fetchOwnedResources() {
  return request<OwnedResourceItem[]>({ url: '/users/resources', auth: true });
}

export function fetchOrders() {
  return request<OrderItem[]>({ url: '/orders', auth: true });
}

export function fetchOrderDetail(id: string) {
  return request<OrderItem>({ url: `/orders/${id}`, auth: true });
}

export function createOrderPayment(id: string) {
  return request<OrderPayResult>({ url: `/orders/${id}/pay`, method: 'POST', auth: true });
}

export function createOrderRefund(id: string, payload: OrderRefundPayload) {
  return request<OrderRefundResult, OrderRefundPayload>({
    url: `/orders/${id}/refunds`,
    method: 'POST',
    data: payload,
    auth: true,
  });
}
