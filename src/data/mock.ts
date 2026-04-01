export const competitions = [
  {
    id: "c1",
    title: "第十五届全国大学生数学竞赛",
    level: "国家级",
    target: "全日制本科",
    status: "报名中",
    deadline: "2026-04-15",
    daysLeft: 16,
    views: 12500,
    image: "https://picsum.photos/seed/math/400/200",
    tags: ["理科", "个人赛", "保研加分"],
    description: "全国大学生数学竞赛是一项面向本科生的全国性高水平学科竞赛，旨在激发大学生学习数学的兴趣，培养分析、解决问题的能力。",
  },
  {
    id: "c2",
    title: "2026“挑战杯”大学生创业计划竞赛",
    level: "国家级",
    target: "全日制在校生",
    status: "即将截止",
    deadline: "2026-04-05",
    daysLeft: 6,
    views: 34200,
    image: "https://picsum.photos/seed/startup/400/200",
    tags: ["创新创业", "团队赛", "高含金量"],
    description: "“挑战杯”中国大学生创业计划竞赛是由共青团中央、教育部、人力资源社会保障部、中国科协、全国学联和省级人民政府主办的一项具有导向性、示范性和群众性的全国竞赛活动。",
  },
  {
    id: "c3",
    title: "全国大学生英语竞赛 (NECCS)",
    level: "国家级",
    target: "全日制在校生",
    status: "报名中",
    deadline: "2026-05-10",
    daysLeft: 41,
    views: 8900,
    image: "https://picsum.photos/seed/english/400/200",
    tags: ["文科", "个人赛", "英语能力"],
    description: "全国大学生英语竞赛是经教育部有关部门批准举办的全国唯一的大学生英语综合能力竞赛活动。",
  }
];

export const resources = [
  {
    id: "r1",
    title: "【挑战杯】历年国奖优秀商业计划书合集 (共50份)",
    type: "PDF/Word",
    price: 0,
    downloads: 4520,
    rating: 4.9,
    author: { name: "学长带飞", avatar: "https://picsum.photos/seed/user1/100/100", title: "国奖得主" },
    image: "https://picsum.photos/seed/doc1/300/400",
    tags: ["挑战杯", "商分模板", "高分必看"],
    description: "精心整理的历届挑战杯国奖项目商业计划书，包含科技创新、乡村振兴、社会治理等多个赛道，适合初次参赛的同学参考框架和排版。",
  },
  {
    id: "r2",
    title: "Python数据分析速成笔记（含大创实战代码）",
    type: "Jupyter/PDF",
    price: 9.9,
    downloads: 1205,
    rating: 4.8,
    author: { name: "DataMaster", avatar: "https://picsum.photos/seed/user2/100/100", title: "数据分析师" },
    image: "https://picsum.photos/seed/doc2/300/400",
    tags: ["Python", "大创", "数据分析"],
    description: "从零基础到能跑通大创项目的数据分析全流程笔记，包含Pandas、Matplotlib核心用法及一份真实的大创项目源码。",
  }
];

export const teams = [
  {
    id: "t1",
    title: "大创国家级项目寻靠谱前端，已有后端和UI",
    compId: "c2",
    compName: "“挑战杯”创业计划竞赛",
    target: "开发一款校园二手交易小程序",
    current: 3,
    max: 4,
    missingRoles: ["前端开发", "PPT美化"],
    deadline: "2026-04-02",
    author: { name: "李同学", avatar: "https://picsum.photos/seed/user3/100/100", grade: "大三", major: "软件工程" },
    schoolLimit: true,
  },
  {
    id: "t2",
    title: "数学建模美赛找队友，目标M奖以上",
    compId: "c1",
    compName: "全国大学生数学竞赛",
    target: "冲刺美赛",
    current: 1,
    max: 3,
    missingRoles: ["编程手", "论文手"],
    deadline: "2026-04-10",
    author: { name: "王同学", avatar: "https://picsum.photos/seed/user4/100/100", grade: "大二", major: "应用数学" },
    schoolLimit: false,
  }
];

export const posts = [
  {
    id: "p1",
    title: "双非一本如何在大二拿到大创国推？我的三步走战略",
    content: "很多同学觉得大创很难，其实核心在于选题和团队执行力。今天给大家分享一下我是如何从零开始组建团队，并最终拿到国家级推荐的...",
    author: { name: "卷王之王", avatar: "https://picsum.photos/seed/user5/100/100" },
    likes: 342,
    comments: 56,
    tags: ["大创", "经验分享", "干货"],
    time: "2小时前",
  },
  {
    id: "p2",
    title: "避坑指南：找队友千万不要找这三种人！",
    content: "参加了四五次比赛，遇到过神仙队友，也遇到过奇葩。总结一下，找队友一定要避开这三种：1. 永远在潜水不回复的；2. 满嘴跑火车但不干活的...",
    author: { name: "比赛老油条", avatar: "https://picsum.photos/seed/user6/100/100" },
    likes: 890,
    comments: 124,
    tags: ["组队避坑", "吐槽"],
    time: "5小时前",
  }
];
