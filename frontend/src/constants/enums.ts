export const COMPETITION_STATUS_OPTIONS = ['报名中', '即将截止', '报名未开始', '已截止'] as const;
export const COMPETITION_SORT_OPTIONS = ['推荐', '最热', '即将截止', '最新'] as const;
export const COMPETITION_LEVEL_OPTIONS = ['全部', '国家级', '省级', '校级', '创新创业'] as const;

export const RESOURCE_PRICE_OPTIONS = ['全部', '免费', '付费'] as const;
export const RESOURCE_CATEGORY_OPTIONS = ['全部', '模板', '资料包', '攻略'] as const;

export const SEARCH_SCOPE_VALUES = ['all', 'competitions', 'resources', 'posts', 'teams'] as const;
export const SEARCH_SCOPE_TABS = ['全部', '竞赛', '资源', '帖子', '组队'] as const;
export const SEARCH_SCOPE_TAB_TO_VALUE = {
  全部: 'all',
  竞赛: 'competitions',
  资源: 'resources',
  帖子: 'posts',
  组队: 'teams',
} as const;
export const SEARCH_SCOPE_VALUE_TO_TAB = {
  all: '全部',
  competitions: '竞赛',
  resources: '资源',
  posts: '帖子',
  teams: '组队',
} as const;

export const MESSAGE_CATEGORY_OPTIONS = ['全部', '系统', '组队', '审核', '订单'] as const;
export const FAVORITE_SCOPE_TABS = ['全部', '竞赛', '资源', '帖子'] as const;
export const FAVORITE_SCOPE_TAB_TO_VALUE = {
  全部: 'all',
  竞赛: 'competition',
  资源: 'resource',
  帖子: 'post',
} as const;
export const FAVORITE_SCOPE_VALUE_TO_TAB = {
  all: '全部',
  competition: '竞赛',
  resource: '资源',
  post: '帖子',
} as const;
export const POST_CATEGORY_OPTIONS = ['推荐', '经验贴', '问答', '避坑'] as const;
export const PUBLISH_POST_CATEGORY_OPTIONS = ['经验贴', '问答', '避坑'] as const;

export const TEAM_RECRUIT_STATUS_OPTIONS = ['招募中', '审核中', '已满员'] as const;
export const TEAM_FILTER_OPTIONS = ['全部', '招募中', '我的'] as const;
export const TEAM_SCHOOL_LIMIT_OPTIONS = ['不限学校', '仅限同校'] as const;
export const COMPETITION_DETAIL_TABS = ['详情', '资料', '组队'] as const;

export const ORDER_STATUS_OPTIONS = ['已完成', '待支付', '退款中', '已退款'] as const;

export const COMMON_FILTER_ALL = '全部';
export const COMMON_FREE_LABEL = '免费';
