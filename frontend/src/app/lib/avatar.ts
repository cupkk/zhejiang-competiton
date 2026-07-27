import type { UserProfile } from '../../types/entities';

export function getAvatarLabel(name?: string) {
  const text = name?.trim();
  if (!text) {
    return '校';
  }

  return Array.from(text)[0] || '校';
}

export function getAvatarAlt(user?: Pick<UserProfile, 'name'> | null) {
  return user?.name ? `${user.name}的头像` : '用户头像';
}
