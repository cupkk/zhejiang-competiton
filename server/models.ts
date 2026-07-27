import type {
  NotificationItem,
  OrderItem,
  OwnedResourceItem,
  PostItem,
  SearchSuggestion,
} from '../frontend/src/types/entities';
import type {
  AdminPermission,
  AdminRole,
  AdminSession as AdminSessionPayload,
} from '../frontend/src/types/api';

export type SessionMode = 'remote' | 'mock';

export interface AdminUserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: AdminRole;
  permissions_json: string;
  school_id: string | null;
  school_name: string | null;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface AdminSessionRow {
  token: string;
  admin_user_id: string;
  role: AdminRole;
  expires_at: string;
  created_at: string;
}

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
  avatar_url: string | null;
  school: string;
  major: string;
  grade: string;
  bio: string;
  focus_tags_json: string;
  points: number;
  checkin_streak: number;
  last_checkin_date: string | null;
}

export interface PointLedgerRow {
  id: string;
  user_id: string;
  type: 'checkin' | 'adjustment';
  points: number;
  balance_after: number;
  note: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
}

export interface SchoolRow {
  id: string;
  source_id: string | null;
  code: string | null;
  name: string;
  short_name: string;
  province: string | null;
  city: string | null;
  logo_url: string | null;
  is_open: number;
  is_hot: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSchoolMembershipRow {
  id: string;
  user_id: string;
  school_id: string;
  school_name: string;
  role: 'student' | 'alumni' | 'teacher' | 'visitor';
  certification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  education_email: string | null;
  phone: string | null;
  email_verified: number;
  phone_verified: number;
  active: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitionRow {
  id: string;
  school_id: string | null;
  content_scope: string;
  title: string;
  level: string;
  category: string;
  host: string;
  target: string;
  status: string;
  deadline: string;
  days_left: number;
  views: number;
  favorite_count?: number;
  difficulty: string;
  cover_label: string;
  cover_gradient: string;
  tags_json: string;
  description: string;
  recommended_for_json: string;
  action_hints_json: string;
  registration_start: string | null;
  registration_end: string | null;
  competition_start: string | null;
  competition_end: string | null;
  team_size: string | null;
  stages_json: string;
  submission_materials_json: string;
  awards: string | null;
  fee_description: string | null;
  official_contact: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  edition_label: string;
  current_edition_label: string | null;
  reference_edition_label: string | null;
  reference_notice_url: string | null;
  schedule_note: string | null;
  data_freshness: 'current' | 'reference' | 'rules_only';
  schedule_status: 'announced' | 'partially_announced' | 'not_announced' | 'closed';
  registration_method: string | null;
  tracks_json: string;
  quality_status: 'verified' | 'pending_review' | 'stale';
  created_at: string | null;
  publish_status?: 'draft' | 'published' | 'archived';
  updated_at?: string | null;
}

export interface SchoolHomeConfigRow {
  school_id: string;
  announcement: string;
  team_ids_json: string;
  post_ids_json: string;
  updated_by_admin_id: string | null;
  updated_at: string;
}

export interface CompetitionNoticeRow {
  id: string;
  competition_id: string;
  title: string;
  published_at: string | null;
  source_url: string;
  file_type: string;
  storage_url: string | null;
  created_at: string;
}

export interface ResourceRow {
  id: string;
  school_id: string | null;
  content_scope: string;
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
  author_user_id: string | null;
  file_asset_id: string | null;
  source_url: string | null;
  moderation_status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceAssetRow {
  id: string;
  user_id: string;
  storage_provider: 'local' | 's3';
  storage_key: string;
  local_path: string | null;
  original_name: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface AdminAuditLogRow {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail_json: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface TeamRow {
  id: string;
  school_id: string | null;
  visibility_scope: string;
  content_scope: string;
  listing_type: string;
  title: string;
  comp_id: string | null;
  comp_name: string;
  status: string;
  target: string;
  full_description: string;
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
  goal_tags_json: string;
  capabilities_json: string;
  collaboration_mode: string;
  weekly_commitment: string;
  contact_hint: string;
  contact_email: string | null;
  is_example: number;
  example_expires_at: string | null;
  moderation_status: string;
  created_at: string;
}

export interface PostRow {
  id: string;
  school_id: string | null;
  content_scope: string;
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
  question_status: string;
  accepted_comment_id: string | null;
  moderation_status: string;
  created_at: string;
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

export interface CompetitionEnrollmentRow {
  id: string;
  user_id: string;
  competition_id: string;
  status: 'enrolled' | 'pending';
  created_at: string;
}

export interface TeamApplicationRow {
  id: string;
  team_id: string;
  user_id: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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
  target_type: 'post' | 'comment' | 'team' | 'report' | 'resource';
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

export interface HomeFeedConfigRow {
  id: string;
  hero_badge?: string;
  hero_prompt?: string;
  hero_image_url?: string;
  banners_json: string;
  quick_links_json: string;
  publish_status: 'draft' | 'scheduled' | 'online' | 'offline';
  publish_at: string | null;
  offline_at: string | null;
  competition_limit: number;
  resource_limit: number;
  team_limit: number;
  post_limit: number;
  competition_ids_json: string;
  resource_ids_json: string;
  team_ids_json: string;
  post_ids_json: string;
  updated_at: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  mode: SessionMode;
  expiresAt: string;
}

export interface AdminAuthSession extends AdminSessionPayload {
  expiresAt: string;
}

export interface AdminIdentity {
  token: string;
  adminUserId: string;
  role: AdminRole;
  schoolId: string | null;
  schoolName: string | null;
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
  isAccepted?: boolean;
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
  targetTitle?: string;
  targetSummary?: string;
  targetOwner?: string;
  targetStatus?: string;
  targetSourceUrl?: string;
  targetVisibilityScope?: 'school' | 'cross_school';
  targetContactEmail?: string;
  schoolId?: string;
  schoolName?: string;
  action: string;
  status: ModerationTaskRow['status'];
  note?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface ModerationTaskQuery {
  status?: ModerationTaskRow['status'];
  targetType?: ModerationTaskRow['target_type'];
  schoolId?: string;
}

export interface ReportQuery {
  schoolId?: string;
}

export interface AdminContentScope {
  role: AdminRole;
  schoolId?: string | null;
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
