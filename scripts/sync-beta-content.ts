import { createHash } from 'node:crypto';

type HelpersModule = typeof import('../server/helpers.ts');

let helpers: HelpersModule | null = null;

async function loadDatabaseHelpers() {
  await import('../server/db.ts');
  helpers = await import('../server/helpers.ts');
}

function requireHelpers() {
  if (!helpers) {
    throw new Error('database_helpers_not_loaded');
  }
  return helpers;
}

function getOne<T>(sql: string, params?: Record<string, unknown>) {
  return requireHelpers().getOne<T>(sql, params as never);
}

function run(sql: string, params?: Record<string, unknown>) {
  return requireHelpers().run(sql, params as never);
}

function nowIso() {
  return requireHelpers().nowIso();
}

function createModerationTask(targetType: 'post' | 'resource', targetId: string, action: string, note?: string) {
  return requireHelpers().createModerationTask(targetType, targetId, action, note);
}

type ModerationStatus = 'pending' | 'approved' | 'rejected';

interface CompetitionSeed {
  id: string;
  title: string;
  category: string;
  host: string;
  target: string;
  difficulty: string;
  tags: string[];
  description: string;
  recommendedFor: string[];
  sourceUrl: string;
}

interface ResourceIndexSeed {
  id: string;
  title: string;
  type: string;
  category: string;
  sourceUrl: string;
  tags: string[];
  description: string;
  suitableFor: string;
  previewPoints: string[];
  relatedCompetitionIds: string[];
}

interface PostIndexSeed {
  id: string;
  title: string;
  category: '资讯' | '经验贴';
  sourceName: string;
  sourceUrl: string;
  tags: string[];
  summary: string;
}

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');

const catalogSourceUrl = 'https://m.cahe.edu.cn/site/content/16010.html';

const coreCompetitions: CompetitionSeed[] = [
  {
    id: 'wl_china_innovation',
    title: '中国国际大学生创新大赛',
    category: '创新创业',
    host: '教育部等部门',
    target: '在校大学生、本科生和研究生团队',
    difficulty: '高',
    tags: ['白名单竞赛', '创新创业', '路演'],
    description: '面向大学生创新创业项目的综合性赛事，平台仅提供官方入口和备赛索引，报名要求以官网和学校通知为准。',
    recommendedFor: ['有项目原型、科研转化、社会实践或商业计划的团队。', '适合希望系统训练项目表达、商业验证和路演能力的同学。'],
    sourceUrl: 'https://cy.ncss.cn/',
  },
  {
    id: 'wl_tiaozhanbei_research',
    title: '挑战杯全国大学生课外学术科技作品竞赛',
    category: '学术科技',
    host: '共青团中央、中国科协、教育部等',
    target: '高校学生学术科技作品团队',
    difficulty: '高',
    tags: ['白名单竞赛', '挑战杯', '科研作品'],
    description: '侧重课外学术科技作品和研究成果展示，适合已有研究问题、实验数据或工程原型的团队。',
    recommendedFor: ['有课程项目、科研训练、论文雏形或实验报告基础的同学。', '适合希望把研究成果整理为竞赛作品的团队。'],
    sourceUrl: 'https://www.tiaozhanbei.net/',
  },
  {
    id: 'wl_tiaozhanbei_business',
    title: '挑战杯中国大学生创业计划竞赛',
    category: '创新创业',
    host: '共青团中央、教育部等',
    target: '高校学生创业计划团队',
    difficulty: '高',
    tags: ['白名单竞赛', '挑战杯', '创业计划'],
    description: '侧重创业计划、市场验证和团队执行方案，适合把技术、服务或公益项目转化为完整商业计划。',
    recommendedFor: ['已经有明确用户、场景、方案和初步验证材料的团队。', '适合希望练习商业计划书和答辩的同学。'],
    sourceUrl: 'https://www.tiaozhanbei.net/',
  },
  {
    id: 'wl_mcm',
    title: '全国大学生数学建模竞赛',
    category: '数学建模',
    host: '中国工业与应用数学学会',
    target: '本科生数学建模团队',
    difficulty: '中高',
    tags: ['白名单竞赛', '数学建模', '论文写作'],
    description: '围绕实际问题完成建模、求解、验证和论文表达，是理工科学生训练问题抽象和协作写作的高频赛事。',
    recommendedFor: ['数学、统计、计算机、工程类专业同学。', '适合三人组队，提前训练建模、编程和论文排版。'],
    sourceUrl: 'http://www.mcm.edu.cn/',
  },
  {
    id: 'wl_nuedc',
    title: '全国大学生电子设计竞赛',
    category: '电子信息',
    host: '全国大学生电子设计竞赛组织委员会',
    target: '电子信息、电气、自动化等方向学生',
    difficulty: '高',
    tags: ['白名单竞赛', '电子设计', '硬件'],
    description: '以电子系统设计、调试和现场实现为核心，适合有硬件、电路、嵌入式基础的同学。',
    recommendedFor: ['电子、电气、自动化、通信、计算机硬件方向同学。', '建议提前准备常用模块、仪器使用和团队分工。'],
    sourceUrl: 'https://www.nuedc-training.com.cn/',
  },
  {
    id: 'wl_computer_design',
    title: '中国大学生计算机设计大赛',
    category: '计算机',
    host: '中国大学生计算机设计大赛组织委员会',
    target: '计算机及相关专业学生',
    difficulty: '中',
    tags: ['白名单竞赛', '计算机', '作品赛'],
    description: '面向软件、数字媒体、人工智能、信息可视化等方向的作品型竞赛，适合作为课程项目升级。',
    recommendedFor: ['已有 Web、小程序、算法、交互作品或可视化项目的同学。', '适合打磨完整演示、文档和答辩材料。'],
    sourceUrl: 'http://www.jsjds.com.cn/',
  },
  {
    id: 'wl_lanqiao',
    title: '蓝桥杯全国软件和信息技术专业人才大赛',
    category: '程序设计',
    host: '工业和信息化部人才交流中心等',
    target: '软件、电子、信息技术相关学生',
    difficulty: '中',
    tags: ['白名单竞赛', '程序设计', '蓝桥杯'],
    description: '覆盖程序设计、软件开发、电子信息等方向，适合用阶段性刷题和项目训练建立参赛节奏。',
    recommendedFor: ['希望用算法、编程或嵌入式能力获得竞赛经历的同学。', '适合个人赛和短周期训练。'],
    sourceUrl: 'https://dasai.lanqiao.cn/',
  },
  {
    id: 'wl_smart_car',
    title: '全国大学生智能汽车竞赛',
    category: '智能车',
    host: '全国大学生智能汽车竞赛组织委员会',
    target: '自动化、电子、车辆、计算机相关团队',
    difficulty: '高',
    tags: ['白名单竞赛', '智能车', '嵌入式'],
    description: '围绕智能车系统设计、控制、传感和调试展开，强调长期工程迭代和团队协作。',
    recommendedFor: ['有嵌入式、控制、视觉、机械调试基础的同学。', '适合提前建立实验记录和版本管理。'],
    sourceUrl: 'https://www.smartcarrace.com/',
  },
  {
    id: 'wl_mechanical_innovation',
    title: '全国大学生机械创新设计大赛',
    category: '机械设计',
    host: '全国大学生机械创新设计大赛组委会',
    target: '机械、机电、自动化相关专业学生',
    difficulty: '中高',
    tags: ['白名单竞赛', '机械创新', '工程实践'],
    description: '强调机械结构创新、样机实现和工程表达，适合有课程设计或实物制作基础的团队。',
    recommendedFor: ['机械、机电、工业设计、自动化方向同学。', '适合把课程设计、社团项目继续深化。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_ad_design',
    title: '全国大学生广告艺术大赛',
    category: '设计传播',
    host: '全国大学生广告艺术大赛组委会',
    target: '广告、设计、传媒、中文及相关专业学生',
    difficulty: '中',
    tags: ['白名单竞赛', '广告设计', '创意传播'],
    description: '围绕命题品牌和传播任务完成创意表达，适合设计、文案、视频和营销方向同学组队。',
    recommendedFor: ['设计、传媒、市场营销、中文、新媒体方向同学。', '适合用作品集思维组织创意产出。'],
    sourceUrl: 'http://www.sun-ada.net/',
  },
  {
    id: 'wl_energy_saving',
    title: '全国大学生节能减排社会实践与科技竞赛',
    category: '能源环境',
    host: '全国大学生节能减排社会实践与科技竞赛委员会',
    target: '能源、环境、工程、公共管理相关团队',
    difficulty: '中高',
    tags: ['白名单竞赛', '节能减排', '社会实践'],
    description: '面向节能、低碳、环保和社会实践项目，适合把工程方案与真实场景调研结合。',
    recommendedFor: ['能源、环境、工程、社会实践方向同学。', '适合有调研数据、技术方案或原型验证的团队。'],
    sourceUrl: 'http://www.jienengjianpai.org/',
  },
  {
    id: 'wl_logistics_design',
    title: '全国大学生物流设计大赛',
    category: '管理工程',
    host: '中国物流与采购联合会等',
    target: '物流、供应链、管理科学与工程相关学生',
    difficulty: '中',
    tags: ['白名单竞赛', '物流设计', '供应链'],
    description: '围绕企业真实案例进行物流系统、供应链和运营方案设计，适合管理工程类团队。',
    recommendedFor: ['物流管理、工业工程、管科、交通运输相关同学。', '适合训练案例分析、数据建模和方案表达。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_engineering_practice',
    title: '全国大学生工程实践与创新能力大赛',
    category: '工程实践',
    host: '教育部高等教育司等',
    target: '工程类专业学生团队',
    difficulty: '中高',
    tags: ['白名单竞赛', '工程实践', '创新能力'],
    description: '侧重工程实践能力、综合创新和现场任务完成，适合有跨专业工程项目经验的团队。',
    recommendedFor: ['工程训练、机械、自动化、电气、计算机相关同学。', '适合把实验室训练和竞赛任务结合。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_zhou_peiyuan',
    title: '全国周培源大学生力学竞赛',
    category: '基础学科',
    host: '中国力学学会',
    target: '力学、土木、机械、航空航天等专业学生',
    difficulty: '中高',
    tags: ['白名单竞赛', '力学', '基础学科'],
    description: '面向大学力学基础能力和综合应用能力训练，适合有扎实力学课程基础的同学。',
    recommendedFor: ['力学、土木、机械、航空航天、材料等方向同学。', '适合通过真题和课程体系复盘备赛。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_structural_design',
    title: '全国大学生结构设计竞赛',
    category: '土木建筑',
    host: '全国大学生结构设计竞赛委员会',
    target: '土木、建筑、交通、力学相关学生',
    difficulty: '中高',
    tags: ['白名单竞赛', '结构设计', '土木建筑'],
    description: '围绕结构模型设计、制作、加载和理论说明展开，强调方案验证与工程表达。',
    recommendedFor: ['土木、建筑、交通、力学方向同学。', '适合有结构力学、材料和模型制作基础的团队。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_ecommerce',
    title: '全国大学生电子商务创新创意创业挑战赛',
    category: '电子商务',
    host: '全国大学生电子商务创新创意创业挑战赛竞赛组织委员会',
    target: '电商、管理、计算机、设计等跨专业团队',
    difficulty: '中',
    tags: ['白名单竞赛', '三创赛', '电子商务'],
    description: '围绕电子商务场景开展创新、创意和创业方案设计，适合跨专业团队完成项目策划与落地验证。',
    recommendedFor: ['电商、管科、市场、计算机、设计方向同学。', '适合有商业模式和用户验证材料的项目。'],
    sourceUrl: 'https://www.sanchuang.net/',
  },
  {
    id: 'wl_cad_modeling',
    title: '全国大学生先进成图技术与产品信息建模创新大赛',
    category: '工程制图',
    host: '全国大学生先进成图技术与产品信息建模创新大赛组委会',
    target: '机械、土木、建筑、产品设计相关学生',
    difficulty: '中',
    tags: ['白名单竞赛', '成图技术', '建模'],
    description: '面向工程制图、产品信息建模和数字化表达能力，适合用课程训练积累竞赛成果。',
    recommendedFor: ['机械、土木、建筑、工业设计等方向同学。', '适合希望提升 CAD/BIM/三维建模表达的同学。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_chemical_design',
    title: '全国大学生化工设计竞赛',
    category: '化工设计',
    host: '中国化工学会等',
    target: '化工、材料、能源相关专业学生',
    difficulty: '中高',
    tags: ['白名单竞赛', '化工设计', '流程模拟'],
    description: '围绕化工过程、工艺方案、模拟计算和工程经济分析组织作品，适合化工类团队长期准备。',
    recommendedFor: ['化工、材料、能源、环境相关方向同学。', '适合有流程模拟、工艺计算和设计文档基础的团队。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_market_research',
    title: '全国大学生市场调查与分析大赛',
    category: '经管统计',
    host: '中国商业统计学会',
    target: '统计、经管、社会学、传媒等相关专业学生',
    difficulty: '中',
    tags: ['白名单竞赛', '市场调查', '数据分析'],
    description: '围绕真实调研问题完成问卷、访谈、数据分析和报告表达，适合经管和统计类同学。',
    recommendedFor: ['统计、经管、社会学、传媒、公共管理方向同学。', '适合训练调研设计和数据报告写作。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_life_science',
    title: '全国大学生生命科学竞赛',
    category: '生命科学',
    host: '全国大学生生命科学竞赛委员会',
    target: '生命科学、生物工程、医学相关学生',
    difficulty: '中高',
    tags: ['白名单竞赛', '生命科学', '实验研究'],
    description: '鼓励学生围绕生命科学问题开展实验研究、创新实践和成果表达。',
    recommendedFor: ['生命科学、生物工程、医学、药学相关同学。', '适合有实验记录、数据分析和导师指导的团队。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_ic_innovation',
    title: '全国大学生集成电路创新创业大赛',
    category: '集成电路',
    host: '全国大学生集成电路创新创业大赛组委会',
    target: '微电子、集成电路、电子信息相关学生',
    difficulty: '高',
    tags: ['白名单竞赛', '集成电路', '芯片'],
    description: '面向集成电路设计、验证、应用和创新创业方向，适合有芯片设计基础的团队。',
    recommendedFor: ['微电子、集成电路、电子信息、计算机硬件方向同学。', '适合提前积累 EDA、验证和项目文档。'],
    sourceUrl: 'https://univ.ciciec.com/',
  },
  {
    id: 'wl_robot_ai',
    title: '中国机器人及人工智能大赛',
    category: '人工智能',
    host: '中国人工智能学会等',
    target: '机器人、人工智能、自动化、计算机相关学生',
    difficulty: '中高',
    tags: ['白名单竞赛', '机器人', '人工智能'],
    description: '覆盖机器人、人工智能算法和智能应用方向，适合用项目驱动方式训练综合能力。',
    recommendedFor: ['计算机、自动化、机器人、人工智能方向同学。', '适合有算法、系统集成或机器人平台经验的团队。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_robot_contest',
    title: '全国大学生机器人大赛',
    category: '机器人',
    host: '共青团中央、全国学联等',
    target: '机器人、自动化、机械、电子、计算机相关团队',
    difficulty: '高',
    tags: ['白名单竞赛', '机器人大赛', '工程团队'],
    description: '面向机器人系统设计、机械、电控、算法和现场协作，适合长期工程团队。',
    recommendedFor: ['机械、自动化、电子、计算机、控制方向同学。', '适合有稳定队伍、实验场地和版本管理习惯的团队。'],
    sourceUrl: catalogSourceUrl,
  },
  {
    id: 'wl_fltrp',
    title: '“外研社·国才杯”全国大学生外语能力大赛',
    category: '语言表达',
    host: '外语教学与研究出版社等',
    target: '高校外语学习者',
    difficulty: '中',
    tags: ['白名单竞赛', '外语能力', '表达'],
    description: '面向大学生外语综合能力、演讲、写作、阅读等方向，适合语言表达和国际传播能力训练。',
    recommendedFor: ['外语、国际传播、经管、人文社科方向同学。', '适合希望提升公开表达和写作能力的同学。'],
    sourceUrl: 'https://ucc.fltrp.com/',
  },
  {
    id: 'wl_english_contest',
    title: '全国大学生英语竞赛',
    category: '语言表达',
    host: '高等学校大学外语教学研究会等',
    target: '高校各专业学生',
    difficulty: '中',
    tags: ['白名单竞赛', '英语竞赛', '语言能力'],
    description: '面向大学英语学习和综合应用能力，适合用短周期训练积累语言类竞赛经历。',
    recommendedFor: ['希望检验英语基础、写作和阅读能力的同学。', '适合个人参赛和阶段性备考。'],
    sourceUrl: 'https://www.chinaneccs.cn/',
  },
  {
    id: 'wl_milan_design_week',
    title: '米兰设计周中国高校设计学科师生优秀作品展',
    category: '设计艺术',
    host: '米兰设计周中国高校设计学科师生优秀作品展组委会',
    target: '设计学科师生和相关专业学生',
    difficulty: '中',
    tags: ['白名单竞赛', '设计作品', '作品展'],
    description: '面向设计学科作品展示与交流，适合有完整设计作品、作品集和视觉表达基础的同学。',
    recommendedFor: ['工业设计、视觉传达、数字媒体、环境设计等方向同学。', '适合把课程作品打磨为可展示作品。'],
    sourceUrl: 'https://www.milan-aap.org.cn/',
  },
];

function catalogCompetition(input: {
  id: string;
  title: string;
  category: string;
  sourceUrl?: string;
  host?: string;
  target?: string;
  difficulty?: string;
  tags?: string[];
}): CompetitionSeed {
  const sourceUrl = input.sourceUrl || catalogSourceUrl;
  return {
    id: input.id,
    title: input.title,
    category: input.category,
    host: input.host || '以赛事官网和主办方通知为准',
    target: input.target || '高校相关专业学生或跨专业团队',
    difficulty: input.difficulty || '中',
    tags: ['白名单竞赛', input.category, ...(input.tags || [])].slice(0, 5),
    description: `${input.title} 属于中国高等教育学会竞赛目录中的赛事。平台仅提供入口索引，赛制、报名时间和参赛资格以官网及学校通知为准。`,
    recommendedFor: [
      `关注${input.category}方向、希望积累竞赛经历的同学。`,
      '适合先收藏赛事入口，再根据当年通知决定投入时间。',
    ],
    sourceUrl,
  };
}

const additionalCompetitions: CompetitionSeed[] = [
  catalogCompetition({
    id: 'wl_acm_icpc',
    title: 'ACM-ICPC国际大学生程序设计竞赛',
    category: '程序设计',
    sourceUrl: 'https://acm.cumt.edu.cn/',
    tags: ['算法', '团队赛'],
    difficulty: '高',
  }),
  catalogCompetition({
    id: 'wl_medical_skills',
    title: '中国大学生医学技术技能大赛',
    category: '医学技能',
    host: '教育部',
    target: '医学类专业学生团队',
    difficulty: '高',
  }),
  catalogCompetition({
    id: 'wl_huacan_design',
    title: '两岸新锐设计竞赛·华灿奖',
    category: '设计艺术',
    sourceUrl: 'http://www.huacanjiang.com/home',
    tags: ['设计作品'],
  }),
  catalogCompetition({
    id: 'wl_innovation_training_show',
    title: '全国大学生创新创业训练计划年会展示',
    category: '创新创业',
    sourceUrl: 'http://gjcxcy.bjtu.edu.cn/Index.aspx',
    tags: ['大创项目'],
  }),
  catalogCompetition({
    id: 'wl_3d_digital_design',
    title: '全国三维数字化创新设计大赛',
    category: '数字设计',
    sourceUrl: 'https://3dds.3ddl.net/',
    tags: ['三维设计'],
  }),
  catalogCompetition({
    id: 'wl_siemens_cimc',
    title: '“西门子杯”中国智能制造挑战赛',
    category: '智能制造',
    sourceUrl: 'http://www.siemenscup-cimc.org.cn/',
    tags: ['自动化', '制造'],
  }),
  catalogCompetition({
    id: 'wl_service_outsourcing',
    title: '中国大学生服务外包创新创业大赛',
    category: '软件服务',
    sourceUrl: 'http://www.fwwb.org.cn/',
    tags: ['服务外包', '项目赛'],
  }),
  catalogCompetition({
    id: 'wl_c4_computer',
    title: '中国高校计算机大赛',
    category: '计算机',
    sourceUrl: 'http://www.c4best.cn/',
    tags: ['计算机', '项目赛'],
  }),
  catalogCompetition({
    id: 'wl_geology_skills',
    title: '全国大学生地质技能竞赛',
    category: '地质资源',
    sourceUrl: 'https://yuanxi.cugb.edu.cn/competition/',
    tags: ['地质技能'],
  }),
  catalogCompetition({
    id: 'wl_optoelectronic_design',
    title: '全国大学生光电设计竞赛',
    category: '光电信息',
    sourceUrl: 'http://gd.p.moocollege.com/',
    tags: ['光电设计'],
  }),
  catalogCompetition({
    id: 'wl_metallography',
    title: '全国大学生金相技能大赛',
    category: '材料工程',
    sourceUrl: 'http://www.cnzjjx.cn/',
    tags: ['材料', '实验技能'],
  }),
  catalogCompetition({
    id: 'wl_information_security',
    title: '全国大学生信息安全竞赛',
    category: '网络安全',
    sourceUrl: 'http://www.ciscn.cn/',
    tags: ['信息安全', '攻防'],
    difficulty: '中高',
  }),
  catalogCompetition({
    id: 'wl_future_designer',
    title: '未来设计师·全国高校数字艺术设计大赛',
    category: '数字艺术',
    sourceUrl: 'https://www.ncda.org.cn/',
    tags: ['数字艺术'],
  }),
  catalogCompetition({
    id: 'wl_mechanical_engineering_creative',
    title: '中国大学生机械工程创新创意大赛',
    category: '机械工程',
    sourceUrl: 'http://www.gczbds.org',
    tags: ['机械工程'],
  }),
  catalogCompetition({
    id: 'wl_robocup_china',
    title: '中国机器人大赛暨RoboCup机器人世界杯中国赛',
    category: '机器人',
    sourceUrl: 'http://crc.drct-caa.org.cn/',
    tags: ['机器人', 'RoboCup'],
    difficulty: '高',
  }),
  catalogCompetition({
    id: 'wl_software_cup',
    title: '“中国软件杯”大学生软件设计大赛',
    category: '软件工程',
    sourceUrl: 'http://www.cnsoftbei.com/',
    tags: ['软件设计'],
  }),
  catalogCompetition({
    id: 'wl_china_us_maker',
    title: '中美青年创客大赛',
    category: '创新创业',
    sourceUrl: 'https://www.eol.cn/html/lx/maker/',
    tags: ['创客', '项目赛'],
  }),
  catalogCompetition({
    id: 'wl_raicom',
    title: '睿抗机器人开发者大赛',
    category: '机器人',
    sourceUrl: 'https://www.robocom.com.cn/',
    tags: ['机器人', '开发者'],
  }),
  catalogCompetition({
    id: 'wl_datang_cup',
    title: '大唐杯全国大学生新一代信息通信技术大赛',
    category: '通信技术',
    sourceUrl: 'https://dtcup.dtxiaotangren.com',
    tags: ['通信', 'ICT'],
  }),
  catalogCompetition({
    id: 'wl_huawei_ict',
    title: '华为ICT大赛',
    category: '信息技术',
    sourceUrl: 'https://e.huawei.com/cn/talent/ict-academy/#/ict-contest?compId=85131973',
    tags: ['ICT', '网络云'],
  }),
  catalogCompetition({
    id: 'wl_embedded_chip',
    title: '全国大学生嵌入式芯片与系统设计竞赛',
    category: '嵌入式',
    sourceUrl: 'http://www.socchina.net/',
    tags: ['芯片', '嵌入式'],
  }),
  catalogCompetition({
    id: 'wl_physics_experiment',
    title: '全国大学生物理实验竞赛',
    category: '基础学科',
    sourceUrl: 'http://wlsycx.moocollege.com/',
    tags: ['物理实验'],
  }),
  catalogCompetition({
    id: 'wl_bim_graduation_design',
    title: '全国高校BIM毕业设计创新大赛',
    category: '土木建筑',
    sourceUrl: 'http://gxbsxs.glodonedu.com/index',
    tags: ['BIM', '毕业设计'],
  }),
  catalogCompetition({
    id: 'wl_business_elite',
    title: '全国高校商业精英挑战赛',
    category: '经管商科',
    sourceUrl: 'http://cubec.org.cn/',
    tags: ['商业', '案例'],
  }),
  catalogCompetition({
    id: 'wl_xuechuang_cup',
    title: '“学创杯”全国大学生创业综合模拟大赛',
    category: '创新创业',
    sourceUrl: 'http://www.bster.cn/cyds/index',
    tags: ['创业模拟'],
  }),
  catalogCompetition({
    id: 'wl_intelligent_robot_creative',
    title: '中国高校智能机器人创意大赛',
    category: '机器人',
    sourceUrl: 'http://www.robotcontest.cn/',
    tags: ['智能机器人'],
  }),
  catalogCompetition({
    id: 'wl_good_creative_design',
    title: '中国好创意暨全国数字艺术设计大赛',
    category: '数字艺术',
    sourceUrl: 'https://www.cdec.org.cn/',
    tags: ['数字艺术', '创意'],
  }),
  catalogCompetition({
    id: 'wl_21st_english_speech',
    title: '“21世纪杯”全国英语演讲比赛',
    category: '语言表达',
    sourceUrl: 'https://contest.i21st.cn/',
    tags: ['英语演讲'],
  }),
  catalogCompetition({
    id: 'wl_ican',
    title: 'iCAN大学生创新创业大赛',
    category: '创新创业',
    tags: ['创新创业'],
  }),
  catalogCompetition({
    id: 'wl_icbc_fintech',
    title: '“工行杯”全国大学生金融科技创新大赛',
    category: '金融科技',
    sourceUrl: 'https://www.gonghangbei.com/index/Lists/index.html?id=1',
    tags: ['金融科技'],
  }),
  catalogCompetition({
    id: 'wl_chinese_classics',
    title: '中华经典诵写讲大赛',
    category: '语言文化',
    sourceUrl: 'https://www.jingdiansxj.cn/home',
    tags: ['诵写讲'],
  }),
  catalogCompetition({
    id: 'wl_intercultural_competence',
    title: '“外教社杯”全国高校学生跨文化能力大赛',
    category: '语言表达',
    host: '上海外国语大学',
    tags: ['跨文化'],
  }),
  catalogCompetition({
    id: 'wl_baidu_star',
    title: '百度之星程序设计大赛',
    category: '程序设计',
    sourceUrl: 'https://star.baidu.com/#/',
    tags: ['算法', '程序设计'],
  }),
  catalogCompetition({
    id: 'wl_industrial_design',
    title: '全国大学生工业设计大赛',
    category: '工业设计',
    sourceUrl: 'https://www.cuidc.net/#/',
    tags: ['工业设计'],
  }),
  catalogCompetition({
    id: 'wl_water_innovation',
    title: '全国大学生水利创新设计大赛',
    category: '水利工程',
    host: '中国水利教育协会等',
    tags: ['水利', '创新设计'],
  }),
  catalogCompetition({
    id: 'wl_chemical_experiment',
    title: '全国大学生化工实验大赛',
    category: '化工实验',
    sourceUrl: 'http://www.cteic.com/higherEducation-199.html?www.kulayu.com',
    tags: ['化工实验'],
  }),
  catalogCompetition({
    id: 'wl_chemistry_experiment_design',
    title: '全国大学生化学实验创新设计大赛',
    category: '化学实验',
    sourceUrl: 'https://cid.nju.edu.cn/',
    tags: ['化学实验'],
  }),
  catalogCompetition({
    id: 'wl_computer_system_capacity',
    title: '全国大学生计算机系统能力大赛',
    category: '计算机系统',
    sourceUrl: 'https://compiler.educg.net/#/',
    tags: ['编译系统', '操作系统'],
    difficulty: '高',
  }),
  catalogCompetition({
    id: 'wl_garden_design_build',
    title: '全国大学生花园设计建造竞赛',
    category: '风景园林',
    host: '深圳市城市管理和综合执法局等',
    tags: ['园林设计'],
  }),
  catalogCompetition({
    id: 'wl_iot_design',
    title: '全国大学生物联网设计竞赛',
    category: '物联网',
    sourceUrl: 'https://developer.huaweicloud.com/college/wulianwang.html',
    tags: ['物联网'],
  }),
  catalogCompetition({
    id: 'wl_info_security_countermeasure',
    title: '全国大学生信息安全与对抗技术竞赛',
    category: '网络安全',
    tags: ['信息安全', '对抗技术'],
    difficulty: '中高',
  }),
  catalogCompetition({
    id: 'wl_surveying_mapping',
    title: '全国大学生测绘学科创新创业智能大赛',
    category: '测绘地理',
    sourceUrl: 'http://smt.whu.edu.cn/index.htm',
    tags: ['测绘', '地理信息'],
  }),
  catalogCompetition({
    id: 'wl_statistics_modeling',
    title: '全国大学生统计建模大赛',
    category: '统计建模',
    sourceUrl: 'http://tjjmds.ai-learning.net/',
    tags: ['统计', '建模'],
  }),
  catalogCompetition({
    id: 'wl_energy_economics',
    title: '全国大学生能源经济学术创意大赛',
    category: '能源经济',
    sourceUrl: 'http://energy.ckcest.cn/eneco/contribution/index.html#/index',
    tags: ['能源', '经济'],
  }),
  catalogCompetition({
    id: 'wl_basic_medical_innovation',
    title: '全国大学生基础医学创新研究暨实验设计论坛',
    category: '医学研究',
    sourceUrl: 'http://www.jcyxds.com/',
    tags: ['基础医学', '实验设计'],
  }),
  catalogCompetition({
    id: 'wl_digital_media_creative',
    title: '全国大学生数字媒体科技作品及创意竞赛',
    category: '数字媒体',
    sourceUrl: 'http://mit.caai.cn/',
    tags: ['数字媒体', '创意作品'],
  }),
  catalogCompetition({
    id: 'wl_tax_risk_case',
    title: '全国本科院校税收风险管控案例大赛',
    category: '财税管理',
    tags: ['税收', '案例'],
  }),
  catalogCompetition({
    id: 'wl_enterprise_simulation',
    title: '全国企业模拟竞赛大赛',
    category: '经管商科',
    sourceUrl: 'http://www.ibizsim.cn/',
    tags: ['企业模拟'],
  }),
  catalogCompetition({
    id: 'wl_digital_enterprise_sandbox',
    title: '全国高等院校数智化企业经营沙盘大赛',
    category: '经管商科',
    sourceUrl: 'http://spbk.seentao.com',
    host: '中国商业联合会',
    tags: ['沙盘', '数智经营'],
  }),
  catalogCompetition({
    id: 'wl_digital_building',
    title: '全国数字建筑创新应用大赛',
    category: '土木建筑',
    sourceUrl: 'http://bisai.ccen.com.cn',
    tags: ['数字建筑'],
  }),
  catalogCompetition({
    id: 'wl_ai_algorithm_elite',
    title: '全球校园人工智能算法精英大赛',
    category: '人工智能',
    sourceUrl: 'https://developer.huawei.com/consumer/cn/activity/digixActivity/digixdetail/101655281685926449?ha_source=HR&ha_sourceId=89000452',
    tags: ['AI算法'],
  }),
  catalogCompetition({
    id: 'wl_smart_agri_equipment',
    title: '国际大学生智能农业装备创新大赛',
    category: '农业装备',
    sourceUrl: 'http://uiaec.ujs.edu.cn',
    tags: ['智能农业'],
  }),
  catalogCompetition({
    id: 'wl_keyun_accounting',
    title: '“科云杯”全国大学生财会职业能力大赛',
    category: '财会能力',
    sourceUrl: 'http://match.xmkeyun.com.cn/',
    tags: ['财会'],
  }),
  catalogCompetition({
    id: 'wl_vocational_skills',
    title: '全国职业院校技能大赛',
    category: '职业技能',
    sourceUrl: 'https://chinaskills.icve.com.cn',
    tags: ['职业技能'],
  }),
  catalogCompetition({
    id: 'wl_robotac',
    title: '全国大学生机器人大赛-RoboTac',
    category: '机器人',
    sourceUrl: 'http://www.robotac.cn',
    tags: ['机器人', 'RoboTac'],
  }),
  catalogCompetition({
    id: 'wl_worldskills',
    title: '世界技能大赛',
    category: '职业技能',
    sourceUrl: 'http://worldskillschina.mohrss.gov.cn/',
    tags: ['世界技能'],
  }),
  catalogCompetition({
    id: 'wl_worldskills_china_selection',
    title: '世界技能大赛中国选拔赛',
    category: '职业技能',
    sourceUrl: 'http://worldskillschina.mohrss.gov.cn/',
    tags: ['中国选拔'],
  }),
  catalogCompetition({
    id: 'wl_brics_skills',
    title: '一带一路暨金砖国家技能发展与技术创新大赛',
    category: '职业技能',
    tags: ['金砖国家', '技能创新'],
  }),
  catalogCompetition({
    id: 'wl_matiji_programming',
    title: '码蹄杯全国职业院校程序设计大赛',
    category: '程序设计',
    sourceUrl: 'https://matiji.net/matibei',
    tags: ['程序设计'],
  }),
];

const competitions: CompetitionSeed[] = [...coreCompetitions, ...additionalCompetitions];

const resources: ResourceIndexSeed[] = [
  {
    id: 'official_resource_whitelist_catalog',
    title: '白名单竞赛官方目录入口',
    type: '清单',
    category: '竞赛资料',
    sourceUrl: catalogSourceUrl,
    tags: ['官方目录', '白名单竞赛'],
    description: '中国高等教育学会公开竞赛目录入口，用于核对赛事名称、类别和官方来源。',
    suitableFor: '准备选择竞赛方向、核对赛事是否属于白名单范围的同学。',
    previewPoints: ['先看目录确认赛事名称', '再进入赛事官网查看当年通知', '以学校教务和学院通知为准'],
    relatedCompetitionIds: [],
  },
  ...competitions.slice(0, 32).map((competition) => ({
    id: `official_resource_${competition.id}`,
    title: `${competition.title}官网入口`,
    type: '清单',
    category: competition.category,
    sourceUrl: competition.sourceUrl,
    tags: ['官方入口', ...competition.tags.slice(0, 2)],
    description: `整理 ${competition.title} 的官方入口，便于同学快速查报名通知、赛程、附件和联系方式。`,
    suitableFor: `正在关注「${competition.title}」的同学。`,
    previewPoints: ['查看当年通知', '核对报名时间', '下载官方附件或参赛指南'],
    relatedCompetitionIds: [competition.id],
  })),
];

const posts: PostIndexSeed[] = [
  {
    id: 'official_post_how_to_use_whitelist',
    title: '如何先用白名单目录筛选适合自己的竞赛',
    category: '经验贴',
    sourceName: '中国高等教育学会竞赛目录',
    sourceUrl: catalogSourceUrl,
    tags: ['选赛', '白名单竞赛', '使用指南'],
    summary: '先按专业方向和作品类型筛选，再进入官网核对当年通知，最后结合校内报名要求决定是否投入。',
  },
  {
    id: 'official_post_innovation_prepare',
    title: '创新创业类竞赛准备材料索引',
    category: '经验贴',
    sourceName: '全国大学生创业服务网',
    sourceUrl: 'https://cy.ncss.cn/',
    tags: ['创新创业', '报名材料', '路演'],
    summary: '创新创业类赛事通常需要项目简介、团队分工、实践证明、计划书和路演材料，具体模板以官方和学校通知为准。',
  },
  {
    id: 'official_post_programming_track',
    title: '程序设计和计算机作品类竞赛入口索引',
    category: '经验贴',
    sourceName: '计算机设计大赛/蓝桥杯官方入口',
    sourceUrl: 'http://www.jsjds.com.cn/',
    tags: ['计算机', '程序设计', '作品赛'],
    summary: '计算机类竞赛可以按个人算法赛、作品赛、创新应用三个方向拆分准备，不同赛道对代码、演示和文档的要求不同。',
  },
  {
    id: 'official_post_hardware_track',
    title: '电子设计、智能车和机器人类赛事准备入口',
    category: '经验贴',
    sourceName: '电子设计竞赛等官方入口',
    sourceUrl: 'https://www.nuedc-training.com.cn/',
    tags: ['电子设计', '智能车', '机器人'],
    summary: '硬件工程类赛事更依赖长期实验记录、模块复用、队伍分工和现场调试经验，建议尽早确认设备和场地。',
  },
  {
    id: 'official_post_material_checklist',
    title: '项目类竞赛材料检查清单',
    category: '经验贴',
    sourceName: '白名单赛事官网与竞赛目录',
    sourceUrl: catalogSourceUrl,
    tags: ['材料准备', '答辩', '项目赛'],
    summary: '项目类赛事先准备项目简介、团队分工、验证材料、演示视频和答辩稿，再按官网通知补齐模板。',
  },
  {
    id: 'official_post_schedule_check',
    title: '报名时间怎么核对更稳',
    category: '经验贴',
    sourceName: '中国高等教育学会竞赛目录',
    sourceUrl: catalogSourceUrl,
    tags: ['报名时间', '校内通知', '选赛'],
    summary: '先看官网年度通知，再看学校教务或学院通知；两个口径不一致时，以校内报名要求为准。',
  },
  {
    id: 'official_post_engineering_track',
    title: '工程实践类赛事入口索引',
    category: '经验贴',
    sourceName: '工程实践、智能制造、嵌入式等赛事入口',
    sourceUrl: 'http://www.gcxl.edu.cn/new/index.html',
    tags: ['工程实践', '智能制造', '嵌入式'],
    summary: '工程实践类赛事适合提前拆分硬件、软件、文档和现场调试任务，把过程记录从第一周就留好。',
  },
  {
    id: 'official_post_design_language_track',
    title: '设计和语言类赛事怎么选',
    category: '经验贴',
    sourceName: '白名单赛事官网与竞赛目录',
    sourceUrl: catalogSourceUrl,
    tags: ['设计', '外语', '作品集'],
    summary: '设计类先看往届命题和提交格式，语言类先确认赛道、校赛规则和展示形式，不要只按热度报名。',
  },
];

function digest(input: string) {
  return createHash('sha1').update(input).digest('hex').slice(0, 10);
}

function getCompetitionActionHints(item: CompetitionSeed) {
  return [
    `官网：${item.sourceUrl}`,
    '先查当年通知和校内报名口径。',
    '确定队伍分工后，再补计划书、作品说明或技术文档。',
  ];
}

function ensureModerationTask(targetType: 'post' | 'resource', targetId: string, action: string, note: string) {
  const existing = getOne<{ id: string }>(
    `
      SELECT id
      FROM moderation_tasks
      WHERE target_type = @targetType
        AND target_id = @targetId
        AND action = @action
        AND status IN ('pending', 'processing')
      LIMIT 1
    `,
    { targetType, targetId, action }
  );

  if (existing) {
    return false;
  }

  createModerationTask(targetType, targetId, action, note);
  return true;
}

function upsertCompetition(item: CompetitionSeed) {
  const existing = getOne<{ id: string }>('SELECT id FROM competitions WHERE id = @id', { id: item.id });
  const payload = {
    id: item.id,
    title: item.title,
    level: '国家级',
    category: item.category,
    host: item.host,
    target: item.target,
    status: '关注官网',
    deadline: '以官网通知为准',
    daysLeft: 9999,
    difficulty: item.difficulty,
    coverLabel: item.title.slice(0, 2),
    coverGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    tagsJson: JSON.stringify(item.tags),
    description: `${item.description}\n来源：${item.sourceUrl}`,
    recommendedForJson: JSON.stringify(item.recommendedFor),
    actionHintsJson: JSON.stringify(getCompetitionActionHints(item)),
  };

  if (existing) {
    run(
      `
        UPDATE competitions
        SET title = @title,
            content_scope = 'platform',
            school_id = NULL,
            level = @level,
            category = @category,
            host = @host,
            target = @target,
            status = @status,
            deadline = @deadline,
            days_left = @daysLeft,
            difficulty = @difficulty,
            cover_label = @coverLabel,
            cover_gradient = @coverGradient,
            tags_json = @tagsJson,
            description = @description,
            recommended_for_json = @recommendedForJson,
            action_hints_json = @actionHintsJson
        WHERE id = @id
      `,
      payload
    );
    return 'updated';
  }

  run(
    `
      INSERT INTO competitions (
        id, school_id, content_scope, title, level, category, host, target, status, deadline, days_left, views, difficulty,
        cover_label, cover_gradient, tags_json, description, recommended_for_json, action_hints_json
      ) VALUES (
        @id, NULL, 'platform', @title, @level, @category, @host, @target, @status, @deadline, @daysLeft, 0, @difficulty,
        @coverLabel, @coverGradient, @tagsJson, @description, @recommendedForJson, @actionHintsJson
      )
    `,
    payload
  );
  return 'inserted';
}

function upsertResourceIndex(item: ResourceIndexSeed) {
  const existing = getOne<{ id: string; moderation_status: ModerationStatus }>(
    'SELECT id, moderation_status FROM resources WHERE id = @id',
    { id: item.id }
  );
  const now = nowIso();
  const payload = {
    id: item.id,
    title: item.title,
    type: item.type,
    category: item.category,
    price: 0,
    authorName: '官方入口',
    authorMark: '源',
    authorTitle: '公开资料',
    coverLabel: item.type,
    coverGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    tagsJson: JSON.stringify(item.tags),
    description: item.description,
    sizeLabel: '官网',
    suitableFor: item.suitableFor,
    previewPointsJson: JSON.stringify([...item.previewPoints, `来源：${item.sourceUrl}`]),
    sourceUrl: item.sourceUrl,
    updatedAt: now,
  };

  if (existing) {
    run(
      `
        UPDATE resources
        SET title = @title,
            content_scope = 'platform',
            school_id = NULL,
            type = @type,
            category = @category,
            price = @price,
            author_name = @authorName,
            author_mark = @authorMark,
            author_title = @authorTitle,
            cover_label = @coverLabel,
            cover_gradient = @coverGradient,
            tags_json = @tagsJson,
            description = @description,
            size_label = @sizeLabel,
            suitable_for = @suitableFor,
            preview_points_json = @previewPointsJson,
            source_url = @sourceUrl,
            updated_at = @updatedAt
        WHERE id = @id
      `,
      payload
    );
    syncResourceCompetitionRelations(item);
    if (existing.moderation_status === 'pending') {
      const queued = ensureModerationTask('resource', item.id, 'resource_publish_review', `官方资源索引待审核：${item.title}`);
      return queued ? 'queued' : 'pending';
    }
    return existing.moderation_status === 'approved' ? 'updated' : 'rejected';
  }

  run(
    `
      INSERT INTO resources (
        id, school_id, content_scope, title, type, category, price, downloads, rating, author_name, author_mark, author_title,
        cover_label, cover_gradient, tags_json, description, size_label, suitable_for, preview_points_json,
        author_user_id, file_asset_id, source_url, moderation_status, review_note, created_at, updated_at
      ) VALUES (
        @id, NULL, 'platform', @title, @type, @category, @price, 0, 0, @authorName, @authorMark, @authorTitle,
        @coverLabel, @coverGradient, @tagsJson, @description, @sizeLabel, @suitableFor, @previewPointsJson,
        NULL, NULL, @sourceUrl, 'pending', NULL, @createdAt, @updatedAt
      )
    `,
    { ...payload, createdAt: now }
  );
  syncResourceCompetitionRelations(item);
  ensureModerationTask('resource', item.id, 'resource_publish_review', `官方资源索引待审核：${item.title}`);
  return 'queued';
}

function syncResourceCompetitionRelations(item: ResourceIndexSeed) {
  run('DELETE FROM resource_competitions WHERE resource_id = @resourceId', { resourceId: item.id });
  for (const competitionId of item.relatedCompetitionIds) {
    const competition = getOne<{ id: string }>('SELECT id FROM competitions WHERE id = @competitionId', { competitionId });
    if (!competition) {
      continue;
    }
    run(
      `
        INSERT OR IGNORE INTO resource_competitions (resource_id, competition_id)
        VALUES (@resourceId, @competitionId)
      `,
      { resourceId: item.id, competitionId }
    );
  }
}

function upsertPostIndex(item: PostIndexSeed) {
  const existing = getOne<{ id: string; moderation_status: ModerationStatus }>(
    'SELECT id, moderation_status FROM posts WHERE id = @id',
    { id: item.id }
  );
  const now = nowIso();
  const content = [
    item.summary,
    `来源：${item.sourceName}`,
    `原文：${item.sourceUrl}`,
    '内容来自公开页面，发布前需由后台人工确认。',
  ];
  const payload = {
    id: item.id,
    title: item.title,
    excerpt: item.summary.slice(0, 96),
    contentJson: JSON.stringify(content),
    category: item.category,
    authorName: '官方入口',
    authorMark: '源',
    tagsJson: JSON.stringify(item.tags),
    updatedAt: now,
  };

  if (existing) {
    run(
      `
        UPDATE posts
        SET title = @title,
            excerpt = @excerpt,
            content_json = @contentJson,
            category = @category,
            author_name = @authorName,
            author_mark = @authorMark,
            tags_json = @tagsJson,
            school_id = NULL,
            content_scope = 'platform',
            updated_at = @updatedAt
        WHERE id = @id
      `,
      payload
    );
    if (existing.moderation_status === 'pending') {
      const queued = ensureModerationTask('post', item.id, 'post_publish_review', `官方经验索引待审核：${item.title}`);
      return queued ? 'queued' : 'pending';
    }
    return existing.moderation_status === 'approved' ? 'updated' : 'rejected';
  }

  run(
    `
      INSERT INTO posts (
        id, school_id, content_scope, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
        likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
        moderation_status, created_at, updated_at
      ) VALUES (
        @id, NULL, 'platform', @title, @excerpt, @contentJson, @category, NULL, @authorName, @authorMark,
        0, 0, @tagsJson, '今日', NULL, NULL, 'pending', @createdAt, @updatedAt
      )
    `,
    { ...payload, createdAt: now }
  );
  ensureModerationTask('post', item.id, 'post_publish_review', `官方经验索引待审核：${item.title}`);
  return 'queued';
}

function summarizeItems() {
  return {
    competitions: competitions.map(({ id, title, sourceUrl }) => ({ id, title, sourceUrl })),
    resources: resources.map(({ id, title, sourceUrl }) => ({ id, title, sourceUrl })),
    posts: posts.map(({ id, title, sourceUrl }) => ({ id, title, sourceUrl })),
    checksum: digest(JSON.stringify({ competitions, resources, posts })),
  };
}

async function main() {
  if (!shouldApply) {
    console.log(JSON.stringify({ mode: 'dry-run', ...summarizeItems() }, null, 2));
    console.log('Use --apply to publish official competition rows and queue resource/post indexes for review.');
    return;
  }

  await loadDatabaseHelpers();

  const result = {
    competitionsInserted: 0,
    competitionsUpdated: 0,
    resourcesQueued: 0,
    resourcesPending: 0,
    resourcesUpdated: 0,
    resourcesRejected: 0,
    postsQueued: 0,
    postsPending: 0,
    postsUpdated: 0,
    postsRejected: 0,
  };

  for (const item of competitions) {
    const status = upsertCompetition(item);
    if (status === 'inserted') result.competitionsInserted += 1;
    if (status === 'updated') result.competitionsUpdated += 1;
  }

  for (const item of resources) {
    const status = upsertResourceIndex(item);
    if (status === 'queued') result.resourcesQueued += 1;
    if (status === 'pending') result.resourcesPending += 1;
    if (status === 'updated') result.resourcesUpdated += 1;
    if (status === 'rejected') result.resourcesRejected += 1;
  }

  for (const item of posts) {
    const status = upsertPostIndex(item);
    if (status === 'queued') result.postsQueued += 1;
    if (status === 'pending') result.postsPending += 1;
    if (status === 'updated') result.postsUpdated += 1;
    if (status === 'rejected') result.postsRejected += 1;
  }

  console.log(JSON.stringify({ mode: 'apply', ...result, checksum: summarizeItems().checksum }, null, 2));
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
