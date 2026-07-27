const legacyLabelMap: Record<string, string> = {
  '閹恒劏宕�': '推荐',
  '閺堚偓閻戯拷': '最热',
  '閸楀啿鐨㈤幋顏咁剾': '即将截止',
  '閺堚偓閺傦拷': '最新',
  '閸忋劑鍎�': '全部',
  '閸忓秷鍨�': '免费',
  '閸ヨ棄顔嶇痪锟�': '国家级',
  '閻胶楠�': '省级',
  '閺嶏紕楠�': '校级',
  '閸掓稒鏌婇崚娑楃瑹': '创新创业',
  '濡剝婢�': '模板',
  '鐠у嫭鏋￠崠锟�': '资料包',
  '閺€鑽ゆ殣': '攻略',
  '缂佸繘鐛欑敮锟�': '经验帖',
  '闂傤喚鐡�': '问答',
  '闁灝娼�': '避坑',
  '鏉╂柨娲栭崘娆愭嫹': '系统',
  '缁勯槦': '组队',
  '瀹℃牳': '审核',
  '璁㈠崟': '订单',
  '鎷涘嫙涓�': '招募中',
  '瀹℃牳涓�': '审核中',
  '宸叉弧鍛�': '已满员',
  '鎶ュ悕涓�': '报名中',
  '鎶ュ悕鏈紑濮�': '报名未开始',
  '鍗冲皢鎴': '即将截止',
  '宸叉埅姝�': '已截止',
  '宸插畬鎴�': '已完成',
  '寰呮敮浠�': '待支付',
  '閫€娆句腑': '退款中',
  '宸查€€娆�': '已退款',
  '璧勬簮': '资源',
};

function normalizeText(value?: string) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return legacyLabelMap[trimmed] ?? trimmed;
}

function textIncludes(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

export function displayText(value?: string, fallback = '--') {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

export function isLikelyCorruptText(value?: string | null) {
  const normalized = normalizeText(value ?? '');
  if (!normalized) {
    return false;
  }

  const compact = normalized.replace(/\s/g, '');
  return /^[?？]+$/.test(compact) || compact.includes('�');
}

export function displaySafeText(value?: string | null, fallback = '--') {
  if (isLikelyCorruptText(value)) {
    return '内容异常';
  }

  return displayText(value ?? '', fallback);
}

export function displayPublicText(value?: string | null, fallback = '') {
  return displaySafeText(value, fallback)
    .replace(/内测用户/g, '同学')
    .replace(/内测指南/g, '使用指南')
    .replace(/内测/g, '')
    .replace(/官方索引/g, '官方入口')
    .replace(/来源索引/g, '官网入口')
    .replace(/公开来源整理/g, '公开资料')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatCount(value: number) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  }

  return String(value);
}

export function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) {
    return '免费';
  }

  return Number.isInteger(price) ? `¥${price}` : `¥${price.toFixed(1)}`;
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDateLabel(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return displayText(value);
  }

  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function hasOpenCompetitionSchedule(deadline?: string, daysLeft?: number, scheduleStatus?: string) {
  if (scheduleStatus) return scheduleStatus === 'not_announced';
  const raw = normalizeText(deadline);
  return raw.includes('官网') || raw.includes('官方') || raw.includes('通知') || Number(daysLeft) >= 9000;
}

export function formatCompetitionDeadline(deadline?: string, daysLeft?: number, scheduleStatus?: string) {
  if (scheduleStatus === 'closed' && !parseDate(deadline)) return '本届报名已结束';
  if (scheduleStatus === 'partially_announced' && !parseDate(deadline)) return '赛程进行中';
  if (scheduleStatus === 'announced' && !parseDate(deadline)) return '赛程已发布';
  if (hasOpenCompetitionSchedule(deadline, daysLeft, scheduleStatus)) {
    return '本届时间待发布';
  }

  return `截止 ${formatDateLabel(deadline)}`;
}

export function formatCompetitionDaysLeft(deadline?: string, daysLeft?: number, scheduleStatus?: string) {
  if (scheduleStatus === 'closed') return '已结束';
  if (scheduleStatus === 'partially_announced' && !parseDate(deadline)) return '查看赛程';
  if (scheduleStatus === 'announced' && !parseDate(deadline)) return '查看赛程';
  if (hasOpenCompetitionSchedule(deadline, daysLeft, scheduleStatus)) {
    return '日程待发布';
  }

  if (Number(daysLeft) < 0) {
    return '报名已结束';
  }

  return `${Math.max(Number(daysLeft || 0), 0)} 天内`;
}

export function formatDateTimeLabel(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return displayText(value);
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatNotificationTime(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return displayText(value, '刚刚');
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return sameDay
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
    : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function displayCompetitionStatus(status?: string) {
  const raw = normalizeText(status);

  if (!raw) {
    return '状态待定';
  }
  if (textIncludes(raw, ['未开始'])) {
    return '报名未开始';
  }
  if (textIncludes(raw, ['即将截止'])) {
    return '即将截止';
  }
  if (textIncludes(raw, ['截止'])) {
    return '已截止';
  }
  if (textIncludes(raw, ['报名'])) {
    return '报名中';
  }

  return raw;
}

export function displayCompetitionLevel(level?: string) {
  return displayText(level, '竞赛');
}

export function displayResourceCategory(category?: string) {
  return displayText(category, '资源');
}

export function displayMessageCategory(category?: string) {
  return displayText(category, '系统');
}

export function displayPostCategory(category?: string) {
  return displayText(category, '经验帖');
}

export function displayTeamStatus(status?: string) {
  const raw = normalizeText(status);

  if (!raw) {
    return '招募中';
  }
  if (textIncludes(raw, ['审核'])) {
    return '审核中';
  }
  if (textIncludes(raw, ['满员'])) {
    return '已满员';
  }
  if (textIncludes(raw, ['招募'])) {
    return '招募中';
  }

  return raw;
}

export function displayOrderStatus(status?: string) {
  const raw = normalizeText(status);

  if (!raw) {
    return '处理中';
  }
  if (textIncludes(raw, ['支付'])) {
    return '待支付';
  }
  if (textIncludes(raw, ['退款中'])) {
    return '退款中';
  }
  if (textIncludes(raw, ['退款'])) {
    return '已退款';
  }
  if (textIncludes(raw, ['完成'])) {
    return '已完成';
  }

  return raw;
}

export function displayAdminStatus(status?: string) {
  const raw = normalizeText(status);

  if (raw === 'pending') {
    return '待处理';
  }
  if (raw === 'processing') {
    return '处理中';
  }
  if (raw === 'approved') {
    return '已通过';
  }
  if (raw === 'resolved') {
    return '已确认';
  }
  if (raw === 'rejected') {
    return '已驳回';
  }
  if (raw === 'draft') {
    return '草稿';
  }
  if (raw === 'published') {
    return '已发布';
  }
  if (raw === 'archived') {
    return '已归档';
  }

  return displaySafeText(raw, '待处理');
}

export function displayAdminTargetType(type?: string) {
  const raw = normalizeText(type);
  const map: Record<string, string> = {
    post: '帖子',
    comment: '评论',
    team: '组队',
    report: '举报',
    resource: '资源',
  };

  return map[raw] ?? displaySafeText(raw, '内容');
}

export function displayAdminTaskAction(action?: string) {
  const raw = normalizeText(action);
  const map: Record<string, string> = {
    post_publish_review: '帖子发布',
    comment_review: '评论审核',
    team_publish_review: '组队发布',
    report_review: '举报处理',
    resource_publish_review: '资源投稿',
  };

  return map[raw] ?? displaySafeText(raw, '审核任务');
}

export function displayPublishStatus(status?: string) {
  const raw = normalizeText(status);
  const map: Record<string, string> = {
    draft: '草稿',
    scheduled: '定时',
    online: '上线',
    offline: '下线',
  };

  return map[raw] ?? displaySafeText(raw, '未配置');
}

export function statusTone(status?: string) {
  const raw = normalizeText(status);

  if (textIncludes(raw, ['驳回', '拒绝', 'rejected'])) {
    return 'bg-slate-100 text-slate-600';
  }

  if (textIncludes(raw, ['退款中', '审核中', '待支付', '待审核', '即将截止', 'processing', 'pending', 'draft'])) {
    return 'bg-slate-100 text-slate-600';
  }

  if (textIncludes(raw, ['通过', '已完成', '招募中', '报名中', '已满员', 'approved', 'owned', 'published'])) {
    return 'bg-blue-50 text-blue-600';
  }

  return 'bg-slate-100 text-slate-600';
}
