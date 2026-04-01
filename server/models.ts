import type {
  NotificationItem,
  OrderItem,
  OwnedResourceItem,
  PostItem,
  SearchSuggestion,
} from '../frontend/src/types/entities';

export type SessionMode = 'remote' | 'mock';

export interface SessionRow {
  token: string;
  user_id: string;
  mode: SessionMode;
  expires_at: string;
}

export interface UserRow {
  id: string;
  open_id: string;
  union_id: string | null;
  session_key: string | null;
  name: string;
  mark: string;
  school: string;
  major: string;
  grade: string;
  bio: string;
  focus_tags_json: string;
}

export interface CompetitionRow {
  id: string;
  title: string;
  level: string;
  category: string;
  host: string;
  target: string;
  status: string;
  deadline: string;
  days_left: number;
  views: number;
  difficulty: string;
  cover_label: string;
  cover_gradient: string;
  tags_json: string;
  description: string;
  recommended_for_json: string;
  action_hints_json: string;
}

export interface ResourceRow {
  id: string;
  title: string;
  type: string;
  category: string;
  price: number;
  downloads: number;
  rating: number;
  author_name: string;
  author_mark: string;
  author_title: string;
  cover_label: string;
  cover_gradient: string;
  tags_json: string;
  description: string;
  size_label: string;
  suitable_for: string;
  preview_points_json: string;
}

export interface TeamRow {
  id: string;
  title: string;
  comp_id: string | null;
  comp_name: string;
  status: string;
  target: string;
  current_count: number;
  max_count: number;
  missing_roles_json: string;
  deadline: string;
  author_user_id: string | null;
  author_name: string;
  author_mark: string;
  author_grade: string;
  author_major: string;
  school_limit: number;
  requirements_json: string;
  contact_hint: string;
  moderation_status: string;
}

export interface PostRow {
  id: string;
  title: string;
  excerpt: string;
  content_json: string;
  category: PostItem['category'];
  author_user_id: string | null;
  author_name: string;
  author_mark: string;
  likes_count: number;
  comments_count: number;
  tags_json: string;
  time_label: string;
  related_competition_id: string | null;
  related_resource_id: string | null;
  moderation_status: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  category: NotificationItem['category'];
  title: string;
  content: string;
  time_label: string;
  unread: number;
  link_type: NotificationItem['linkType'];
  link_id: string | null;
  link_scene: NonNullable<NotificationItem['linkScene']> | null;
  comment_id: string | null;
  cta_text: string;
}

export interface OwnedResourceRow {
  id: string;
  user_id: string;
  resource_id: string;
  title: string;
  type: string;
  access_type: OwnedResourceItem['accessType'];
  acquired_at: string;
  download_count: number;
  tags_json: string;
}

export interface OrderRow {
  id: string;
  user_id: string;
  title: string;
  item_type: OrderItem['itemType'];
  amount: number;
  status: OrderItem['status'];
  created_at: string;
  paid_at: string | null;
  resource_id: string | null;
  cover_label: string;
  updated_at?: string;
}

export interface SearchSuggestionRow {
  id: string;
  label: string;
  scope: SearchSuggestion['scope'];
}

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  reply_to_comment_id: string | null;
  author_name: string;
  author_mark: string;
  content: string;
  likes_count: number;
  moderation_status: string;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_user_id: string;
  target_type: 'post' | 'comment' | 'team' | 'resource';
  target_id: string;
  reason: string;
  detail: string | null;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface ModerationTaskRow {
  id: string;
  target_type: 'post' | 'comment' | 'team' | 'report';
  target_id: string;
  action: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface DownloadGrantRow {
  id: string;
  user_id: string;
  resource_id: string;
  order_id: string | null;
  grant_type: string;
  download_url: string;
  expires_at: string | null;
}

export interface RefundRow {
  id: string;
  order_id: string;
  out_refund_no: string;
  refund_id: string | null;
  amount: number;
  reason: string | null;
  status: 'processing' | 'success' | 'closed' | 'abnormal';
  payload_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  mode: SessionMode;
  expiresAt: string;
}

export interface PostCommentItem {
  id: string;
  postId: string;
  parentCommentId?: string;
  replyToCommentId?: string;
  replyToAuthorName?: string;
  authorName: string;
  authorMark: string;
  content: string;
  likes: number;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  replyCount?: number;
  replies?: PostCommentItem[];
  viewer: {
    isLiked: boolean;
  };
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
  status: 'approved' | 'pending';
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

export interface ModerationTaskItem {
  id: string;
  targetType: ModerationTaskRow['target_type'];
  targetId: string;
  action: string;
  status: ModerationTaskRow['status'];
  note?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface ModerationTaskQuery {
  status?: ModerationTaskRow['status'];
  targetType?: ModerationTaskRow['target_type'];
}

export interface ReviewModerationPayload {
  status: 'processing' | 'approved' | 'rejected';
  note?: string;
}

export interface ReviewModerationResult {
  taskId: string;
  status: ModerationTaskRow['status'];
}

export interface ResourceDownloadResult {
  grantId: string;
  downloadUrl: string;
  expiresAt: string | null;
  filename: string;
}

export interface PaymentNotifyPayload {
  orderId: string;
  transactionId?: string;
  paidAmount?: number;
  status: 'SUCCESS' | 'REFUND' | 'CLOSED';
  rawPayload?: Record<string, unknown>;
}

export interface PaymentNotifyResult {
  orderId: string;
  status: OrderItem['status'];
  ownedResourceCreated: boolean;
}
