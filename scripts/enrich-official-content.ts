import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { teamExampleTemplates } from '../server/team-example-templates.ts';

type HelpersModule = typeof import('../server/helpers.ts');

interface OfficialCompetitionDetail {
  id: string;
  title: string;
  host: string;
  target: string;
  description: string;
  teamSize: string;
  stages: string[];
  submissionMaterials: string[];
  recommendedFor: string[];
  actionHints: string[];
  sourceUrl: string;
  editionLabel?: string;
  registrationMethod?: string;
  tracks?: string[];
  awards?: string;
  feeDescription?: string;
  officialContact?: string;
}

type CompetitionScheduleStatus = 'announced' | 'partially_announced' | 'not_announced' | 'closed';

interface CompetitionEvidence {
  editionLabel: string;
  currentEditionLabel?: string;
  referenceEditionLabel?: string;
  referenceNoticeUrl?: string;
  scheduleNote?: string;
  dataFreshness?: 'current' | 'reference' | 'rules_only';
  scheduleStatus: CompetitionScheduleStatus;
  status: string;
  noticeTitle: string;
  noticeUrl: string;
  noticePublishedAt?: string;
  sourceUrl?: string;
  registrationStart?: string;
  registrationEnd?: string;
  competitionStart?: string;
  competitionEnd?: string;
  officialContact?: string;
}

interface PlatformResourceSeed {
  id: string;
  title: string;
  category: string;
  filePath: string;
  description: string;
  suitableFor: string;
  previewPoints: string[];
  relatedCompetitionIds: string[];
}

const verifiedAt = '2026-07-27';
const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const productionConfirmed = args.has('--confirm-production');

const competitions: OfficialCompetitionDetail[] = [
  {
    id: 'wl_china_innovation',
    title: '中国国际大学生创新大赛',
    host: '教育部等部门',
    target: '符合当届参赛资格的高校学生项目团队',
    description: '面向高校学生创新创业项目的综合性赛事，设置高教主赛道、“青年红色筑梦之旅”和产业命题等方向。校内选拔时间由各高校分别安排。',
    teamSize: '按当届赛道和组别要求执行',
    stages: ['校内遴选', '省级赛事', '全国总决赛'],
    submissionMaterials: ['在线报名信息与团队信息', '项目计划书或项目说明材料', '路演展示材料', '当届赛道要求的证明、视频或附件'],
    recommendedFor: ['已有项目原型、科研转化、社会实践或商业验证材料的团队。', '能够持续完善项目、材料和路演表达的跨专业团队。'],
    actionHints: ['先确认参赛赛道、组别和校内截止时间。', '按当届模板整理项目计划书、证明材料和路演文件。'],
    sourceUrl: 'https://cy.ncss.cn/',
  },
  {
    id: 'wl_tiaozhanbei_research',
    title: '挑战杯全国大学生课外学术科技作品竞赛',
    host: '共青团中央、中国科协、教育部等',
    target: '符合当届章程要求的高校学生个人或团队作品',
    description: '作品分为自然科学类学术论文、哲学社会科学类社会调查报告和科技发明制作等类别，按个人作品或集体作品申报。',
    teamSize: '支持个人或集体作品，成员人数按作品类别执行',
    stages: ['校内遴选', '省级竞赛', '全国决赛'],
    submissionMaterials: ['作品申报书', '论文、调查报告或科技作品说明书', '实验数据、查新、专利等支撑材料（如适用）', '当届通知要求的展示或答辩材料'],
    recommendedFor: ['已有科研训练、课程研究、社会调查或工程原型的同学。', '能够提供完整研究过程和可核验证据的作品团队。'],
    actionHints: ['先核对作品类别和申报资格。', '保留原始数据、实验记录和知识产权证明。'],
    sourceUrl: 'https://www.tiaozhanbei.net/',
  },
  {
    id: 'wl_tiaozhanbei_business',
    title: '挑战杯中国大学生创业计划竞赛',
    host: '共青团中央、教育部等',
    target: '符合当届章程要求的高校学生创业项目团队',
    description: '围绕科技创新、乡村振兴、城市治理、生态环保、文化创意和社会服务等方向开展创业计划竞赛。',
    teamSize: '团队项目参赛，成员共同完成项目、材料和路演',
    stages: ['校内遴选', '省级竞赛', '全国决赛'],
    submissionMaterials: ['项目申报书', '创业计划书', '项目进展和佐证材料', '路演文件及当届要求的附件'],
    recommendedFor: ['已有明确用户、场景、方案和验证材料的团队。', '具备技术、产品、商业分析和答辩分工的团队。'],
    actionHints: ['先确认赛道、组别和知识产权归属。', '用真实验证材料支撑市场、技术和社会价值。'],
    sourceUrl: 'https://www.tiaozhanbei.net/',
  },
  {
    id: 'wl_mcm',
    title: '全国大学生数学建模竞赛',
    host: '中国工业与应用数学学会',
    target: '普通高校全日制在校本专科学生',
    description: '参赛队在规定时间内围绕给定问题完成模型建立、计算分析、结果检验和论文写作，由学校所属赛区组织报名。',
    teamSize: '每队不超过 3 名学生，来自同一所学校',
    stages: ['学校或赛区报名', '全国统一竞赛', '赛区与全国评审'],
    submissionMaterials: ['按当届规范提交的竞赛论文', '赛区要求的承诺书或报名材料', '当届通知要求的附件或支撑文件'],
    recommendedFor: ['数学、统计、计算机和工程类专业同学。', '适合由建模、编程和论文写作能力互补的三人团队参加。'],
    actionHints: ['提前核对赛区报名方式和论文格式。', '训练建模、代码复现、图表表达和论文排版。'],
    sourceUrl: 'http://www.mcm.edu.cn/',
  },
  {
    id: 'wl_nuedc',
    title: '全国大学生电子设计竞赛',
    host: '全国大学生电子设计竞赛组织委员会',
    target: '普通高校全日制在校本专科学生',
    description: '以电子系统设计和现场实践为核心，三名学生在规定时间内完成命题要求的设计、制作、调试和报告。',
    teamSize: '每队 3 名学生',
    stages: ['学校与赛区报名', '统一命题竞赛', '赛区测评与全国评审'],
    submissionMaterials: ['设计报告', '按赛题要求完成的实物作品', '报名和作品登记材料', '当届测评要求的附件'],
    recommendedFor: ['电子、电气、自动化、通信和计算机硬件方向同学。', '具备电路、嵌入式、调试和文档分工的团队。'],
    actionHints: ['提前熟悉常用仪器和元器件。', '建立电路、代码、测试数据和报告的版本记录。'],
    sourceUrl: 'https://www.nuedc-training.com.cn/',
  },
  {
    id: 'wl_computer_design',
    title: '中国大学生计算机设计大赛',
    host: '中国大学生计算机设计大赛组织委员会',
    target: '符合当届规程要求的高校本科生作品',
    description: '覆盖软件应用、信息可视化、人工智能、数字媒体等多个大类，各大类分别规定参赛人数、作品形态和提交格式。',
    teamSize: '按参赛大类执行，部分赛项支持个人或小组参赛',
    stages: ['校级选拔', '省级赛事或资格赛', '全国决赛'],
    submissionMaterials: ['作品文件或可运行程序', '作品说明文档', '演示视频或展示文件', '当届大类规程要求的源文件和附件'],
    recommendedFor: ['已有软件、算法、交互、动画、可视化或数字媒体作品的同学。', '希望把课程项目打磨为完整参赛作品的团队。'],
    actionHints: ['先选择具体大类，再按对应规程准备材料。', '保证作品可运行、可演示并具备原创性证明。'],
    sourceUrl: 'http://www.jsjds.com.cn/',
  },
  {
    id: 'wl_lanqiao',
    title: '蓝桥杯全国软件和信息技术专业人才大赛',
    host: '工业和信息化部人才交流中心等',
    target: '符合当届报名条件的高校学生',
    description: '包含软件、电子及项目类等赛道；个人赛按科目和组别参赛，项目赛按团队作品参赛。',
    teamSize: '个人赛为主，项目赛按对应赛道规则执行',
    stages: ['报名与校内确认', '省赛', '全国总决赛'],
    submissionMaterials: ['个人身份和报名信息', '竞赛现场提交的代码或答案', '项目赛要求的作品、说明和演示材料（如适用）'],
    recommendedFor: ['希望通过算法、编程、电子或项目能力参加阶段性竞赛的同学。', '适合按具体科目制定刷题或项目训练计划。'],
    actionHints: ['先核对科目、组别、语言和比赛环境。', '项目赛与个人赛分别查看对应规程。'],
    sourceUrl: 'https://dasai.lanqiao.cn/',
  },
  {
    id: 'wl_smart_car',
    title: '全国大学生智能汽车竞赛',
    host: '全国大学生智能汽车竞赛组织委员会',
    target: '符合当届规则的高校学生团队',
    description: '围绕智能车系统的感知、控制、嵌入式实现、机械结构和现场调试开展竞赛。赛组设置和器材限制每届可能调整。',
    teamSize: '按当届赛组规则执行',
    stages: ['学校报名与备赛', '分赛区竞赛', '全国总决赛'],
    submissionMaterials: ['参赛队和赛组报名信息', '符合规则的智能车作品', '技术报告或现场要求的材料', '当届规则要求的代码、视频或附件'],
    recommendedFor: ['自动化、电子、车辆、机械和计算机方向同学。', '能够长期进行硬件、控制、视觉和机械联调的团队。'],
    actionHints: ['先确认赛组、指定器材和技术限制。', '用实验记录管理参数、代码和硬件版本。'],
    sourceUrl: 'https://m.cahe.edu.cn/site/content/16010.html',
  },
  {
    id: 'wl_mechanical_innovation',
    title: '全国大学生机械创新设计大赛',
    host: '全国大学生机械创新设计大赛组委会',
    target: '符合当届主题和参赛资格的高校学生团队',
    description: '第十二届主题为“灵巧·智能，美好生活”，参赛团队完成机械创新方案、设计分析、样机制作和现场展示。',
    teamSize: '团队参赛，成员共同完成设计、计算、制造和展示',
    stages: ['校内选拔', '省级预赛', '全国决赛'],
    submissionMaterials: ['作品申报书', '设计说明书和必要图纸', '实物样机或模型', '演示视频、查新或知识产权材料（按当届要求）'],
    recommendedFor: ['机械、机电、工业设计和自动化方向同学。', '已有课程设计、机械原型或工程训练基础的团队。'],
    actionHints: ['按当届主题检查作品相关性。', '同步准备设计计算、工程图纸、样机和展示材料。'],
    sourceUrl: 'https://m.cahe.edu.cn/site/content/16010.html',
  },
  {
    id: 'wl_ad_design',
    title: '全国大学生广告艺术大赛',
    host: '全国大学生广告艺术大赛组委会',
    target: '符合当届参赛办法的高校学生个人或团队',
    description: '围绕公开命题完成平面、视频、动画、策划、文案等创意作品，各类别分别规定尺寸、时长和文件格式。',
    teamSize: '个人或团队参赛，人数按作品类别执行',
    stages: ['校内选送', '赛区评审', '全国评审'],
    submissionMaterials: ['符合命题规格的作品文件', '作品信息和作者信息', '创意说明或策划案', '版权、肖像和素材授权材料（如适用）'],
    recommendedFor: ['设计、传媒、广告、市场营销、中文和新媒体方向同学。', '能够围绕真实命题完成策略与创意表达的个人或团队。'],
    actionHints: ['逐项核对命题、尺寸、时长和文件格式。', '使用可授权素材并保留源文件。'],
    sourceUrl: 'http://www.sun-ada.net/',
  },
  {
    id: 'wl_energy_saving',
    title: '全国大学生节能减排社会实践与科技竞赛',
    host: '全国大学生节能减排社会实践与科技竞赛委员会',
    target: '符合当届章程要求的高校学生团队',
    description: '围绕节能、低碳、环保和社会实践方向提交科技作品或调查报告，强调问题价值、技术路线、实验验证和社会效益。',
    teamSize: '团队参赛，成员共同完成调研、实验、工程实现和答辩',
    stages: ['校内遴选', '作品初审', '全国决赛'],
    submissionMaterials: ['作品申报书', '科技作品说明书或社会实践调查报告', '实验数据、样机、图片或证明材料', '决赛展示文件和视频（按当届要求）'],
    recommendedFor: ['能源、环境、材料、工程和社会实践方向同学。', '有真实调研、实验数据、技术方案或原型验证的团队。'],
    actionHints: ['区分科技作品与社会实践类材料要求。', '对节能效果、成本和数据来源给出可复核依据。'],
    sourceUrl: 'http://www.jienengjianpai.org/',
  },
  {
    id: 'wl_logistics_design',
    title: '全国大学生物流设计大赛',
    host: '中国物流与采购联合会等',
    target: '符合当届章程要求的高校学生团队',
    description: '围绕当届企业案例开展物流系统、供应链和运营方案设计，强调案例理解、数据分析、模型方法和方案可实施性。',
    teamSize: '每队 5 人，至少 2 名物流类专业或物流方向学生，不跨校组队',
    stages: ['报名与校内组织', '初赛评审', '复赛或全国决赛'],
    submissionMaterials: ['案例解决方案或设计报告', '数据分析、模型和必要附件', '答辩演示文件', '当届案例要求的补充材料'],
    recommendedFor: ['物流、供应链、工业工程、管理科学和交通运输方向同学。', '具备案例分析、数据建模和方案表达能力的团队。'],
    actionHints: ['只使用当届案例允许的数据和材料。', '明确问题、约束、模型、方案和实施成本之间的关系。'],
    sourceUrl: 'https://m.cahe.edu.cn/site/content/16010.html',
  },
  {
    id: 'wl_robot_contest', title: '全国大学生机器人大赛', host: '全国大学生机器人大赛组委会',
    target: '普通高校在校学生组成的机器人项目团队',
    description: '面向机器人设计、制作、控制和现场任务执行的综合赛事，常见赛项包含机器人竞技、工程实践和技术展示。',
    teamSize: '团队参赛，成员按具体赛项分工，通常包含机械、控制、视觉和运营角色',
    stages: ['学校组织与队伍注册', '分区赛或专项赛', '全国总决赛'],
    submissionMaterials: ['队伍与成员注册信息', '机器人技术资料和安全文件', '赛项要求的代码、视频或工程文档', '现场参赛确认材料'],
    recommendedFor: ['机械、自动化、电子、计算机和控制方向学生。', '具有机器人样机、控制系统或长期工程训练基础的团队。'],
    actionHints: ['先确定赛项，再按照任务书拆分机械、电控和算法工作。', '建立安全检查、版本管理和现场备件清单。'],
    registrationMethod: '由参赛队在赛事系统注册，学校指导教师和赛项要求共同完成资格确认。',
    tracks: ['机器人竞技', '工程实践', '技术展示'], sourceUrl: 'http://www.cnrobocon.net/',
  },
  {
    id: 'wl_robot_ai', title: '中国机器人及人工智能大赛', host: '中国人工智能学会',
    target: '高校在校学生个人或团队',
    description: '围绕机器人、人工智能算法和创新应用设置多个赛道，考查系统实现、算法效果和现场任务完成能力。',
    teamSize: '个人或小组参赛，项目类赛道通常由算法、开发和展示成员协作',
    stages: ['报名与作品准备', '省赛或区域选拔', '全国总决赛'],
    submissionMaterials: ['报名和成员信息', '作品说明或技术报告', '代码、模型、演示视频等赛道材料', '答辩或现场运行文件'],
    recommendedFor: ['人工智能、机器人、计算机和自动化方向学生。', '有算法模型、机器人平台或应用原型的团队。'],
    actionHints: ['按赛道任务书建立可重复运行的测试环境。', '保留训练数据来源、指标和现场演示备份。'],
    registrationMethod: '通过赛事报名平台选择赛道并提交队伍信息和作品材料。',
    tracks: ['机器人应用', '人工智能算法', '创新创意'], sourceUrl: 'https://www.caai.cn/',
  },
  {
    id: 'wl_c4_computer', title: '中国高校计算机大赛', host: '全国高等学校计算机教育研究会等',
    target: '高校在校学生个人或团队',
    description: '由多个独立赛道组成，覆盖软件开发、人工智能、大数据、网络技术和创新应用。',
    teamSize: '个人或团队参赛，团队人数随赛道变化',
    stages: ['赛道报名', '区域或线上选拔', '全国总决赛'],
    submissionMaterials: ['队伍报名信息', '项目代码或模型', '作品说明文档', '演示视频或答辩材料'],
    recommendedFor: ['计算机、软件、数据科学和人工智能方向学生。', '已具备可运行作品、算法或数据分析成果的团队。'],
    actionHints: ['先选择具体赛道并建立材料清单。', '确保作品可复现并准备现场演示环境。'],
    registrationMethod: '在各赛道官方系统中完成注册、组队和材料提交。',
    tracks: ['软件应用', '人工智能', '大数据', '网络技术'], sourceUrl: 'http://www.c4best.cn/',
  },
  {
    id: 'wl_structural_design', title: '全国大学生结构设计竞赛', host: '全国大学生结构设计竞赛委员会',
    target: '土木、工程及相关专业高校学生团队',
    description: '围绕指定工程结构命题开展方案设计、计算分析、模型制作和加载测试。',
    teamSize: '小组参赛，成员共同完成结构设计、计算、制作和答辩',
    stages: ['校内选拔', '省级竞赛', '全国总决赛'],
    submissionMaterials: ['结构设计说明书', '计算书和图纸', '结构模型', '现场陈述和加载测试材料'],
    recommendedFor: ['土木工程、力学、建筑和工程管理方向学生。', '具备结构计算、模型制作和现场协作能力的团队。'],
    actionHints: ['同步迭代计算模型和实体模型。', '提前验证材料加工误差和加载失效模式。'],
    registrationMethod: '由学校组织校内选拔并通过省级赛区推荐进入全国赛。',
    tracks: ['结构设计与模型制作'], sourceUrl: 'http://www.structurecontest.com/',
  },
  {
    id: 'wl_life_science', title: '全国大学生生命科学竞赛', host: '全国大学生生命科学竞赛委员会',
    target: '生命科学及相关专业高校学生团队',
    description: '包括科学探究和创新创业方向，强调真实实验过程、研究数据和成果表达。',
    teamSize: '团队参赛，由学生成员和指导教师共同完成研究过程',
    stages: ['项目报名与研究实施', '网络评审或省赛', '全国决赛'],
    submissionMaterials: ['项目申报书', '研究报告或创业计划书', '实验记录与原始数据', '展示视频和答辩文件'],
    recommendedFor: ['生物、医学、农学、食品和生态方向学生。', '已有实验课题、调查数据或转化项目的团队。'],
    actionHints: ['保留连续实验记录和原始数据。', '明确伦理、生物安全和样本来源。'],
    registrationMethod: '通过大赛平台提交项目，完成学校和赛区审核。',
    tracks: ['科学探究', '创新创业'], sourceUrl: 'https://www.culsc.cn/',
  },
  {
    id: 'wl_ecommerce', title: '全国大学生电子商务创新创意创业挑战赛', host: '全国大学生电子商务创新创意创业挑战赛竞赛组织委员会',
    target: '高校在校学生组成的电子商务项目团队',
    description: '围绕电子商务、数字商业和乡村振兴等场景开展创新、创意和创业项目实践。',
    teamSize: '团队参赛，适合产品、运营、数据、设计和路演成员协作',
    stages: ['校级赛', '省级赛', '全国总决赛'],
    submissionMaterials: ['团队报名信息', '项目计划书', '项目数据和佐证材料', '路演文件与展示视频'],
    recommendedFor: ['电子商务、管理、经济、计算机和设计方向学生。', '已有真实用户、运营数据或商业验证的团队。'],
    actionHints: ['用真实业务数据说明需求和验证。', '清楚区分创意、产品能力和商业结果。'],
    registrationMethod: '在三创赛系统创建队伍、选择赛道并提交校赛材料。',
    tracks: ['常规赛', '实战赛', '乡村振兴'], sourceUrl: 'https://www.sanchuang.net/',
  },
  {
    id: 'wl_fltrp', title: '“外研社·国才杯”全国大学生外语能力大赛', host: '外语教学与研究出版社等',
    target: '符合参赛组别要求的高校在校学生',
    description: '设置英语演讲、阅读、写作、翻译和综合能力等赛项，考查语言运用与跨文化沟通。',
    teamSize: '个人赛为主，部分综合赛项包含团队协作',
    stages: ['校赛', '省赛', '全国决赛'],
    submissionMaterials: ['个人报名信息', '校赛或省赛推荐信息', '赛项要求的文本、录音或视频', '决赛身份确认材料'],
    recommendedFor: ['英语、翻译、国际传播及希望提升外语表达的学生。', '具有演讲、写作、阅读或翻译专项基础的参赛者。'],
    actionHints: ['按赛项分别训练，不把综合准备替代专项训练。', '保留录音、作文和翻译版本用于复盘。'],
    registrationMethod: '通过学校赛点或大赛平台完成报名和晋级确认。',
    tracks: ['演讲', '阅读', '写作', '翻译', '综合能力'], sourceUrl: 'https://ucc.fltrp.com/',
  },
  {
    id: 'wl_service_outsourcing', title: '中国大学生服务外包创新创业大赛', host: '中国大学生服务外包创新创业大赛组委会',
    target: '高校在校学生组成的项目团队',
    description: '围绕企业命题和服务创新完成需求分析、技术实现、商业方案和现场答辩。',
    teamSize: '团队参赛，通常包含产品、开发、测试和答辩角色',
    stages: ['报名选题', '区域赛评审', '全国总决赛'],
    submissionMaterials: ['团队报名信息', '项目方案书', '代码或可运行作品', '演示视频与答辩文件'],
    recommendedFor: ['软件、计算机、设计和管理方向学生。', '能够围绕企业问题交付可运行方案的团队。'],
    actionHints: ['逐条对应企业命题需求。', '准备稳定演示、数据说明和部署文档。'],
    registrationMethod: '在大赛平台选择企业命题、组建团队并分阶段提交材料。',
    tracks: ['企业命题', '创业实践'], sourceUrl: 'http://www.fwwb.org.cn/',
  },
  {
    id: 'wl_statistics_modeling', title: '全国大学生统计建模大赛', host: '中国统计教育学会',
    target: '高校在校学生统计建模团队',
    description: '围绕年度主题使用公开或调研数据完成统计分析、模型构建和论文写作。',
    teamSize: '小组参赛，适合统计、数据处理和论文写作成员协作',
    stages: ['学校报名与选题', '赛区评审', '全国总决赛'],
    submissionMaterials: ['报名信息', '统计建模论文', '数据来源和附录', '答辩演示文件'],
    recommendedFor: ['统计、数学、经济、管理和数据科学方向学生。', '具备数据获取、统计推断和论文写作能力的团队。'],
    actionHints: ['确保数据来源合法且可以复核。', '区分描述性结果、因果解释和预测结论。'],
    registrationMethod: '由学校组织报名，团队通过竞赛系统提交论文和赛区材料。',
    tracks: ['本科生组', '研究生组'], sourceUrl: 'http://tjjmds.ai-learning.net/',
  },
  {
    id: 'wl_siemens_cimc', title: '“西门子杯”中国智能制造挑战赛', host: '教育部高等学校自动化类专业教学指导委员会等',
    target: '高校在校学生组成的智能制造项目团队',
    description: '围绕工业自动化、智能制造系统和工程应用设置赛项，强调工程实现和现场调试。',
    teamSize: '团队参赛，由控制、软件、机械和现场调试成员协作',
    stages: ['报名与初赛准备', '赛区初赛', '全国总决赛'],
    submissionMaterials: ['团队报名信息', '技术方案或设计报告', '程序、组态和工程文件', '现场答辩材料'],
    recommendedFor: ['自动化、电气、机械、工业工程和计算机方向学生。', '有控制系统、数字化产线或工业软件实践的团队。'],
    actionHints: ['建立设备、软件版本和参数清单。', '准备离线备份和现场故障处理预案。'],
    registrationMethod: '在挑战赛平台选择赛项并完成团队注册、初赛和决赛确认。',
    tracks: ['流程工业自动化', '离散行业自动化', '智能制造创新'], sourceUrl: 'http://www.siemenscup-cimc.org.cn/',
  },
  {
    id: 'wl_engineering_practice', title: '全国大学生工程实践与创新能力大赛', host: '教育部工程训练教学指导委员会',
    target: '参加高校工程训练与创新实践的在校学生团队',
    description: '围绕工程基础、智能制造和虚拟仿真等方向完成设计、制作、调试和现场任务。',
    teamSize: '团队参赛，成员承担设计、制造、控制和现场操作',
    stages: ['校级选拔', '省级选拔', '全国总决赛'],
    submissionMaterials: ['团队报名信息', '设计与工艺文件', '程序或仿真文件', '现场任务和答辩材料'],
    recommendedFor: ['机械、自动化、工业工程、电子和计算机方向学生。', '具备工程训练、加工制造或系统调试经验的团队。'],
    actionHints: ['以现场任务反推训练计划。', '建立工艺、装配、程序和调试记录。'],
    registrationMethod: '由学校工程训练中心组织选拔并按赛区流程推荐。',
    tracks: ['工程基础', '智能制造', '虚拟仿真'], sourceUrl: 'http://www.gcxl.edu.cn/',
  },
  {
    id: 'wl_software_cup', title: '“中国软件杯”大学生软件设计大赛', host: '工业和信息化部、教育部等',
    target: '高校在校学生组成的软件项目团队',
    description: '围绕产业命题完成软件需求分析、系统设计、开发实现和应用展示。',
    teamSize: '团队参赛，适合产品、前后端、算法、测试和答辩成员协作',
    stages: ['报名选题', '初赛作品评审', '全国总决赛'],
    submissionMaterials: ['报名信息', '项目方案与设计文档', '源代码和可运行程序', '演示视频与答辩文件'],
    recommendedFor: ['计算机、软件工程、人工智能和数字媒体方向学生。', '能够交付完整软件系统和技术文档的团队。'],
    actionHints: ['严格对应赛题需求和验收指标。', '准备部署说明、测试数据和演示备份。'],
    registrationMethod: '通过大赛平台选择赛题、注册团队并提交初赛作品。',
    tracks: ['产业命题软件设计'], sourceUrl: 'http://www.cnsoftbei.com/',
  },
  {
    id: 'wl_market_research', title: '全国大学生市场调查与分析大赛', host: '中国商业统计学会',
    target: '高校在校学生组成的市场调查团队',
    description: '围绕真实市场问题完成调查设计、数据采集、统计分析、研究报告和现场答辩。',
    teamSize: '团队参赛，由调研、数据分析、报告和答辩成员协作',
    stages: ['知识赛与校赛', '省赛', '全国总决赛'],
    submissionMaterials: ['参赛报名信息', '调查问卷与抽样方案', '数据和分析报告', '答辩演示文件'],
    recommendedFor: ['统计、市场营销、经济、管理和社会学方向学生。', '能够开展真实调研并完成数据分析的团队。'],
    actionHints: ['先完成研究问题、样本和问卷的小规模预调查。', '保留数据清洗规则和分析代码。'],
    registrationMethod: '由学校组织知识赛和实践赛报名，晋级团队提交调查报告。',
    tracks: ['本科生组', '研究生组'], sourceUrl: 'http://www.china-cssc.org/',
  },
  {
    id: 'wl_ic_innovation', title: '全国大学生集成电路创新创业大赛', host: '全国大学生集成电路创新创业大赛组委会',
    target: '高校在校学生组成的集成电路项目团队',
    description: '围绕芯片设计、EDA、系统应用和产业命题开展工程创新与现场答辩。',
    teamSize: '团队参赛，由芯片、验证、软件、硬件和展示成员协作',
    stages: ['报名与企业杯选题', '分赛区决赛', '全国总决赛'],
    submissionMaterials: ['团队报名信息', '设计方案和技术报告', '代码、版图、验证或硬件材料', '演示视频与答辩文件'],
    recommendedFor: ['微电子、集成电路、电子、计算机和自动化方向学生。', '具有芯片设计、验证或系统应用基础的团队。'],
    actionHints: ['围绕企业杯验收指标组织设计和验证。', '保留仿真、测试和版本记录。'],
    registrationMethod: '在大赛系统选择企业杯、注册团队并按节点提交技术材料。',
    tracks: ['企业杯', '集成电路设计', '系统应用'], sourceUrl: 'https://univ.ciciec.com/',
  },
  {
    id: 'wl_future_designer', title: '未来设计师·全国高校数字艺术设计大赛', host: '未来设计师全国高校数字艺术设计大赛组委会',
    target: '高校在校学生个人或团队数字艺术作品',
    description: '面向视觉传达、数字媒体、交互、动画、产品和空间设计等方向征集原创作品。',
    teamSize: '个人或团队参赛，团队共同完成策划、设计和数字制作',
    stages: ['校级或赛区投稿', '省级评审', '全国评审'],
    submissionMaterials: ['作品文件', '作品说明和作者信息', '过程或版权说明材料', '展示视频或源文件摘要'],
    recommendedFor: ['设计、数字媒体、动画、建筑和计算机艺术方向学生。', '具备原创作品和完整设计过程的个人或团队。'],
    actionHints: ['逐项检查作品尺寸、格式和匿名要求。', '保留源文件和素材授权记录。'],
    registrationMethod: '通过赛事平台选择赛区和类别，提交作品及作者信息。',
    tracks: ['视觉传达', '数字媒体', '交互设计', '动画', '产品与空间'], sourceUrl: 'https://www.ncda.org.cn/',
  },
  {
    id: 'wl_information_security', title: '全国大学生信息安全竞赛', host: '教育部高等学校网络空间安全专业教学指导委员会',
    target: '高校在校学生个人或团队',
    description: '包含作品赛和创新实践能力赛，覆盖安全系统、密码、攻防、数据安全和创新应用。',
    teamSize: '个人或团队参赛，作品赛和实践赛采用不同队伍结构',
    stages: ['报名与作品准备', '分区或线上选拔', '全国总决赛'],
    submissionMaterials: ['报名信息', '作品说明或技术报告', '代码、系统和演示视频', '实践赛资格与现场材料'],
    recommendedFor: ['网络空间安全、计算机、密码和软件方向学生。', '有安全工具、系统作品或攻防训练经验的团队。'],
    actionHints: ['隔离测试环境并避免使用未经授权的数据。', '准备漏洞复现、修复建议和现场演示备份。'],
    registrationMethod: '通过竞赛平台选择作品赛或实践赛并完成队伍注册。',
    tracks: ['作品赛', '创新实践能力赛'], sourceUrl: 'http://www.ciscn.cn/',
  },
  {
    id: 'wl_iot_design', title: '全国大学生物联网设计竞赛', host: '教育部高等学校计算机类专业教学指导委员会等',
    target: '高校在校学生组成的物联网项目团队',
    description: '围绕物联网感知、连接、边缘计算、云平台和行业应用完成系统设计与作品展示。',
    teamSize: '团队参赛，由硬件、嵌入式、云端、应用和展示成员协作',
    stages: ['报名与作品开发', '分赛区决赛', '全国总决赛'],
    submissionMaterials: ['报名信息', '项目设计文档', '代码、硬件和部署材料', '演示视频与答辩文件'],
    recommendedFor: ['物联网、电子、通信、计算机和自动化方向学生。', '具有软硬件联调和云边端系统经验的团队。'],
    actionHints: ['明确设备、协议、平台和数据流。', '准备断网、设备故障和现场网络替代方案。'],
    registrationMethod: '通过赛事入口选择赛题或开放赛道，注册团队并提交作品。',
    tracks: ['命题赛', '创意赛', '物联网应用'], sourceUrl: 'https://iot.sjtu.edu.cn/',
  },
  {
    id: 'wl_milan_design_week', title: '米兰设计周中国高校设计学科师生优秀作品展', host: '米兰设计周中国高校设计学科师生优秀作品展组委会',
    target: '高校设计学科学生个人或团队作品',
    description: '面向视觉、产品、环境、数字媒体、时尚和综合设计方向征集高校原创作品。',
    teamSize: '个人或团队参赛，团队成员共同完成设计研究和作品表达',
    stages: ['校赛或赛区征集', '省级评审', '全国评审与展示'],
    submissionMaterials: ['作品图片或视频', '作品说明和作者信息', '原创与版权声明', '组别要求的补充文件'],
    recommendedFor: ['视觉、产品、环境、服装、数字媒体和建筑方向学生。', '具有完整原创作品和设计说明的个人或团队。'],
    actionHints: ['按类别核对版式、尺寸和文件限制。', '保留源文件、过程稿和素材授权。'],
    registrationMethod: '通过赛事平台选择赛区和作品类别完成在线投稿。',
    tracks: ['视觉传达', '产品设计', '环境设计', '数字媒体', '时尚设计'], sourceUrl: 'https://www.milan-aap.org.cn/',
  },
];

const teamSizeOverrides: Record<string, string> = {
  wl_china_innovation: '团队项目参赛，成员结构随赛道和项目分工设置',
  wl_tiaozhanbei_research: '个人或团队作品，团队成员共同完成研究、实验和展示',
  wl_tiaozhanbei_business: '团队项目参赛，适合产品、技术、运营、财务和路演成员协作',
  wl_smart_car: '团队参赛，成员承担机械、电控、算法和现场调试',
  wl_mechanical_innovation: '团队参赛，成员承担设计、计算、制造和展示',
  wl_energy_saving: '团队参赛，成员共同完成调研、实验、工程实现和答辩',
  wl_logistics_design: '每队 5 人，至少 2 名物流类专业或物流方向学生，不跨校组队',
};

const trackOverrides: Record<string, string[]> = {
  wl_china_innovation: ['高教主赛道', '青年红色筑梦之旅', '产业命题'],
  wl_tiaozhanbei_research: ['自然科学类学术论文', '哲学社会科学类调查报告', '科技发明制作'],
  wl_tiaozhanbei_business: ['科技创新和未来产业', '乡村振兴', '社会治理', '生态环保', '文化创意'],
  wl_mcm: ['本科组数学建模'],
  wl_nuedc: ['电子系统设计'],
  wl_computer_design: ['软件应用与开发', '人工智能', '信息可视化', '数字媒体'],
  wl_lanqiao: ['软件赛', '电子赛', '项目实战赛'],
  wl_smart_car: ['智能车竞速与创意赛组'],
  wl_mechanical_innovation: ['机械创新设计与样机制作'],
  wl_ad_design: ['平面', '视频', '动画', '策划', '文案'],
  wl_energy_saving: ['科技作品', '社会实践调查报告'],
  wl_logistics_design: ['企业案例解决方案'],
};

const competitionEvidence: Record<string, CompetitionEvidence> = {
  wl_china_innovation: {
    editionLabel: '中国国际大学生创新大赛（2026）', scheduleStatus: 'partially_announced', status: '赛程已发布',
    noticeTitle: '教育部关于举办中国国际大学生创新大赛（2026）的通知', noticeUrl: 'https://cy.ncss.cn/', noticePublishedAt: '2026-07-24',
  },
  wl_tiaozhanbei_research: {
    editionLabel: '第十九届（2025，最新已完成届次）', scheduleStatus: 'closed', status: '已结束',
    noticeTitle: '第十九届“挑战杯”全国大学生课外学术科技作品竞赛', noticeUrl: 'https://www.tiaozhanbei.net/',
    currentEditionLabel: '2026 届尚未发布', referenceEditionLabel: '第十九届（2025）',
    referenceNoticeUrl: 'https://www.tiaozhanbei.net/', dataFreshness: 'reference',
    scheduleNote: '2026 届课外学术科技作品竞赛尚未发布，当前内容参考 2025 年第十九届规则。',
  },
  wl_tiaozhanbei_business: {
    editionLabel: '第十五届（2026）', scheduleStatus: 'partially_announced', status: '省赛与国赛阶段',
    noticeTitle: '关于举办第十五届“挑战杯”中国大学生创业计划竞赛的通知', noticeUrl: 'https://www.tiaozhanbei.net/article/15842/', noticePublishedAt: '2026-05-23',
  },
  wl_mcm: {
    editionLabel: '2026 高教社杯', scheduleStatus: 'announced', status: '报名中',
    noticeTitle: '2026高教社杯全国大学生数学建模竞赛第一次通知', noticeUrl: 'http://www.mcm.edu.cn/html_cn/node/d6fd7a0ee8f3a3d525e30af1c365fcec.html', noticePublishedAt: '2026-03-24',
    registrationEnd: '2026-09-07', competitionStart: '2026-09-10', competitionEnd: '2026-09-13',
    officialContact: '010-62781785 / cumcm@csiam.org.cn',
  },
  wl_nuedc: {
    editionLabel: '2026 模拟电子系统设计专题赛', scheduleStatus: 'announced', status: '选拔赛阶段',
    noticeTitle: '关于开展2026年全国大学生电子设计竞赛模拟电子系统设计专题赛的通知', noticeUrl: 'https://www.nuedc-training.com.cn/index/news/details/new_id/345',
    competitionStart: '2026-07-29', competitionEnd: '2026-08-27',
  },
  wl_computer_design: {
    editionLabel: '第十九届（2026）', scheduleStatus: 'partially_announced', status: '全国决赛阶段',
    noticeTitle: '2026年（第19届）中国大学生计算机设计大赛通知', noticeUrl: 'https://jsjds.blcu.edu.cn/info/1041/2274.htm', noticePublishedAt: '2026-03-01', sourceUrl: 'https://jsjds.blcu.edu.cn/',
  },
  wl_lanqiao: {
    editionLabel: '第十七届（2025-2026 赛季）', scheduleStatus: 'closed', status: '已结束',
    noticeTitle: '第十七届蓝桥杯大赛通知与报名入口', noticeUrl: 'https://dasai.lanqiao.cn/', registrationEnd: '2025-12-15',
  },
  wl_smart_car: {
    editionLabel: '第二十一届（2026）', scheduleStatus: 'partially_announced', status: '赛区赛阶段',
    noticeTitle: '第二十一届全国大学生智能汽车竞赛通知与规则', noticeUrl: 'http://www.smartcarrace.com/', sourceUrl: 'http://www.smartcarrace.com/', registrationEnd: '2026-06-20',
  },
  wl_mechanical_innovation: {
    editionLabel: '第十二届（2026）', scheduleStatus: 'closed', status: '已结束',
    noticeTitle: '第十二届全国大学生机械创新设计大赛', noticeUrl: 'https://12umic.hit.edu.cn/', sourceUrl: 'https://12umic.hit.edu.cn/',
  },
  wl_ad_design: {
    editionLabel: '第十八届（2026）', scheduleStatus: 'partially_announced', status: '评审阶段',
    noticeTitle: '第18届全国大学生广告艺术大赛', noticeUrl: 'http://www.sun-ada.net/',
  },
  wl_energy_saving: {
    editionLabel: '第十九届（2026）', scheduleStatus: 'partially_announced', status: '全国决赛阶段',
    noticeTitle: '第十九届全国大学生节能减排竞赛决赛通知', noticeUrl: 'https://www.jienengjianpai.org/sys-nd/417.html', noticePublishedAt: '2026-07-03', sourceUrl: 'https://www.jienengjianpai.org/',
  },
  wl_logistics_design: {
    editionLabel: '第九届（2025，参考届次）', scheduleStatus: 'not_announced', status: '2026 届尚未发布',
    currentEditionLabel: '2026 届尚未发布', referenceEditionLabel: '第九届（2025）',
    referenceNoticeUrl: 'http://dspt.clppx.org.cn/pkIndex/wlsj/wlsjdshome', dataFreshness: 'reference',
    scheduleNote: '该赛事通常两年举办一届；2026 未见新一届正式通知，当前内容参考 2025 年第九届规则。',
    noticeTitle: '第九届全国大学生物流设计大赛竞赛平台', noticeUrl: 'http://dspt.clppx.org.cn/pkIndex/wlsj/wlsjdshome', sourceUrl: 'http://dspt.clppx.org.cn/pkIndex/wlsj/wlsjdshome',
  },
  wl_robot_contest: {
    editionLabel: '2026 赛季', scheduleStatus: 'partially_announced', status: '分赛项进行中',
    noticeTitle: '全国大学生机器人大赛 2026 赛季', noticeUrl: 'https://www.curc.cn/', sourceUrl: 'https://www.curc.cn/',
  },
  wl_robot_ai: {
    editionLabel: '第二十八届（2026）', scheduleStatus: 'partially_announced', status: '赛区赛阶段',
    noticeTitle: '第二十八届中国机器人及人工智能大赛', noticeUrl: 'https://www.caairobot.com/', sourceUrl: 'https://www.caairobot.com/',
  },
  wl_c4_computer: {
    editionLabel: '2026 赛季（分赛道）', scheduleStatus: 'partially_announced', status: '分赛道进行中',
    noticeTitle: '中国高校计算机大赛各赛道通知', noticeUrl: 'http://www.c4best.cn/',
  },
  wl_structural_design: {
    editionLabel: '第十九届（2026）', scheduleStatus: 'announced', status: '全国总决赛准备阶段',
    noticeTitle: '第十九届全国大学生结构设计竞赛', noticeUrl: 'http://www.structurecontest.com/',
    competitionStart: '2026-10-14', competitionEnd: '2026-10-18',
  },
  wl_life_science: {
    editionLabel: '第十一届（2026）', scheduleStatus: 'closed', status: '已结束',
    noticeTitle: '第十一届全国大学生生命科学竞赛通知', noticeUrl: 'https://www.culsc.cn/',
  },
  wl_ecommerce: {
    editionLabel: '第十六届（2025-2026 赛季）', scheduleStatus: 'partially_announced', status: '全国赛阶段',
    noticeTitle: '第十六届全国大学生电子商务创新创意创业挑战赛', noticeUrl: 'https://www.3chuang.net/', sourceUrl: 'https://www.3chuang.net/',
    registrationStart: '2025-10-20', registrationEnd: '2025-12-31', competitionStart: '2026-03-11', competitionEnd: '2026-08-10',
  },
  wl_fltrp: {
    editionLabel: '2026“外研社·国才杯”', scheduleStatus: 'partially_announced', status: '校赛准备阶段',
    noticeTitle: '2026“外研社·国才杯”全国大学生外语能力大赛正式启动', noticeUrl: 'https://ucc.fltrp.com/c/2026-03-21/541241.shtml', noticePublishedAt: '2026-03-21',
  },
  wl_service_outsourcing: {
    editionLabel: '第十七届（2026）', scheduleStatus: 'partially_announced', status: '全国赛阶段',
    noticeTitle: '第十七届中国大学生服务外包创新创业大赛', noticeUrl: 'http://www.fwwb.org.cn/',
  },
  wl_statistics_modeling: {
    editionLabel: '第十二届（2026）', scheduleStatus: 'partially_announced', status: '国赛评审阶段',
    noticeTitle: '关于举办2026年（第十二届）全国大学生统计建模大赛的通知', noticeUrl: 'http://tjjmds.ai-learning.net/dstz/37119.jhtml',
  },
  wl_siemens_cimc: {
    editionLabel: '2026 赛季', scheduleStatus: 'partially_announced', status: '分赛区阶段',
    noticeTitle: '2026“西门子杯”中国智能制造挑战赛', noticeUrl: 'http://www.siemenscup-cimc.org.cn/',
  },
  wl_engineering_practice: {
    editionLabel: '2027 届（已启动）', scheduleStatus: 'partially_announced', status: '筹备与校内选拔',
    noticeTitle: '2027年中国大学生工程实践与创新能力大赛', noticeUrl: 'http://www.gcxl.edu.cn/', noticePublishedAt: '2026-06-17',
  },
  wl_software_cup: {
    editionLabel: '第十五届（2026）', scheduleStatus: 'partially_announced', status: '评审阶段',
    noticeTitle: '第十五届“中国软件杯”大学生软件设计大赛', noticeUrl: 'http://www.cnsoftbei.com/',
  },
  wl_market_research: {
    editionLabel: '第十六届（2025-2026 赛季）', scheduleStatus: 'closed', status: '已结束',
    noticeTitle: '关于“正大杯”第十六届全国大学生市场调查与分析大赛的通知', noticeUrl: 'http://www.china-cssc.org/show-568-1912-1.html', noticePublishedAt: '2025-09-27',
    competitionStart: '2025-09-27', competitionEnd: '2026-05-31',
  },
  wl_ic_innovation: {
    editionLabel: '第十届（2026）', scheduleStatus: 'partially_announced', status: '分赛区决赛阶段',
    noticeTitle: '关于举办2026年第十届全国大学生集成电路创新创业大赛的通知', noticeUrl: 'https://univ.ciciec.com/nd.jsp?id=1037&fromMid=1689', noticePublishedAt: '2026-01-26',
  },
  wl_future_designer: {
    editionLabel: '第十四届（2026）', scheduleStatus: 'partially_announced', status: '评审阶段',
    noticeTitle: '第十四届未来设计师·全国高校数字艺术设计大赛', noticeUrl: 'https://www.ncda.org.cn/',
  },
  wl_information_security: {
    editionLabel: '第十九届（2026）', scheduleStatus: 'partially_announced', status: '赛区赛阶段',
    noticeTitle: '第十九届全国大学生信息安全竞赛', noticeUrl: 'http://www.ciscn.cn/',
  },
  wl_iot_design: {
    editionLabel: '第十三届（2026）', scheduleStatus: 'partially_announced', status: '分赛区阶段',
    noticeTitle: '2026年全国大学生物联网设计竞赛命题', noticeUrl: 'https://iot.sjtu.edu.cn/show.aspx?flag=2&info_id=6067&info_lb=36',
    officialContact: 'iotcontests@sjtu.edu.cn',
  },
  wl_milan_design_week: {
    editionLabel: '第十届（2026）', scheduleStatus: 'closed', status: '评审与展示阶段',
    noticeTitle: '2026第十届米兰设计周中国高校设计学科师生优秀作品展', noticeUrl: 'https://www.milan-aap.org.cn/', registrationEnd: '2026-04-10',
  },
};

const exampleSchoolNames = ['浙江大学'];
const resources: PlatformResourceSeed[] = [
  {
    id: 'platform_competition_verification_checklist',
    title: '竞赛官方信息核验清单',
    category: '竞赛资料',
    filePath: 'content/resources/竞赛官方信息核验清单.md',
    description: '用于报名、材料准备和提交前核验的通用清单，由校园成长平台整理。',
    suitableFor: '准备参加校内选拔或国家级竞赛的同学',
    previewPoints: ['核对官网、资格和截止时间', '核对材料格式与提交回执', '记录最后核验人和版本'],
    relatedCompetitionIds: competitions.map((item) => item.id),
  },
  {
    id: 'platform_team_role_template',
    title: '竞赛组队分工模板',
    category: '组队协作',
    filePath: 'content/resources/竞赛组队分工模板.md',
    description: '包含成员职责、每周投入、交付和文件约定的轻量模板，由校园成长平台整理。',
    suitableFor: '已经组队或正在招募队员的团队',
    previewPoints: ['成员职责和每周投入', '周检查与风险记录', '最终文件和版本约定'],
    relatedCompetitionIds: competitions.map((item) => item.id),
  },
  {
    id: 'platform_pitch_review_checklist',
    title: '路演答辩检查清单',
    category: '答辩路演',
    filePath: 'content/resources/路演答辩检查清单.md',
    description: '覆盖内容、时间、设备和问答准备的检查清单，由校园成长平台整理。',
    suitableFor: '需要项目展示、路演或答辩的参赛团队',
    previewPoints: ['结论与证据对应', 'PPT、PDF 和视频备份', '六类常见问答准备'],
    relatedCompetitionIds: ['wl_china_innovation', 'wl_tiaozhanbei_business', 'wl_computer_design', 'wl_ad_design', 'wl_energy_saving', 'wl_logistics_design'],
  },
  {
    id: 'platform_mcm_2026_checklist',
    title: '2026 数学建模参赛检查清单',
    category: '数学建模',
    filePath: 'content/resources/2026数学建模参赛检查清单.md',
    description: '包含 2026 关键时间、三人组队、赛前准备和论文提交检查项，由校园成长平台根据竞赛官网整理。',
    suitableFor: '准备参加 2026 全国大学生数学建模竞赛的同学',
    previewPoints: ['报名截止与竞赛时间', '三人组队核验', '论文格式与提交回执'],
    relatedCompetitionIds: ['wl_mcm'],
  },
  {
    id: 'platform_software_delivery_checklist',
    title: '软件类竞赛作品交付清单',
    category: '作品提交',
    filePath: 'content/resources/软件类竞赛作品交付清单.md',
    description: '覆盖可运行版本、交付目录、演示和最终提交检查，由校园成长平台整理。',
    suitableFor: '参加软件、计算机、物联网或信息安全项目赛的团队',
    previewPoints: ['干净环境部署', '素材与密钥检查', '最终压缩包复核'],
    relatedCompetitionIds: ['wl_computer_design', 'wl_c4_computer', 'wl_software_cup', 'wl_information_security', 'wl_iot_design'],
  },
  {
    id: 'platform_team_contact_safety',
    title: '组队联系与信息安全清单',
    category: '组队协作',
    filePath: 'content/resources/组队联系与信息安全清单.md',
    description: '用于发布招募、初次联系和开始协作前的信息安全检查，由校园成长平台整理。',
    suitableFor: '正在发布组队或准备联系队友的同学',
    previewPoints: ['公开信息边界', '收费与账号风险', '作品和数据归属'],
    relatedCompetitionIds: competitions.map((item) => item.id),
  },
];

function normalizeDate(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function daysUntil(value: string | null) {
  if (!value) return 9999;
  const target = Date.parse(`${value}T00:00:00+08:00`);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  return Math.ceil((target - Date.parse(`${today}T00:00:00+08:00`)) / 86_400_000);
}

async function main() {
  if (!shouldApply) {
    console.log(JSON.stringify({ mode: 'dry-run', competitions: competitions.length, resources: resources.length, exampleTeams: exampleSchoolNames.length * teamExampleTemplates.length }, null, 2));
    return;
  }

  await import('../server/db.ts');
  const helpers: HelpersModule = await import('../server/helpers.ts');
  const { serverConfig } = await import('../server/config.ts');
  if (serverConfig.databaseProvider === 'postgres' && !productionConfirmed) {
    throw new Error('production_confirmation_required');
  }
  const { createResourceAsset } = await import('../server/storage-service.ts');
  const now = helpers.nowIso();

  helpers.run(
    `UPDATE competitions SET publish_status = 'draft', quality_status = 'pending_review', updated_at = @updatedAt
     WHERE content_scope = 'platform'`,
    { updatedAt: now },
  );

  for (const item of competitions) {
    const current = helpers.getOne<{ id: string }>('SELECT id FROM competitions WHERE id = @id', { id: item.id });
    if (!current) throw new Error(`competition_missing:${item.id}`);
    const evidence = competitionEvidence[item.id];
    if (!evidence) throw new Error(`competition_evidence_missing:${item.id}`);
    const deadline = normalizeDate(evidence.registrationEnd);
    const daysLeft = daysUntil(deadline);
    const teamSize = teamSizeOverrides[item.id] || item.teamSize;
    const tracks = item.tracks?.length ? item.tracks : trackOverrides[item.id] || [item.title];
    const sourceUrl = evidence.sourceUrl || item.sourceUrl;
    const dataFreshness = evidence.dataFreshness || (evidence.scheduleStatus === 'not_announced' ? 'rules_only' : 'current');
    const scheduleNote = evidence.scheduleNote
      || (evidence.scheduleStatus === 'closed'
        ? '当前展示最近完成届次的已核验规则。'
        : evidence.scheduleStatus === 'partially_announced'
          ? '当前届次已发布部分日程；尚未公开的字段暂不展示。'
          : evidence.scheduleStatus === 'announced'
            ? '当前届次日程已发布。'
            : '当前届次时间尚未发布，页面仅展示已核验的通用规则。');
    helpers.run(
      `UPDATE competitions SET
         title = @title, host = @host, target = @target, description = @description,
         status = @status, deadline = @deadline, days_left = @daysLeft,
         registration_start = @registrationStart, registration_end = @registrationEnd,
         competition_start = @competitionStart, competition_end = @competitionEnd,
         team_size = @teamSize, stages_json = @stagesJson,
         submission_materials_json = @submissionMaterialsJson,
         recommended_for_json = @recommendedForJson, action_hints_json = @actionHintsJson,
         awards = @awards, fee_description = @feeDescription, official_contact = @officialContact,
         source_url = @sourceUrl, last_verified_at = @lastVerifiedAt,
         edition_label = @editionLabel, current_edition_label = @currentEditionLabel,
         reference_edition_label = @referenceEditionLabel, reference_notice_url = @referenceNoticeUrl,
         schedule_note = @scheduleNote, data_freshness = @dataFreshness, schedule_status = @scheduleStatus,
         registration_method = @registrationMethod, tracks_json = @tracksJson,
         quality_status = 'verified', publish_status = 'published', updated_at = @updatedAt
      WHERE id = @id`,
      {
        id: item.id,
        title: item.title,
        host: item.host,
        target: item.target,
        description: item.description,
        teamSize,
        sourceUrl,
        status: evidence.status,
        deadline: deadline || '',
        daysLeft,
        registrationStart: normalizeDate(evidence.registrationStart),
        registrationEnd: normalizeDate(evidence.registrationEnd),
        competitionStart: normalizeDate(evidence.competitionStart),
        competitionEnd: normalizeDate(evidence.competitionEnd),
        stagesJson: JSON.stringify(item.stages),
        submissionMaterialsJson: JSON.stringify(item.submissionMaterials),
        recommendedForJson: JSON.stringify(item.recommendedFor),
        actionHintsJson: JSON.stringify(item.actionHints),
        awards: item.awards || null,
        feeDescription: item.feeDescription || null,
        officialContact: evidence.officialContact || item.officialContact || null,
        editionLabel: evidence.editionLabel,
        currentEditionLabel: evidence.currentEditionLabel || evidence.editionLabel,
        referenceEditionLabel: evidence.referenceEditionLabel || null,
        referenceNoticeUrl: evidence.referenceNoticeUrl || null,
        scheduleNote,
        dataFreshness,
        scheduleStatus: evidence.scheduleStatus,
        registrationMethod: item.registrationMethod || '通过学校竞赛管理部门或赛事报名系统完成报名和资格确认',
        tracksJson: JSON.stringify(tracks),
        lastVerifiedAt: verifiedAt,
        updatedAt: now,
      },
    );
    helpers.run(
      `INSERT INTO competition_notices (id, competition_id, title, published_at, source_url, file_type, storage_url, created_at)
       VALUES (@id, @competitionId, @title, @publishedAt, @sourceUrl, '网页', NULL, @createdAt)
       ON CONFLICT (id) DO UPDATE SET source_url = excluded.source_url, title = excluded.title, published_at = excluded.published_at`,
      {
        id: `notice_${item.id}_official`,
        competitionId: item.id,
        title: evidence.noticeTitle,
        publishedAt: normalizeDate(evidence.noticePublishedAt),
        sourceUrl: evidence.noticeUrl,
        createdAt: now,
      },
    );
  }

  const exampleExpiry = new Date(Date.now() + 45 * 86_400_000);
  const exampleExpiresAt = exampleExpiry.toISOString();
  const exampleDeadline = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(exampleExpiry);
  for (const schoolName of exampleSchoolNames) {
    const school = helpers.getOne<{ id: string }>('SELECT id FROM schools WHERE name = @schoolName', { schoolName });
    if (!school) throw new Error(`example_school_missing:${schoolName}`);
    for (const item of teamExampleTemplates) {
      const id = `example_team_${school.id}_${item.key}`;
      helpers.run(
        `INSERT INTO teams (
           id, school_id, content_scope, listing_type, title, comp_id, comp_name, status, target, full_description,
           current_count, max_count, missing_roles_json, deadline, author_user_id, author_name, author_mark,
           author_grade, author_major, school_limit, requirements_json, goal_tags_json, capabilities_json,
           collaboration_mode, weekly_commitment, contact_hint, contact_email, visibility_scope, is_example, example_expires_at,
           moderation_status, created_at, updated_at
         ) VALUES (
           @id, @schoolId, 'school', @listingType, @title, @competitionId, @competitionName, '招募中', @target, @fullDescription,
           @currentCount, @maxCount, @missingRolesJson, @deadline, NULL, '校园成长内测示例', '例',
           '', '平台示例', 1, @requirementsJson, @goalsJson, @capabilitiesJson,
           @collaborationMode, @weeklyCommitment, '内测示例不提供真实联系方式', NULL, 'cross_school', 1, @exampleExpiresAt,
           'approved', @createdAt, @updatedAt
         ) ON CONFLICT (id) DO UPDATE SET
           school_id = excluded.school_id, listing_type = excluded.listing_type, title = excluded.title,
           comp_id = excluded.comp_id, comp_name = excluded.comp_name, status = excluded.status,
           target = excluded.target, full_description = excluded.full_description,
           current_count = excluded.current_count, max_count = excluded.max_count,
           missing_roles_json = excluded.missing_roles_json, deadline = excluded.deadline,
           requirements_json = excluded.requirements_json, goal_tags_json = excluded.goal_tags_json,
           capabilities_json = excluded.capabilities_json, collaboration_mode = excluded.collaboration_mode,
           weekly_commitment = excluded.weekly_commitment,
           contact_hint = excluded.contact_hint, contact_email = NULL, visibility_scope = 'cross_school',
           is_example = 1, example_expires_at = excluded.example_expires_at,
           moderation_status = 'approved', updated_at = excluded.updated_at`,
        {
          id, schoolId: school.id, listingType: item.listingType, title: item.title,
          competitionId: item.competitionId, competitionName: item.competitionName,
          target: item.target, fullDescription: item.fullDescription,
          currentCount: item.currentCount, maxCount: item.maxCount,
          missingRolesJson: JSON.stringify(item.missingRoles), deadline: exampleDeadline,
          requirementsJson: JSON.stringify(item.requirements), goalsJson: JSON.stringify(item.goals),
          capabilitiesJson: JSON.stringify(item.capabilities), weeklyCommitment: item.weeklyCommitment,
          collaborationMode: item.collaborationMode,
          exampleExpiresAt, createdAt: now, updatedAt: now,
        },
      );
    }
  }
  helpers.run(
    `UPDATE teams SET status = '已结束', moderation_status = 'approved', updated_at = @updatedAt
     WHERE is_example = 1 AND example_expires_at IS NOT NULL AND example_expires_at < @updatedAt`,
    { updatedAt: now },
  );

  const systemUserId = 'system_platform_content';
  helpers.run(
    `INSERT INTO users (
       id, open_id, union_id, session_key, name, mark, avatar_url, school_id, school, major, grade, bio,
       focus_tags_json, points, checkin_streak, last_checkin_date, created_at, updated_at
     ) VALUES (
       @id, @openId, NULL, NULL, '校园成长内容组', '校', NULL, NULL, '平台', '内容运营', '',
       '用于记录平台原创资料文件的系统身份，不参与用户展示。', '[]', 0, 0, NULL, @createdAt, @updatedAt
     ) ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at`,
    { id: systemUserId, openId: 'system:platform-content', createdAt: now, updatedAt: now },
  );

  helpers.run(
    `UPDATE resources
     SET moderation_status = 'pending', review_note = '历史演示或无有效文件，已从用户端下线', updated_at = @updatedAt
     WHERE content_scope = 'platform' AND moderation_status = 'approved'
       AND id NOT IN (${resources.map((_, index) => `@resourceId${index}`).join(', ')})
       AND (file_asset_id IS NULL OR title LIKE '%测试%' OR source_url LIKE '%m.cahe.edu.cn/site/content/16010%')`,
    Object.fromEntries([
      ['updatedAt', now],
      ...resources.map((item, index) => [`resourceId${index}`, item.id]),
    ]),
  );

  for (const item of resources) {
    const existing = helpers.getOne<{ file_asset_id: string | null }>('SELECT file_asset_id FROM resources WHERE id = @id', { id: item.id });
    let assetId = existing?.file_asset_id || '';
    const absolutePath = resolve(item.filePath);
    const buffer = readFileSync(absolutePath);
    if (!assetId) {
      const asset = await createResourceAsset({
        userId: systemUserId,
        originalName: basename(absolutePath),
        contentType: 'text/markdown; charset=utf-8',
        buffer,
      });
      assetId = asset.assetId;
    }
    helpers.run(
      `INSERT INTO resources (
         id, school_id, content_scope, title, type, category, price, downloads, rating,
         author_name, author_mark, author_title, cover_label, cover_gradient, tags_json,
         description, size_label, suitable_for, preview_points_json, author_user_id,
         file_asset_id, source_url, moderation_status, review_note, created_at, updated_at
       ) VALUES (
         @id, NULL, 'platform', @title, '清单', @category, 0, 0, 5,
         '校园成长内容组', '校', '平台原创', '清单', '', @tagsJson,
         @description, @sizeLabel, @suitableFor, @previewPointsJson, @authorUserId,
         @fileAssetId, NULL, 'approved', '平台原创内容，人工发布', @createdAt, @updatedAt
       ) ON CONFLICT (id) DO UPDATE SET
         title = excluded.title, school_id = NULL, content_scope = 'platform',
         category = excluded.category, description = excluded.description,
         size_label = excluded.size_label, suitable_for = excluded.suitable_for,
         preview_points_json = excluded.preview_points_json, file_asset_id = excluded.file_asset_id,
         author_user_id = excluded.author_user_id, moderation_status = 'approved',
         review_note = excluded.review_note, updated_at = excluded.updated_at`,
      {
        id: item.id,
        title: item.title,
        category: item.category,
        description: item.description,
        suitableFor: item.suitableFor,
        tagsJson: JSON.stringify(['平台原创', '可下载', item.category]),
        sizeLabel: `${Math.max(1, Math.ceil(buffer.length / 1024))} KB`,
        previewPointsJson: JSON.stringify(item.previewPoints),
        authorUserId: systemUserId,
        fileAssetId: assetId,
        createdAt: now,
        updatedAt: now,
      },
    );
    helpers.run('DELETE FROM resource_competitions WHERE resource_id = @resourceId', { resourceId: item.id });
    for (const competitionId of item.relatedCompetitionIds) {
      helpers.run(
        `INSERT INTO resource_competitions (resource_id, competition_id)
         VALUES (@resourceId, @competitionId) ON CONFLICT (resource_id, competition_id) DO NOTHING`,
        { resourceId: item.id, competitionId },
      );
    }
  }

  helpers.run(
    `UPDATE home_feed_configs
     SET competition_ids_json = @competitionIdsJson, resource_ids_json = @resourceIdsJson,
         team_ids_json = CASE WHEN team_ids_json LIKE '%"t1"%' THEN '[]' ELSE team_ids_json END,
         updated_at = @updatedAt
     WHERE id = 'default' AND (
       (competition_ids_json = '[]' AND resource_ids_json = '[]')
       OR competition_ids_json LIKE '%"c1"%'
       OR resource_ids_json LIKE '%"r1"%'
     )`,
    {
      competitionIdsJson: JSON.stringify(['wl_mcm', 'wl_china_innovation']),
      resourceIdsJson: JSON.stringify(['platform_mcm_2026_checklist', 'platform_competition_verification_checklist']),
      updatedAt: now,
    },
  );

  console.log(JSON.stringify({ mode: 'applied', databaseProvider: serverConfig.databaseProvider, storageProvider: serverConfig.storageProvider, competitions: competitions.length, resources: resources.length, exampleTeams: exampleSchoolNames.length * teamExampleTemplates.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
