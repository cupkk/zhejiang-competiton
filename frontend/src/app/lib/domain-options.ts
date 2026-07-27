import type { CompetitionSort, PostCategory, ResourcePriceType } from '../../types/entities';

export const competitionLevelOptions = [
  { label: '全部', value: undefined },
  { label: '国家级', value: '国家级' },
  { label: '省级', value: '省级' },
  { label: '校级', value: '校级' },
] as const;

export const competitionCategoryOptions = [
  { label: '全部分类', value: undefined },
  { label: '创新创业', value: '创新创业' },
  { label: '数学建模', value: '数学建模' },
  { label: '编程算法', value: '编程算法' },
  { label: '商科案例', value: '商科案例' },
  { label: '电子硬件', value: '电子硬件' },
  { label: '设计艺术', value: '设计艺术' },
  { label: '学术科研', value: '学术科研' },
  { label: '语言外语', value: '语言外语' },
] as const;

export const competitionSortOptions: Array<{ label: string; value: CompetitionSort }> = [
  { label: '推荐', value: '推荐' },
  { label: '最热', value: '最热' },
  { label: '即将截止', value: '即将截止' },
  { label: '最新', value: '最新' },
];

export const resourceCategoryOptions = [
  { label: '模板', value: '模板' },
  { label: '资料包', value: '资料包' },
  { label: '攻略', value: '攻略' },
  { label: '全部', value: '全部' },
] as const;

export const resourcePriceTypeOptions: Array<{ label: string; value: ResourcePriceType }> = [
  { label: '全部', value: '全部' },
  { label: '免费', value: '免费' },
];

export const postCategoryTabs: Array<{ label: string; value: PostCategory }> = [
  { label: '推荐', value: '推荐' },
  { label: '资讯', value: '资讯' },
  { label: '经验贴', value: '经验贴' },
  { label: '问答', value: '问答' },
  { label: '避坑', value: '避坑' },
];

export const competitionGoalOptions = ['冲国奖', '保研加分', '创业落地', '兴趣体验', '评奖学金'] as const;

export const teamRoleOptions = ['技术开发', '算法数据', '商业分析', '路演答辩', '视觉设计', '文案内容'] as const;

export const collaborationModeOptions = ['线下为主', '线上为主', '线上线下均可'] as const;

export const weeklyCommitmentOptions = ['每周 3-5 小时', '每周 6-10 小时', '每周 10 小时以上', '赛期集中投入'] as const;
