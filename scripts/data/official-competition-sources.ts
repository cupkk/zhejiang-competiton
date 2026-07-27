export interface OfficialCompetitionSource {
  competitionId: string;
  sourceUrl: string;
  sourceKind: 'official_html' | 'official_portal' | 'official_pdf';
  expectedKeywords: string[];
}

export const officialCompetitionSources: OfficialCompetitionSource[] = [
  ['wl_china_innovation', 'https://cy.ncss.cn/', 'official_portal', ['中国国际大学生创新大赛']],
  ['wl_tiaozhanbei_research', 'https://www.tiaozhanbei.net/', 'official_portal', ['挑战杯']],
  ['wl_tiaozhanbei_business', 'https://www.tiaozhanbei.net/article/15842/', 'official_html', ['第十五届', '创业计划竞赛']],
  ['wl_mcm', 'http://www.mcm.edu.cn/', 'official_html', ['2026', '数学建模竞赛']],
  ['wl_nuedc', 'https://www.nuedc-training.com.cn/index/publicity/topic2026', 'official_portal', ['2026', '电子设计竞赛']],
  ['wl_computer_design', 'https://jsjds.blcu.edu.cn/', 'official_html', ['第19届', '计算机设计大赛']],
  ['wl_lanqiao', 'https://dasai.lanqiao.cn/', 'official_portal', ['蓝桥杯']],
  ['wl_smart_car', 'http://www.smartcarrace.com/', 'official_html', ['第二十一届', '智能汽车竞赛']],
  ['wl_mechanical_innovation', 'https://12umic.hit.edu.cn/', 'official_html', ['第十二届', '机械创新设计大赛']],
  ['wl_ad_design', 'http://www.sun-ada.net/', 'official_html', ['第18届', '广告艺术大赛']],
  ['wl_energy_saving', 'https://www.jienengjianpai.org/', 'official_html', ['第十九届', '节能减排']],
  ['wl_logistics_design', 'http://dspt.clppx.org.cn/pkIndex/wlsj/wlsjdshome', 'official_portal', ['第九届', '物流设计大赛']],
  ['wl_robot_contest', 'https://www.curc.cn/', 'official_portal', ['全国大学生机器人大赛']],
  ['wl_robot_ai', 'https://www.caairobot.com/', 'official_html', ['第二十八届', '机器人及人工智能大赛']],
  ['wl_c4_computer', 'https://www.c4best.cn/', 'official_portal', ['中国高校计算机大赛']],
  ['wl_structural_design', 'http://www.structurecontest.com/', 'official_portal', ['结构设计竞赛']],
  ['wl_life_science', 'https://www.culsc.cn/', 'official_portal', ['第十一届', '生命科学竞赛']],
  ['wl_ecommerce', 'https://www.3chuang.net/', 'official_portal', ['第十六届', '三创赛']],
  ['wl_fltrp', 'https://ucc.fltrp.com/', 'official_html', ['2026', '外语能力大赛']],
  ['wl_service_outsourcing', 'http://www.fwwb.org.cn/', 'official_html', ['第十七届', '服务外包']],
  ['wl_statistics_modeling', 'http://tjjmds.ai-learning.net/dstz/37119.jhtml', 'official_html', ['第十二届', '统计建模']],
  ['wl_siemens_cimc', 'http://www.siemenscup-cimc.org.cn/competition/index', 'official_html', ['2026', '西门子杯']],
  ['wl_engineering_practice', 'http://www.gcxl.edu.cn/', 'official_html', ['2027', '工程实践']],
  ['wl_software_cup', 'http://www.cnsoftbei.com/', 'official_html', ['第十五届', '中国软件杯']],
  ['wl_market_research', 'http://www.china-cssc.org/show-568-1912-1.html', 'official_html', ['第十六届', '市场调查与分析大赛']],
  ['wl_ic_innovation', 'https://univ.ciciec.com/nd.jsp?id=1037&fromMid=1689', 'official_html', ['第十届', '集创赛']],
  ['wl_future_designer', 'https://www.ncda.org.cn/', 'official_html', ['第14届', '未来设计师']],
  ['wl_information_security', 'http://www.ciscn.cn/', 'official_html', ['第十九届', '信息安全竞赛']],
  ['wl_iot_design', 'https://iot.sjtu.edu.cn/show.aspx?flag=2&info_id=6067&info_lb=36', 'official_html', ['2026', '物联网设计竞赛']],
  ['wl_milan_design_week', 'https://www.milan-aap.org.cn/', 'official_html', ['第十届', '米兰设计周']],
].map(([competitionId, sourceUrl, sourceKind, expectedKeywords]) => ({
  competitionId: String(competitionId),
  sourceUrl: String(sourceUrl),
  sourceKind: sourceKind as OfficialCompetitionSource['sourceKind'],
  expectedKeywords: expectedKeywords as string[],
}));
