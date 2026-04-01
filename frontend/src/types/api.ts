import type {
  AiSource,
  CompetitionSort,
  MessageCategory,
  OrderItem,
  OwnedResourceItem,
  PostCommentItem,
  PostCategory,
  ResourceAccessStatus,
  ResourcePriceType,
  SearchScope,
  TeamApplicationStatus,
  UserProfile,
  FavoriteScope,
} from './entities';

export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

export interface CompetitionQuery {
  keyword?: string;
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
}

export interface TeamQuery {
  keyword?: string;
  compId?: string;
  status?: string;
  mineOnly?: boolean;
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
  title: string;
  compId?: string;
  compName: string;
  target: string;
  missingRoles: string[];
  deadline: string;
  requirements: string[];
  schoolLimit: boolean;
  contactHint: string;
}

export interface PublishPostPayload {
  title: string;
  category: Exclude<PostCategory, '推荐'>;
  content: string;
  tags: string[];
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
