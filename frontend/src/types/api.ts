import type {
  AiSource,
  CompetitionSort,
  FavoriteScope,
  HomeBannerItem,
  HomeQuickLinkItem,
  MessageCategory,
  OrderItem,
  OwnedResourceItem,
  PostCommentItem,
  PostCategory,
  ResourceAccessStatus,
  ResourcePriceType,
  School,
  SearchScope,
  TeamApplicationStatus,
  TeamListingType,
  TeamVisibilityScope,
  QuestionFilter,
  UserProfile,
  CheckinResult,
  CheckinState,
} from './entities';

export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

export interface CompetitionQuery {
  keyword?: string;
  category?: string;
  level?: string;
  sort?: CompetitionSort;
  limit?: number;
}

export interface ResourceQuery {
  keyword?: string;
  priceType?: ResourcePriceType;
  category?: string;
  limit?: number;
}

export interface PostQuery {
  category?: PostCategory;
  keyword?: string;
  relatedCompetitionId?: string;
  questionFilter?: QuestionFilter;
}

export interface TeamQuery {
  keyword?: string;
  compId?: string;
  status?: string;
  listingType?: TeamListingType;
  mineOnly?: boolean;
  showcase?: boolean;
  schoolScope?: 'all' | 'current' | 'other';
}

export interface TeamContactRevealResult {
  teamId: string;
  contactHint: string;
  revealedAt: string;
}

export interface SchoolQuery {
  keyword?: string;
  hotOnly?: boolean;
  limit?: number;
}

export interface SearchQuery {
  keyword: string;
  scope: SearchScope;
}

export interface AiBootstrapQuery {
  source?: AiSource;
  id?: string;
}

export interface AiReplyPayload extends AiBootstrapQuery {
  message: string;
}

export interface PublishTeamPayload {
  listingType?: TeamListingType;
  title: string;
  compId?: string;
  compName: string;
  target: string;
  fullDescription?: string;
  missingRoles: string[];
  deadline: string;
  requirements: string[];
  goalTags?: string[];
  capabilities?: string[];
  collaborationMode?: string;
  weeklyCommitment?: string;
  currentCount?: number;
  maxCount?: number;
  schoolLimit: boolean;
  contactHint: string;
  visibilityScope: TeamVisibilityScope;
  contactEmail: string;
}

export interface PublishPostPayload {
  title: string;
  category: Exclude<PostCategory, '推荐'>;
  content: string;
  tags: string[];
  relatedCompetitionId?: string;
}

export interface AcceptPostAnswerPayload {
  commentId: string;
}

export interface PublishResourcePayload {
  title: string;
  type: string;
  category: string;
  price: number;
  description: string;
  sizeLabel: string;
  suitableFor: string;
  tags: string[];
  previewPoints: string[];
  relatedCompetitionIds: string[];
  assetId: string;
}

export interface UpdateUserProfilePayload {
  name: string;
  avatarUrl?: string;
  school: string;
  major: string;
  grade: string;
  bio: string;
  focusTags: string[];
}

export interface UpdateUserIdentityPayload {
  name: string;
  avatarUrl?: string;
}

export type CheckinStateResponse = CheckinState;
export type CheckinResponse = CheckinResult;

export interface SelectSchoolPayload {
  schoolId?: string;
  school: string;
}

export interface SchoolVerificationCodePayload {
  schoolId?: string;
  channel: 'email' | 'phone';
  target: string;
}

export interface SchoolVerificationVerifyPayload extends SchoolVerificationCodePayload {
  code: string;
}

export interface MessageQuery {
  category?: MessageCategory;
}

export interface FavoriteQuery {
  scope?: FavoriteScope;
}

export interface LoginPayload {
  code: string;
}

export interface LoginSession {
  token: string;
  user: UserProfile;
  mode: 'mock' | 'remote';
}

export type AdminRole = 'super_admin' | 'moderator' | 'operator' | 'school_admin';
export type AdminPermission =
  | 'home:read'
  | 'home:write'
  | 'school_home:read'
  | 'school_home:write'
  | 'moderation:read'
  | 'moderation:write'
  | 'school_management:read'
  | 'school_management:write'
  | 'competition_management:read'
  | 'competition_management:write'
  | 'audit:read';

export interface AdminProfile {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  permissions: AdminPermission[];
  scope: 'platform' | 'school';
  schoolId?: string;
  schoolName?: string;
}

export interface AdminLoginPayload {
  username: string;
  password: string;
}

export interface AdminSession {
  token: string;
  admin: AdminProfile;
}

export interface ToggleFavoritePayload {
  favorite: boolean;
}

export interface FavoriteMutationResult {
  targetId: string;
  favorite: boolean;
}

export interface NotificationReadResult {
  notificationId: string;
  unread: boolean;
  unreadCount: number;
}

export interface NotificationBatchReadPayload {
  ids?: string[];
  all?: boolean;
  category?: MessageCategory;
}

export interface NotificationBatchReadResult {
  updatedCount: number;
  unreadCount: number;
}

export interface CompetitionEnrollmentResult {
  competitionId: string;
  enrolled: boolean;
  status: 'enrolled' | 'pending';
}

export interface TeamApplicationPayload {
  message?: string;
}

export interface TeamApplicationResult {
  teamId: string;
  applied: boolean;
  status: Exclude<TeamApplicationStatus, 'none'>;
}

export interface TeamApplicationDecisionPayload {
  status: 'approved' | 'rejected';
}

export interface TeamApplicationDecisionResult {
  applicationId: string;
  teamId: string;
  status: 'approved' | 'rejected';
  current: number;
  max: number;
  teamStatus: string;
}

export interface ResourceAcquirePayload {
  mode: 'free' | 'paid';
}

export interface ResourceAcquireResult {
  resourceId: string;
  accessStatus: Exclude<ResourceAccessStatus, 'not_acquired'>;
  order?: OrderItem;
  ownedResource?: OwnedResourceItem;
}

export interface CommentPayload {
  content: string;
  parentCommentId?: string;
  replyToCommentId?: string;
}

export interface CommentMutationResult {
  commentId: string;
  postId: string;
  parentCommentId?: string;
  replyToCommentId?: string;
  status: Extract<PostCommentItem['status'], 'approved' | 'pending'>;
}

export interface LikeMutationResult {
  targetId: string;
  liked: boolean;
  likes: number;
}

export interface ReportPayload {
  targetType: 'post' | 'comment' | 'team' | 'resource';
  targetId: string;
  reason: string;
  detail?: string;
}

export interface ReportResult {
  reportId: string;
  status: 'pending';
}

export interface ResourceAssetUploadResult {
  assetId: string;
  originalName: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface ResourceDownloadResult {
  grantId: string;
  downloadUrl: string;
  expiresAt: string | null;
  filename: string;
}

export interface WechatMiniProgramPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

export interface OrderPayResult {
  orderId: string;
  status: OrderItem['status'];
  paymentMode: 'mock' | 'wechat_pay_v3';
  paymentParams?: WechatMiniProgramPayParams;
}

export interface OrderRefundPayload {
  reason?: string;
}

export interface OrderRefundResult {
  orderId: string;
  status: OrderItem['status'];
  refundMode: 'mock' | 'wechat_pay_v3';
  refundId?: string;
}

export interface HomeFeedConfigPayload {
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
}

export interface HomeFeedConfigResult extends HomeFeedConfigPayload {
  updatedAt: string;
  effectiveStatus: 'draft' | 'scheduled' | 'online' | 'offline';
}

export interface HomeFeedImageUploadResult {
  fileName: string;
  imageUrl: string;
}

export interface AvatarImageUploadResult {
  fileName: string;
  avatarUrl: string;
}

export type SchoolListResult = School[];
