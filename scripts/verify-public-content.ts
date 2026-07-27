const apiBase = (process.env.PUBLIC_API_BASE || 'http://127.0.0.1:8080/api').replace(/\/$/, '');

const competitionIds = [
  'wl_china_innovation',
  'wl_tiaozhanbei_research',
  'wl_tiaozhanbei_business',
  'wl_mcm',
  'wl_nuedc',
  'wl_computer_design',
  'wl_lanqiao',
  'wl_smart_car',
  'wl_mechanical_innovation',
  'wl_ad_design',
  'wl_energy_saving',
  'wl_logistics_design',
  'wl_robot_contest',
  'wl_robot_ai',
  'wl_c4_computer',
  'wl_structural_design',
  'wl_life_science',
  'wl_ecommerce',
  'wl_fltrp',
  'wl_service_outsourcing',
  'wl_statistics_modeling',
  'wl_siemens_cimc',
  'wl_engineering_practice',
  'wl_software_cup',
  'wl_market_research',
  'wl_ic_innovation',
  'wl_future_designer',
  'wl_information_security',
  'wl_iot_design',
  'wl_milan_design_week',
];

const resourceIds = [
  'platform_competition_verification_checklist',
  'platform_team_role_template',
  'platform_pitch_review_checklist',
  'platform_mcm_2026_checklist',
  'platform_software_delivery_checklist',
  'platform_team_contact_safety',
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T>(path: string) {
  const response = await fetch(`${apiBase}${path}`);
  const payload = await response.json() as { code: number; message: string; data: T };
  assert(response.ok && payload.code === 0, `${path}: ${response.status} ${payload.message}`);
  return payload.data;
}

const incomplete: string[] = [];
const publicCompetitions = await request<Array<{ id: string; scheduleStatus?: string }>>('/competitions?limit=200');
assert(publicCompetitions.length === 30, `expected 30 public competitions, received ${publicCompetitions.length}`);
assert(competitionIds.every((id) => publicCompetitions.some((item) => item.id === id)), 'public competition allowlist mismatch');
assert(publicCompetitions.slice(0, 5).every((item) => item.scheduleStatus !== 'closed'), 'recommended list starts with closed competitions');
const forbiddenTemplate = /关注官网|见官网|以官网通知为准|当届通知暂未公布|以赛事官网和学校通知为准/;
for (const id of competitionIds) {
  const item = await request<{
    id: string;
    teamSize?: string;
    stages?: string[];
    submissionMaterials?: string[];
    sourceUrl?: string;
    lastVerifiedAt?: string;
    editionLabel?: string;
    scheduleStatus?: string;
    registrationMethod?: string;
    tracks?: string[];
    qualityStatus?: string;
    status?: string;
    deadline?: string;
    awards?: string;
    feeDescription?: string;
    registrationStart?: string;
    registrationEnd?: string;
    competitionStart?: string;
    competitionEnd?: string;
    notices?: Array<{ title: string; sourceUrl: string; publishedAt?: string }>;
    currentEditionLabel?: string;
    referenceEditionLabel?: string;
    referenceNoticeUrl?: string;
    scheduleNote?: string;
    dataFreshness?: string;
  }>(`/competitions/${id}`);
  const hasKnownDate = [item.registrationStart, item.registrationEnd, item.competitionStart, item.competitionEnd]
    .some((value) => /^\d{4}-\d{2}-\d{2}$/.test(value || ''));
  if (
    !item.teamSize ||
    (item.stages?.length || 0) < 3 ||
    (item.submissionMaterials?.length || 0) < 3 ||
    !item.sourceUrl?.startsWith('http') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(item.lastVerifiedAt || '') ||
    !item.editionLabel ||
    /长期规则信息|届次待核验/.test(item.editionLabel) ||
    !['announced', 'partially_announced', 'not_announced', 'closed'].includes(item.scheduleStatus || '') ||
    !['current', 'reference', 'rules_only'].includes(item.dataFreshness || '') ||
    !item.currentEditionLabel ||
    !item.scheduleNote ||
    (item.dataFreshness === 'reference' && (!item.referenceEditionLabel || !item.referenceNoticeUrl)) ||
    (item.scheduleStatus === 'announced' && !hasKnownDate) ||
    !item.registrationMethod ||
    (item.tracks?.length || 0) < 1 ||
    item.qualityStatus !== 'verified' ||
    !item.notices?.length ||
    item.notices.some((notice) => !notice.title || !notice.sourceUrl?.startsWith('http')) ||
    item.sourceUrl?.includes('m.cahe.edu.cn/site/content/16010') ||
    forbiddenTemplate.test([item.status, item.deadline, item.teamSize, item.awards, item.feeDescription].join(' '))
  ) {
    incomplete.push(id);
  }
}

const mcm = await request<{
  editionLabel: string;
  registrationEnd?: string;
  competitionStart?: string;
  competitionEnd?: string;
  officialContact?: string;
}>('/competitions/wl_mcm');
assert(mcm.editionLabel.includes('2026'), 'mcm edition is not current');
assert(mcm.registrationEnd === '2026-09-07', 'mcm registration deadline mismatch');
assert(mcm.competitionStart === '2026-09-10' && mcm.competitionEnd === '2026-09-13', 'mcm competition dates mismatch');
assert(mcm.officialContact?.includes('cumcm@csiam.org.cn'), 'mcm official contact missing');

const logistics = await request<{
  currentEditionLabel?: string;
  referenceEditionLabel?: string;
  referenceNoticeUrl?: string;
  dataFreshness?: string;
  scheduleNote?: string;
}>('/competitions/wl_logistics_design');
assert(logistics.currentEditionLabel?.includes('2026') && logistics.currentEditionLabel.includes('尚未发布'), 'logistics current edition state missing');
assert(logistics.referenceEditionLabel?.includes('第九届') && logistics.referenceEditionLabel.includes('2025'), 'logistics reference edition mismatch');
assert(logistics.referenceNoticeUrl?.startsWith('http') && logistics.dataFreshness === 'reference', 'logistics reference provenance missing');

for (const id of resourceIds) {
  const item = await request<{ id: string; price: number; contentScope: string; moderationStatus?: string; file?: { sizeBytes: number; contentType: string } }>(`/resources/${id}`);
  if (item.price !== 0 || item.contentScope !== 'platform' || !item.file?.sizeBytes || !item.file.contentType.startsWith('text/markdown')) incomplete.push(id);
}

assert(incomplete.length === 0, `public content incomplete: ${incomplete.join(', ')}`);
console.log(JSON.stringify({ apiBase, competitions: competitionIds.length, resources: resourceIds.length, incomplete: 0 }, null, 2));
