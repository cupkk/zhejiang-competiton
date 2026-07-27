import type {
  Competition,
  NotificationItem,
  OrderItem,
  OwnedResourceItem,
  PostItem,
  ResourceItem,
  SearchSuggestion,
  TeamItem,
  UserProfile,
} from '../types/entities';

export const competitions: Competition[] = [];
export const resources: ResourceItem[] = [];
export const teams: TeamItem[] = [];
export const posts: PostItem[] = [];
export const notifications: NotificationItem[] = [];
export const searchSuggestions: SearchSuggestion[] = [];
export const ownedResources: OwnedResourceItem[] = [];
export const orders: OrderItem[] = [];

export const userProfile: UserProfile = {
  id: '',
  name: '',
  mark: '',
  school: '',
  schoolCertificationStatus: 'unverified',
  major: '',
  grade: '',
  bio: '',
  focusTags: [],
  stats: {
    favorites: 0,
    teams: 0,
    resources: 0,
    unreadMessages: 0,
    points: 0,
    checkinStreak: 0,
  },
};

export function getCompetitionById(id?: string) {
  return competitions.find((item) => item.id === id);
}

export function getResourceById(id?: string) {
  return resources.find((item) => item.id === id);
}

export function getTeamById(id?: string) {
  return teams.find((item) => item.id === id);
}

export function getPostById(id?: string) {
  return posts.find((item) => item.id === id);
}

export function getResourcesForCompetition(compId: string) {
  return resources.filter((item) => item.relatedCompetitionIds.includes(compId));
}

export function getTeamsForCompetition(compId: string) {
  return teams.filter((item) => item.compId === compId);
}

export function getMyTeams() {
  return [];
}
