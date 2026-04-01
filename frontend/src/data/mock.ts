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

export const competitions: Competition[] = [
  {
    id: 'c1',
    title: '第十五届全国大学生数学竞赛',
    level: '国家级',
    category: '学科竞赛',
    host: '中国数学会',
    target: '全日制本科',
    status: '报名中',
    deadline: '2026-04-15',
    daysLeft: 16,
    views: 12500,
    difficulty: '中高',
    coverLabel: '数学竞赛',
    coverGradient: 'linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)',
    tags: ['理科', '个人赛', '保研加分'],
    description: '全国大学生数学竞赛是一项面向本科生的高水平学科竞赛，适合希望在数学能力、逻辑分析和保研背景上继续提升的同学。',
    recommendedFor: ['数学基础扎实', '希望冲刺保研', '适合个人单兵作战'],
    actionHints: ['先补近三年真题', '梳理高数与线代重点', '确认校内报名时间']
  },
  {
    id: 'c2',
    title: '2026“挑战杯”大学生创业计划竞赛',
    level: '国家级',
    category: '创新创业',
    host: '共青团中央等',
    target: '全日制在校生',
    status: '即将截止',
    deadline: '2026-04-05',
    daysLeft: 6,
    views: 34200,
    difficulty: '高',
    coverLabel: '创新创业',
    coverGradient: 'linear-gradient(135deg, #0f766e 0%, #22c55e 100%)',
    tags: ['创新创业', '团队赛', '高含金量'],
    description: '“挑战杯”更强调团队协作、项目表达和落地价值，适合有产品、运营、技术或商业分析能力的同学联合参赛。',
    recommendedFor: ['有项目或社团经历', '愿意组队协作', '想提升简历含金量'],
    actionHints: ['先确定赛道和问题场景', '补商业计划书结构', '尽快完成组队']
  },
  {
    id: 'c3',
    title: '全国大学生英语竞赛 NECCS',
    level: '国家级',
    category: '语言能力',
    host: '国际英语外语教师协会中国英语外语教师协会',
    target: '全日制在校生',
    status: '报名中',
    deadline: '2026-05-10',
    daysLeft: 41,
    views: 8900,
    difficulty: '中',
    coverLabel: '英语能力',
    coverGradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
    tags: ['文科', '个人赛', '英语能力'],
    description: '全国大学生英语竞赛聚焦综合英语能力，适合准备四六级、外语竞赛和国际交流背景提升的学生。',
    recommendedFor: ['准备四六级或雅思', '想补外语背景', '适合个人节奏备赛'],
    actionHints: ['先做题感摸底', '建立阅读与写作模板', '关注校内初赛通知']
  }
];

export const resources: ResourceItem[] = [
  {
    id: 'r1',
    title: '【挑战杯】历年国奖优秀商业计划书合集',
    type: 'PDF / Word',
    category: '模板',
    price: 0,
    downloads: 4520,
    rating: 4.9,
    authorName: '学长带飞',
    authorMark: '飞',
    authorTitle: '国奖得主',
    coverLabel: '计划书',
    coverGradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    tags: ['挑战杯', '商分模板', '高分必看'],
    description: '整理了历届挑战杯高分项目商业计划书，适合第一次参赛的同学快速建立结构感和表达模板。',
    sizeLabel: '12.5 MB',
    suitableFor: '适合挑战杯、大创、创业赛的中前期材料准备',
    previewPoints: ['国奖项目排版参考', '赛道结构拆解', '答辩材料延展思路'],
    relatedCompetitionIds: ['c2']
  },
  {
    id: 'r2',
    title: 'Python 数据分析速成笔记',
    type: 'Jupyter / PDF',
    category: '资料包',
    price: 9.9,
    downloads: 1205,
    rating: 4.8,
    authorName: 'DataMaster',
    authorMark: 'D',
    authorTitle: '数据分析师',
    coverLabel: '数据分析',
    coverGradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    tags: ['Python', '大创', '数据分析'],
    description: '从零基础到能跑通大创项目的全流程笔记，包含 Pandas、Matplotlib 与一份真实项目代码结构。',
    sizeLabel: '28.0 MB',
    suitableFor: '适合大创、数学建模、科研入门和数据方向竞赛',
    previewPoints: ['常见分析流程模板', '代码结构拆解', '实战项目样例'],
    relatedCompetitionIds: ['c1', 'c2', 'c3']
  },
  {
    id: 'r3',
    title: '竞赛报名与答辩材料清单',
    type: 'Notion / PDF',
    category: '攻略',
    price: 0,
    downloads: 2680,
    rating: 4.7,
    authorName: '策划同学',
    authorMark: '策',
    authorTitle: '校级项目负责人',
    coverLabel: '材料清单',
    coverGradient: 'linear-gradient(135deg, #f97316 0%, #fb7185 100%)',
    tags: ['清单', '答辩', '报名'],
    description: '把竞赛报名、中期检查、路演答辩和结项阶段常见材料整理成一份清单，适合团队协作分工。',
    sizeLabel: '6.3 MB',
    suitableFor: '适合第一次带队或负责材料统筹的同学',
    previewPoints: ['报名材料清单', '答辩资料版本管理', '团队分工提醒'],
    relatedCompetitionIds: ['c2']
  }
];

export const teams: TeamItem[] = [
  {
    id: 't1',
    title: '大创国家级项目寻靠谱前端，已有后端和 UI',
    compId: 'c2',
    compName: '“挑战杯”创业计划竞赛',
    status: '招募中',
    target: '开发一款校园二手交易小程序',
    current: 3,
    max: 4,
    missingRoles: ['前端开发', 'PPT 美化'],
    deadline: '2026-04-02',
    authorName: '李同学',
    authorMark: '李',
    authorGrade: '大三',
    authorMajor: '软件工程',
    schoolLimit: true,
    requirements: ['能稳定同步进度', '有基础小程序经验', '答辩周能集中投入'],
    contactHint: '通过审核后开放群二维码'
  },
  {
    id: 't2',
    title: '数学建模美赛找队友，目标 M 奖以上',
    compId: 'c1',
    compName: '全国大学生数学竞赛',
    status: '招募中',
    target: '冲刺美赛和国赛双线备赛',
    current: 1,
    max: 3,
    missingRoles: ['编程手', '论文手'],
    deadline: '2026-04-10',
    authorName: '王同学',
    authorMark: '王',
    authorGrade: '大二',
    authorMajor: '应用数学',
    schoolLimit: false,
    requirements: ['每周可固定复盘', '愿意共享资料与代码', '能接受赛前冲刺节奏'],
    contactHint: '审核通过后进入备赛群'
  }
];

export const posts: PostItem[] = [
  {
    id: 'p1',
    title: '双非一本如何在大二拿到大创国推',
    excerpt: '选题、团队执行和中期材料准备，是我在大二阶段最早踩坑也最早修正的三个环节。',
    content: [
      '很多同学觉得大创很难，其实真正决定结果的往往不是题目本身，而是团队能不能在一开始就把目标拆清楚。我的第一步不是找最强的人，而是先找价值观一致、沟通成本低的队友。',
      '第二步是尽早做一版粗糙但完整的材料框架。不要等内容全齐再写，因为竞赛评审看的是结构、逻辑和表达能力。越早成稿，越容易发现方向跑偏。',
      '第三步是把阶段性成果公开出来。你可以在社区里发进展贴，也可以让学长学姐帮你看。越早获得反馈，越能减少后期返工。'
    ],
    category: '经验贴',
    authorName: '卷王之王',
    authorMark: '卷',
    likes: 342,
    comments: 56,
    tags: ['大创', '经验分享', '干货'],
    time: '2 小时前',
    relatedCompetitionId: 'c2',
    relatedResourceId: 'r3'
  },
  {
    id: 'p2',
    title: '找队友千万不要找这三种人',
    excerpt: '比赛的上限取决于题目，但下限往往是被队友拉出来的。',
    content: [
      '第一种是永远在潜水但关键节点突然出现的人。平时不回应，到了交付前却开始提大量意见，这种人会极大破坏团队节奏。',
      '第二种是满嘴跑火车但不落地的人。表述很强、想法很多，但没有稳定输出。与其找这样的人，不如找踏实但表达一般的队友。',
      '第三种是情绪管理差的人。比赛很容易遇到返工、熬夜和分歧，稳定比天赋更重要。'
    ],
    category: '避坑',
    authorName: '比赛老油条',
    authorMark: '油',
    likes: 890,
    comments: 124,
    tags: ['组队避坑', '吐槽'],
    time: '5 小时前',
    relatedCompetitionId: 'c2'
  },
  {
    id: 'p3',
    title: '大一学设计，先做比赛还是先做作品集',
    excerpt: '如果时间有限，到底应该先拼比赛经历，还是先把作品集底子打好？',
    content: [
      '我现在大一，想往交互设计方向走，但学校里活动很多，时间不够。想问问学长学姐，应该优先准备作品集还是参加校级竞赛。',
      '我目前偏好做 UI 和体验优化，也在看一些小程序项目，但担心自己太早做比赛会很空。',
      '如果你有类似经历，也欢迎告诉我你当时怎么取舍。'
    ],
    category: '问答',
    authorName: '设计新生',
    authorMark: '设',
    likes: 126,
    comments: 32,
    tags: ['设计', '路径选择'],
    time: '昨天',
    relatedResourceId: 'r2'
  }
];

export const notifications: NotificationItem[] = [
  {
    id: 'm1',
    category: '组队',
    title: '你的组队申请已通过',
    content: '“挑战杯”创业计划竞赛队伍已通过你的申请，点击查看联系方式与后续安排。',
    time: '10 分钟前',
    unread: true,
    linkType: 'team',
    linkId: 't1',
    ctaText: '查看队伍'
  },
  {
    id: 'm2',
    category: '审核',
    title: '你上传的资源进入审核中',
    content: '资源《竞赛报名与答辩材料清单》已提交，预计 24 小时内完成审核。',
    time: '今天 09:20',
    unread: true,
    linkType: 'resource',
    linkId: 'r3',
    ctaText: '查看资源'
  },
  {
    id: 'm3',
    category: '系统',
    title: '本周热门竞赛专题已更新',
    content: '新增近期截止与高转化竞赛专题，建议尽快查看并收藏。',
    time: '昨天',
    unread: false,
    linkType: 'competition',
    linkId: 'c2',
    ctaText: '查看专题'
  },
  {
    id: 'm4',
    category: '订单',
    title: '你的资源订单已完成',
    content: '《Python 数据分析速成笔记》已开通下载权限，可进入资源详情下载。',
    time: '昨天',
    unread: false,
    linkType: 'resource',
    linkId: 'r2',
    ctaText: '立即查看'
  }
];

export const searchSuggestions: SearchSuggestion[] = [
  { id: 's1', label: '挑战杯', scope: 'competitions' },
  { id: 's2', label: '数学建模', scope: 'competitions' },
  { id: 's3', label: '商业计划书', scope: 'resources' },
  { id: 's4', label: '组队避坑', scope: 'posts' },
  { id: 's5', label: '找队友', scope: 'teams' }
];

const competitionResourceMap: Record<string, string[]> = {
  c1: ['r2'],
  c2: ['r1', 'r2', 'r3'],
  c3: ['r2']
};

export function getCompetitionById(id?: string) {
  return competitions.find((item) => item.id === id) ?? competitions[0];
}

export function getResourceById(id?: string) {
  return resources.find((item) => item.id === id) ?? resources[0];
}

export function getTeamById(id?: string) {
  return teams.find((item) => item.id === id) ?? teams[0];
}

export function getPostById(id?: string) {
  return posts.find((item) => item.id === id) ?? posts[0];
}

export function getResourcesForCompetition(compId: string) {
  const ids = competitionResourceMap[compId] ?? [];
  return resources.filter((item) => ids.includes(item.id));
}

export function getTeamsForCompetition(compId: string) {
  return teams.filter((item) => item.compId === compId);
}

export const userProfile: UserProfile = {
  id: 'u1',
  name: '李同学',
  mark: '李',
  school: 'A大',
  major: '软件工程',
  grade: '大三',
  bio: '围绕竞赛、组队和产品方向持续积累，优先做能落地的小程序与项目作品。',
  focusTags: ['挑战杯', '小程序', '产品设计', '前端'],
  stats: {
    favorites: 12,
    teams: 3,
    resources: 5,
    unreadMessages: 2,
  },
};

export const ownedResources: OwnedResourceItem[] = [
  {
    id: 'mr1',
    resourceId: 'r1',
    title: '【挑战杯】历年国奖优秀商业计划书合集',
    type: 'PDF / Word',
    accessType: 'free',
    acquiredAt: '2026-03-23',
    downloadCount: 2,
    tags: ['挑战杯', '商业计划书', '免费'],
  },
  {
    id: 'mr2',
    resourceId: 'r2',
    title: 'Python 数据分析速成笔记',
    type: 'Jupyter / PDF',
    accessType: 'paid',
    acquiredAt: '2026-03-27',
    downloadCount: 5,
    tags: ['Python', '数据分析', '实战'],
  },
];

export const orders: OrderItem[] = [
  {
    id: 'o1',
    title: 'Python 数据分析速成笔记',
    itemType: 'resource',
    amount: 9.9,
    status: '已完成',
    createdAt: '2026-03-27 19:10',
    paidAt: '2026-03-27 19:12',
    resourceId: 'r2',
    coverLabel: '资源订单',
  },
  {
    id: 'o2',
    title: '组队简历优化服务',
    itemType: 'service',
    amount: 29.9,
    status: '待支付',
    createdAt: '2026-03-29 10:24',
    coverLabel: '服务订单',
  },
];

export function getMyTeams() {
  return teams.filter((item) => item.authorName === userProfile.name);
}
