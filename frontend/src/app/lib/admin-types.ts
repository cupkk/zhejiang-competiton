import type { Competition, CompetitionQualityStatus, CompetitionScheduleStatus, ModerationStatus } from '../../types/entities';
import type { HomeFeedConfigPayload } from '../../types/api';

export interface AdminModerationTask {
  id: string;
  targetType: 'post' | 'comment' | 'team' | 'report' | 'resource';
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
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  note?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface AdminModerationDecisionPayload {
  status: 'processing' | 'approved' | 'rejected';
  note?: string;
}

export interface AdminModerationDecisionResult {
  taskId: string;
  status: AdminModerationTask['status'];
}

export interface AdminTeamExampleItem {
  id: string;
  schoolId: string;
  schoolName: string;
  title: string;
  competitionName: string;
  listingType: 'team_recruit' | 'member_available';
  status: string;
  expiresAt?: string;
  createdAt: string;
  archived: boolean;
}

export interface AdminTeamExampleArchiveResult {
  archivedCount: number;
}

export interface AdminReportItem {
  id: string;
  reporterUserId: string;
  targetType: 'post' | 'comment' | 'team' | 'resource';
  targetId: string;
  reason: string;
  detail?: string;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  schoolId?: string;
  schoolName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceSubmissionSummary {
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
  sourceUrl?: string;
  moderationStatus?: ModerationStatus;
  reviewNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminHomeFeedConfig extends HomeFeedConfigPayload {
  updatedAt: string;
  effectiveStatus: HomeFeedConfigPayload['publishStatus'];
}

export interface AdminDashboardSummary {
  scope: 'platform' | 'school';
  schoolId?: string;
  schoolName?: string;
  pendingPosts: number;
  pendingTeams: number;
  pendingResources: number;
  pendingReports: number;
  approvedPosts: number;
  approvedTeams: number;
  approvedResources: number;
  platformHomeStatus?: string;
  platformBannerCount?: number;
}

export interface AdminSchoolHomeOption {
  id: string;
  title: string;
  meta: string;
}

export interface AdminSchoolHomeConfig {
  schoolId: string;
  schoolName: string;
  announcement: string;
  teamIds: string[];
  postIds: string[];
  availableTeams: AdminSchoolHomeOption[];
  availablePosts: AdminSchoolHomeOption[];
  updatedAt?: string;
}

export interface AdminSchoolHomePayload {
  schoolId?: string;
  announcement: string;
  teamIds: string[];
  postIds: string[];
}

export interface AdminSchoolAdminItem {
  id: string;
  username: string;
  displayName: string;
  status: 'active' | 'disabled';
  permissions: string[];
  lastLoginAt?: string;
  createdAt: string;
}

export interface AdminSchoolItem {
  id: string;
  name: string;
  shortName: string;
  province?: string;
  city?: string;
  logoUrl?: string;
  isOpen: boolean;
  isHot: boolean;
  verifiedUsers: number;
  approvedPosts: number;
  approvedTeams: number;
  approvedResources: number;
  admins: AdminSchoolAdminItem[];
}

export interface AdminSchoolListResult {
  items: AdminSchoolItem[];
  total: number;
}

export interface AdminCreateSchoolAdminPayload {
  username: string;
  password: string;
  displayName: string;
}

export interface AdminUpdateSchoolAdminPayload {
  displayName?: string;
  password?: string;
  status?: 'active' | 'disabled';
}

export interface AdminAuditLogItem {
  id: string;
  adminUserId: string;
  adminUsername: string;
  adminDisplayName: string;
  adminRole: string;
  schoolId?: string;
  schoolName?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export type AdminCompetitionPublishStatus = 'draft' | 'published' | 'archived';

export interface AdminCompetitionItem extends Competition {
  publishStatus: AdminCompetitionPublishStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCompetitionPayload {
  title: string;
  level: string;
  category: string;
  host: string;
  target: string;
  status: string;
  deadline: string;
  difficulty: string;
  description: string;
  teamSize: string;
  stages: string[];
  submissionMaterials: string[];
  tags: string[];
  recommendedFor: string[];
  actionHints: string[];
  registrationStart?: string;
  registrationEnd?: string;
  competitionStart?: string;
  competitionEnd?: string;
  awards?: string;
  feeDescription?: string;
  officialContact?: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  editionLabel: string;
  scheduleStatus: CompetitionScheduleStatus;
  registrationMethod?: string;
  tracks: string[];
  qualityStatus: CompetitionQualityStatus;
  publishStatus: AdminCompetitionPublishStatus;
}

export interface AdminResourcePublishPayload {
  title: string;
  category: string;
  description: string;
  suitableFor: string;
  tags: string[];
  previewPoints: string[];
  relatedCompetitionIds: string[];
}

export interface AdminResourcePublishResult {
  id: string;
  title: string;
  schoolId?: string;
  contentScope: 'platform' | 'school';
  fileAssetId: string;
  moderationStatus: 'approved';
}
