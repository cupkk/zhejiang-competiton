import type { AdminHomeFeedConfig } from './admin-types';
import { routes } from './routes';
import type { HomeBannerItem, HomeQuickLinkId, HomeQuickLinkItem } from '../../types/entities';

export const defaultHomeBanners: HomeBannerItem[] = [
  {
    id: 'banner-campus',
    badge: '校园成长',
    title: '竞赛、资料、队友',
    imageUrl:
      'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1MTg0OTU0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    link: routes.home,
  },
  {
    id: 'banner-competition',
    badge: '近期竞赛',
    title: '近期报名赛事。',
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    link: routes.competitions,
  },
  {
    id: 'banner-team',
    badge: '组队专区',
    title: '找队友，开项目。',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    link: routes.teams,
  },
];

export const defaultHomeQuickLinks: HomeQuickLinkItem[] = [
  { id: 'competitions', enabled: true },
  { id: 'resources', enabled: true },
  { id: 'teams', enabled: true },
  { id: 'community', enabled: true },
  { id: 'ai', enabled: false },
];

export const homeQuickLinkMeta: Record<
  HomeQuickLinkId,
  {
    label: string;
    description: string;
    to: string;
    theme: string;
  }
> = {
  competitions: {
    label: '找竞赛',
    description: '近期可报',
    to: routes.competitions,
    theme: 'from-blue-500 to-blue-600',
  },
  resources: {
    label: '找资源',
    description: '模板资料',
    to: routes.resources,
    theme: 'from-blue-500 to-blue-600',
  },
  teams: {
    label: '找队友',
    description: '快速组队',
    to: routes.teams,
    theme: 'from-blue-500 to-blue-600',
  },
  community: {
    label: '看攻略',
    description: '经验讨论',
    to: routes.community,
    theme: 'from-slate-500 to-slate-600',
  },
  ai: {
    label: '规划',
    description: '规划',
    to: routes.ai,
    theme: 'from-slate-500 to-slate-600',
  },
};

export const defaultAdminHomeConfig: AdminHomeFeedConfig = {
  heroBadge: defaultHomeBanners[0].badge,
  heroPrompt: defaultHomeBanners[0].title,
  heroImageUrl: defaultHomeBanners[0].imageUrl,
  banners: defaultHomeBanners,
  quickLinks: defaultHomeQuickLinks,
  publishStatus: 'online',
  publishAt: '',
  offlineAt: '',
  competitionLimit: 2,
  resourceLimit: 2,
  teamLimit: 2,
  postLimit: 2,
  competitionIds: [],
  resourceIds: [],
  teamIds: [],
  postIds: [],
  updatedAt: '',
  effectiveStatus: 'online',
};
