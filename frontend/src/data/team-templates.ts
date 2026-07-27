import type { TeamListingType } from '../types/entities';

export interface TeamTemplatePreset {
  key: string;
  listingType: TeamListingType;
  title: string;
  competitionId: string;
  competitionName: string;
  target: string;
  fullDescription: string;
  currentCount: number;
  maxCount: number;
  missingRoles: string[];
  requirements: string[];
  goals: string[];
  capabilities: string[];
  collaborationMode: string;
  weeklyCommitment: string;
}

export const teamTemplatePresets: TeamTemplatePreset[] = [
  {
    key: 'innovation-design', listingType: 'team_recruit', title: '创新大赛项目招募视觉与产品同学',
    competitionId: 'wl_china_innovation', competitionName: '中国国际大学生创新大赛',
    target: '围绕校园低碳生活设计信息服务方案，当前处于需求验证和原型梳理阶段。',
    fullDescription: '希望补充能够参与界面梳理、路演材料和用户访谈的同学。加入后共同确认交付内容，按周同步进展。',
    currentCount: 2, maxCount: 4, missingRoles: ['视觉设计', '商业分析'],
    requirements: ['每周参加一次项目同步', '能够按节点提交可检查的材料'],
    goals: ['创业落地'], capabilities: ['文案内容'], collaborationMode: '线上线下均可', weeklyCommitment: '每周 3-5 小时',
  },
  {
    key: 'mcm-code-writing', listingType: 'team_recruit', title: '数学建模队伍招募编程与论文同学',
    competitionId: 'wl_mcm', competitionName: '全国大学生数学建模竞赛',
    target: '计划按往届公开题开展训练，重点练习数据处理、模型验证和论文协作。',
    fullDescription: '已有一名建模方向成员，希望补充编程实现和论文表达能力。计划先完成模拟题，再确定正式赛分工。',
    currentCount: 1, maxCount: 3, missingRoles: ['算法数据', '文案内容'],
    requirements: ['能够完成至少一次完整模拟赛', '使用共享文档记录模型和结果'],
    goals: ['冲国奖'], capabilities: ['商业分析'], collaborationMode: '线上为主', weeklyCommitment: '每周 6-10 小时',
  },
  {
    key: 'electronic-embedded', listingType: 'team_recruit', title: '电子设计专题赛招募嵌入式与硬件同学',
    competitionId: 'wl_nuedc', competitionName: '全国大学生电子设计竞赛',
    target: '准备参加电子设计专题赛，现有基础方案，希望补充嵌入式开发和电路调试成员。',
    fullDescription: '队伍将按电路、嵌入式、测试记录三部分协作。希望成员能参加集中联调，并保留版本与测试数据。',
    currentCount: 1, maxCount: 3, missingRoles: ['技术开发', '算法数据'],
    requirements: ['能参加集中联调', '愿意记录测试结果和硬件版本'],
    goals: ['兴趣体验'], capabilities: ['技术开发'], collaborationMode: '线下为主', weeklyCommitment: '赛期集中投入',
  },
  {
    key: 'challenge-research', listingType: 'team_recruit', title: '挑战杯调研项目招募数据与写作同学',
    competitionId: 'wl_tiaozhanbei_research', competitionName: '挑战杯全国大学生课外学术科技作品竞赛',
    target: '围绕校园公共服务开展调研，已完成选题，希望补充数据分析和报告写作成员。',
    fullDescription: '计划共同完成问卷、访谈、数据分析和报告。希望成员尊重调研伦理，能够按节点提交可复核材料。',
    currentCount: 2, maxCount: 5, missingRoles: ['算法数据', '文案内容'],
    requirements: ['能够参与访谈或数据整理', '引用和数据来源清楚'],
    goals: ['保研加分'], capabilities: ['商业分析'], collaborationMode: '线上线下均可', weeklyCommitment: '每周 3-5 小时',
  },
  {
    key: 'computer-design-member', listingType: 'member_available', title: '计算机设计方向求加入项目组',
    competitionId: 'wl_computer_design', competitionName: '中国大学生计算机设计大赛',
    target: '希望加入软件应用或信息可视化方向的同校项目组，可承担前端开发和演示视频制作。',
    fullDescription: '有移动端页面、数据可视化和基础视频剪辑经验，希望加入目标清楚、每周有固定同步的团队。',
    currentCount: 0, maxCount: 1, missingRoles: [], requirements: ['项目目标和分工清楚', '每周有固定同步时间'],
    goals: ['兴趣体验'], capabilities: ['技术开发', '视觉设计'], collaborationMode: '线上线下均可', weeklyCommitment: '每周 3-5 小时',
  },
  {
    key: 'software-member', listingType: 'member_available', title: '软件项目方向求加入稳定参赛队伍',
    competitionId: 'wl_software_cup', competitionName: '“中国软件杯”大学生软件设计大赛',
    target: '具备后端接口和基础部署经验，希望加入软件项目队伍承担开发、测试和文档整理。',
    fullDescription: '熟悉常见 Web 开发流程，能够按任务提交代码和测试记录。希望项目已有明确赛题，并使用版本管理协作。',
    currentCount: 0, maxCount: 1, missingRoles: [], requirements: ['赛题和里程碑明确', '使用代码仓库协作'],
    goals: ['冲国奖'], capabilities: ['技术开发', '文案内容'], collaborationMode: '线上为主', weeklyCommitment: '每周 6-10 小时',
  },
];
