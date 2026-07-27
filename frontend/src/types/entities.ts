export type CompetitionStatus = '报名中' | '即将截止' | '报名未开始' | '已截止';
export type CompetitionSort = '推荐' | '最热' | '即将截止' | '最新';
export type ResourcePriceType = '全部' | '免费' | '付费';
export type SearchScope = 'all' | 'competitions' | 'resources' | 'posts' | 'teams';
export type AiSource = 'competition' | 'resource' | 'general';
export type HomeQuickLinkId = 'competitions' | 'resources' | 'teams' | 'community' | 'ai';
export type MessageCategory = '全部' | '系统' | '组队' | '审核' | '订单';
export type PostCategory = '推荐' | '资讯' | '经验贴' | '问答' | '避坑';
export type TeamRecruitStatus = '招募中' | '审核中' | '已满员';
export type TeamListingType = 'team_recruit' | 'member_available';
export type TeamVisibilityScope = 'school' | 'cross_school';
export type OrderStatus = '已完成' | '待支付' | '退款中' | '已退款';
export type ResourceAccessStatus = 'not_acquired' | 'owned' | 'pending_payment';
export type TeamApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type FavoriteScope = 'all' | 'competition' | 'resource' | 'post';
export type NotificationLinkType = 'competition' | 'resource' | 'team' | 'post' | 'order';
export type NotificationLinkScene = 'refund_result' | 'comment_reply';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type SchoolCertificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type SchoolMembershipRole = 'student' | 'alumni' | 'teacher' | 'visitor';
export type ContentScope = 'platform' | 'school';

export interface School {
  id: string;
  sourceId?: string;
  code?: string;
  name: string;
  shortName: string;
  province?: string;
  city?: string;
  logoUrl?: string;
  isOpen: boolean;
  isHot: boolean;
}

export interface SchoolMembership {
  id: string;
  schoolId: string;
  schoolName: string;
  role: SchoolMembershipRole;
  certificationStatus: SchoolCertificationStatus;
  educationEmail?: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  active: boolean;
  verifiedAt?: string;
}

export interface SchoolVerificationCodeResult {
  channel: 'email' | 'phone';
  target: string;
  expiresAt: string;
  debugCode?: string;
}

export interface SchoolVerificationResult {
  membership: SchoolMembership;
  user: UserProfile;
}

export interface CompetitionViewerState {
  isFavorited: boolean;
  isEnrolled: boolean;
  favoritedAt?: string;
}

export type CompetitionScheduleStatus = 'announced' | 'partially_announced' | 'not_announced' | 'closed';
export type CompetitionQualityStatus = 'verified' | 'pending_review' | 'stale';
export type CompetitionDataFreshness = 'current' | 'reference' | 'rules_only';

export interface CompetitionNotice {
  id: string;
  title: string;
  publishedAt?: string;
  sourceUrl: string;
  fileType: string;
  storageUrl?: string;
}

export interface ResourceViewerState {
  isFavorited: boolean;
  accessStatus: ResourceAccessStatus;
  favoritedAt?: string;
  canManage?: boolean;
}

export interface TeamViewerState {
  hasApplied: boolean;
  applicationStatus: TeamApplicationStatus;
  isOwner?: boolean;
  canViewContact?: boolean;
  pendingApplicationCount?: number;
}

export interface PostViewerState {
  isLiked: boolean;
  isFavorited: boolean;
  favoritedAt?: string;
  isOwner?: boolean;
}

export type QuestionStatus = 'open' | 'resolved';
export type QuestionFilter = 'latest' | 'unanswered' | 'resolved';

export interface ResourceFileSummary {
  assetId: string;
  originalName: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface Competition {
  id: string;
  schoolId?: string;
  contentScope: ContentScope;
  title: string;
  level: string;
  category: string;
  host: string;
  target: string;
  status: CompetitionStatus | string;
  deadline: string;
  daysLeft: number;
  views: number;
  favoriteCount: number;
  difficulty: string;
  coverLabel: string;
  coverGradient: string;
  tags: string[];
  description: string;
  recommendedFor: string[];
  actionHints: string[];
  registrationStart?: string;
  registrationEnd?: string;
  competitionStart?: string;
  competitionEnd?: string;
  teamSize?: string;
  stages: string[];
  submissionMaterials: string[];
  awards?: string;
  feeDescription?: string;
  officialContact?: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  editionLabel: string;
  currentEditionLabel?: string;
  referenceEditionLabel?: string;
  referenceNoticeUrl?: string;
  scheduleNote?: string;
  dataFreshness: CompetitionDataFreshness;
  scheduleStatus: CompetitionScheduleStatus;
  registrationMethod?: string;
  tracks: string[];
  qualityStatus: CompetitionQualityStatus;
  notices: CompetitionNotice[];
  viewer?: CompetitionViewerState;
}

export interface ResourceItem {
  id: string;
  schoolId?: string;
  contentScope: ContentScope;
  title: string;
  type: string;
  category: string;
  price: number;
  downloads: number;
  rating: number;
  authorName: string;
  authorMark: string;
  authorTitle: string;
  coverLabel: string;
  coverGradient: string;
  tags: string[];
  description: string;
  sizeLabel: string;
  suitableFor: string;
  previewPoints: string[];
  relatedCompetitionIds: string[];
  sourceUrl?: string;
  moderationStatus?: ModerationStatus;
  reviewNote?: string;
  createdAt?: string;
  updatedAt?: string;
  file?: ResourceFileSummary;
  viewer?: ResourceViewerState;
}

export interface TeamItem {
  id: string;
  schoolId?: string;
  schoolName?: string;
  contentScope: ContentScope;
  listingType?: TeamListingType;
  title: string;
  compId?: string;
  compName: string;
  status: TeamRecruitStatus | string;
  target: string;
  fullDescription?: string;
  current: number;
  max: number;
  missingRoles: string[];
  deadline: string;
  authorName: string;
  authorMark: string;
  authorGrade: string;
  authorMajor: string;
  schoolLimit: boolean;
  visibilityScope: TeamVisibilityScope;
  requirements: string[];
  goalTags?: string[];
  capabilities?: string[];
  collaborationMode?: string;
  weeklyCommitment?: string;
  contactHint: string;
  contactEmail?: string;
  isExample?: boolean;
  exampleExpiresAt?: string;
  moderationStatus?: ModerationStatus;
  viewer?: TeamViewerState;
}

export interface PostItem {
  id: string;
  schoolId?: string;
  contentScope: ContentScope;
  title: string;
  excerpt: string;
  content: string[];
  category: Exclude<PostCategory, '推荐'>;
  authorName: string;
  authorMark: string;
  likes: number;
  comments: number;
  tags: string[];
  time: string;
  relatedCompetitionId?: string;
  relatedResourceId?: string;
  questionStatus?: QuestionStatus;
  acceptedCommentId?: string;
  moderationStatus?: ModerationStatus;
  viewer?: PostViewerState;
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
  status: ModerationStatus;
  createdAt: string;
  replyCount?: number;
  isAccepted?: boolean;
  replies?: PostCommentItem[];
  viewer: {
    isLiked: boolean;
  };
}

export interface NotificationItem {
  id: string;
  category: Exclude<MessageCategory, '全部'>;
  title: string;
  content: string;
  time: string;
  unread: boolean;
  linkType: NotificationLinkType;
  linkId?: string;
  linkScene?: NotificationLinkScene;
  commentId?: string;
  ctaText: string;
}

export interface SearchSuggestion {
  id: string;
  label: string;
  scope: SearchScope;
}

export interface SearchResultItem {
  id: string;
  scope: SearchScope;
  title: string;
  subtitle: string;
  meta: string;
  tags: string[];
  link: string;
}

export interface AiConversationBootstrap {
  openingMessage: string;
  source: AiSource;
  targetTitle?: string;
}

export interface AiReplyResult {
  reply: string;
}

export interface HomeBannerItem {
  id: string;
  badge: string;
  title: string;
  imageUrl: string;
  link: string;
}

export interface HomeQuickLinkItem {
  id: HomeQuickLinkId;
  enabled: boolean;
}

export interface HomeFeed {
  heroBadge?: string;
  heroPrompt?: string;
  heroImageUrl?: string;
  banners: HomeBannerItem[];
  quickLinks: HomeQuickLinkItem[];
  schoolAnnouncement?: {
    text: string;
    link: string;
    updatedAt?: string;
  };
  urgentCompetitions: Competition[];
  hotResources: ResourceItem[];
  latestTeams: TeamItem[];
  featuredPosts: PostItem[];
}

export interface FavoriteCollection {
  competitions: Competition[];
  resources: ResourceItem[];
  posts: PostItem[];
}

export interface UserStats {
  favorites: number;
  teams: number;
  resources: number;
  unreadMessages: number;
  points: number;
  checkinStreak: number;
}

export interface UserProfile {
  id: string;
  name: string;
  mark: string;
  avatarUrl?: string;
  school: string;
  schoolId?: string;
  schoolCertificationStatus: SchoolCertificationStatus;
  major: string;
  grade: string;
  bio: string;
  focusTags: string[];
  stats: UserStats;
}

export interface CheckinState {
  points: number;
  streak: number;
  checkedInToday: boolean;
  lastCheckinDate?: string;
  todayReward: number;
  month: string;
  checkedDates: string[];
  calendar: CheckinCalendarDay[];
}

export interface CheckinCalendarDay {
  date: string;
  day: number;
  checked: boolean;
  today: boolean;
}

export interface CheckinResult extends CheckinState {
  awardedPoints: number;
  message: string;
  user: UserProfile;
}

export interface OwnedResourceItem {
  id: string;
  resourceId: string;
  title: string;
  type: string;
  accessType: 'free' | 'paid';
  acquiredAt: string;
  downloadCount: number;
  tags: string[];
}

export interface OrderItem {
  id: string;
  title: string;
  itemType: 'resource' | 'service';
  amount: number;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  resourceId?: string;
  coverLabel: string;
  updatedAt?: string;
  refundId?: string;
  refundReason?: string;
  refundRequestedAt?: string;
  refundCompletedAt?: string;
}

export interface CompetitionEnrollmentItem {
  id: string;
  competitionId: string;
  status: 'enrolled' | 'pending';
  createdAt: string;
  competition: Competition;
}

export interface TeamApplicationItem {
  id: string;
  teamId: string;
  teamTitle: string;
  teamCompName: string;
  applicantId: string;
  applicantName: string;
  applicantMark: string;
  applicantSchool: string;
  applicantMajor: string;
  applicantGrade: string;
  applicantBio: string;
  applicantFocusTags: string[];
  message: string;
  status: Exclude<TeamApplicationStatus, 'none'>;
  createdAt: string;
}

export interface UserActivityCollection {
  publishedTeams: TeamItem[];
  publishedPosts: PostItem[];
  competitionEnrollments: CompetitionEnrollmentItem[];
  teamApplications: TeamApplicationItem[];
}
