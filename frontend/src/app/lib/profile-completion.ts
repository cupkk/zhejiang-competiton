import type { UserProfile } from '../../types/entities';

export type ProfileCompletionField = 'name' | 'school' | 'grade' | 'major' | 'bio' | 'focusTags';

export const profileFieldLabels: Record<ProfileCompletionField, string> = {
  name: '昵称',
  school: '学校',
  grade: '年级',
  major: '专业',
  bio: '个人简介',
  focusTags: '关注方向',
};

function normalize(value?: string) {
  return value?.trim() ?? '';
}

export function isPlaceholderProfileText(value?: string) {
  const text = normalize(value);
  if (!text) {
    return true;
  }

  if (text.startsWith('微信用户') || text.startsWith('寰俊鐢ㄦ埛')) {
    return true;
  }

  if (text.startsWith('待补充') || text.startsWith('寰呰ˉ鍏')) {
    return true;
  }

  return false;
}

function isPlaceholderBio(value?: string) {
  const text = normalize(value);
  if (!text) {
    return true;
  }

  return (
    text === '完成竞赛、资源和组队信息后，这里会逐步沉淀你的校园成长轨迹。' ||
    text === '瀹屾垚绔炶禌銆佽祫婧愬拰缁勯槦淇℃伅鍚庯紝杩欓噷浼氶€愭娌夋穩浣犵殑鏍″洯鎴愰暱杞ㄨ抗銆�'
  );
}

function isMissingTags(tags: string[] = []) {
  return tags.map((item) => item.trim()).filter(Boolean).length === 0;
}

export function getProfileCompletionMissingFields(user: UserProfile | null): ProfileCompletionField[] {
  if (!user) {
    return ['name', 'school', 'grade', 'major', 'bio', 'focusTags'];
  }

  const missing: ProfileCompletionField[] = [];

  if (isPlaceholderProfileText(user.name)) {
    missing.push('name');
  }
  if (isPlaceholderProfileText(user.school)) {
    missing.push('school');
  }
  if (isPlaceholderProfileText(user.grade)) {
    missing.push('grade');
  }
  if (isPlaceholderProfileText(user.major)) {
    missing.push('major');
  }
  if (isPlaceholderBio(user.bio)) {
    missing.push('bio');
  }
  if (isMissingTags(user.focusTags)) {
    missing.push('focusTags');
  }

  return missing;
}

export function isProfileComplete(user: UserProfile | null) {
  return getProfileCompletionMissingFields(user).length === 0;
}

export function isBasicIdentityReady(user: UserProfile | null) {
  return Boolean(user && !isPlaceholderProfileText(user.name));
}

export function isSchoolSelected(user: UserProfile | null) {
  return Boolean(user && !isPlaceholderProfileText(user.school));
}

export function getVisibleProfileText(value?: string) {
  return isPlaceholderProfileText(value) ? '' : normalize(value);
}

export function getProfileCompletionHint(user: UserProfile | null) {
  const missing = getProfileCompletionMissingFields(user);
  if (missing.length === 0) {
    return '资料已完整。';
  }

  return `还需补充：${missing.map((field) => profileFieldLabels[field]).join('、')}`;
}
