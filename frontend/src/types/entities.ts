import {
  COMPETITION_SORT_OPTIONS,
  COMPETITION_STATUS_OPTIONS,
  MESSAGE_CATEGORY_OPTIONS,
  ORDER_STATUS_OPTIONS,
  POST_CATEGORY_OPTIONS,
  RESOURCE_PRICE_OPTIONS,
  SEARCH_SCOPE_VALUES,
  TEAM_RECRUIT_STATUS_OPTIONS,
} from '../constants/enums';

export type CompetitionStatus = (typeof COMPETITION_STATUS_OPTIONS)[number];
export type CompetitionSort = (typeof COMPETITION_SORT_OPTIONS)[number];
export type ResourcePriceType = (typeof RESOURCE_PRICE_OPTIONS)[number];
export type SearchScope = (typeof SEARCH_SCOPE_VALUES)[number];
export type AiSource = 'competition' | 'resource' | 'general';
export type MessageCategory = (typeof MESSAGE_CATEGORY_OPTIONS)[number];
export type PostCategory = (typeof POST_CATEGORY_OPTIONS)[number];
export type TeamRecruitStatus = (typeof TEAM_RECRUIT_STATUS_OPTIONS)[number];
export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number];
export type ResourceAccessStatus = 'not_acquired' | 'owned' | 'pending_payment';
export type TeamApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type FavoriteScope = 'all' | 'competition' | 'resource' | 'post';
export type NotificationLinkType = 'competition' | 'resource' | 'team' | 'post' | 'order';
export type NotificationLinkScene = 'refund_result' | 'comment_reply';

export interface CompetitionViewerState {
  isFavorited: boolean;
  isEnrolled: boolean;
  favoritedAt?: string;
}

export interface ResourceViewerState {
  isFavorited: boolean;
  accessStatus: ResourceAccessStatus;
  favoritedAt?: string;
}

export interface TeamViewerState {
  hasApplied: boolean;
  applicationStatus: TeamApplicationStatus;
}

export interface PostViewerState {
  isLiked: boolean;
  isFavorited: boolean;
  favoritedAt?: string;
}

export interface Competition {
  id: string;
  title: string;
  level: string;
  category: string;
  host: string;
  target: string;
  status: CompetitionStatus;
  deadline: string;
  daysLeft: number;
  views: number;
  difficulty: string;
  coverLabel: string;
  coverGradient: string;
  tags: string[];
  description: string;
  recommendedFor: string[];
  actionHints: string[];
  viewer?: CompetitionViewerState;
}

export interface ResourceItem {
  id: string;
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
  viewer?: ResourceViewerState;
}

export interface TeamItem {
  id: string;
  title: string;
  compId?: string;
  compName: string;
  status: TeamRecruitStatus | string;
  target: string;
  current: number;
  max: number;
  missingRoles: string[];
  deadline: string;
  authorName: string;
  authorMark: string;
  authorGrade: string;
  authorMajor: string;
  schoolLimit: boolean;
  requirements: string[];
  contactHint: string;
  viewer?: TeamViewerState;
}

export interface PostItem {
  id: string;
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
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  replyCount?: number;
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

export interface HomeFeed {
  heroPrompt: string;
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
}

export interface UserProfile {
  id: string;
  name: string;
  mark: string;
  school: string;
  major: string;
  grade: string;
  bio: string;
  focusTags: string[];
  stats: UserStats;
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
  refundId?: string;
  refundReason?: string;
  refundRequestedAt?: string;
  refundCompletedAt?: string;
}
