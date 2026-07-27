import {
  BadgeCheck,
  Bookmark,
  CalendarCheck,
  ChevronRight,
  Clock3,
  FolderUp,
  LogOut,
  MessageSquare,
  PenSquare,
  School,
  Trophy,
  UserRoundPen,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../hooks/useSession';
import { getAvatarAlt, getAvatarLabel } from '../lib/avatar';
import { logout } from '../lib/app-service';
import { getVisibleProfileText } from '../lib/profile-completion';
import { buildLoginRoute, routes } from '../lib/routes';

interface ProfileRowItem {
  label: string;
  to: string;
  icon: typeof Bookmark;
  meta?: string;
}

function ProfileRowGroup({ title, items }: { title?: string; items: ProfileRowItem[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {title ? <div className="px-4 pb-1 pt-3 text-[12px] font-medium text-slate-500">{title}</div> : null}
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="flex min-h-[54px] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <item.icon size={18} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-slate-900">{item.label}</div>
              {item.meta ? <div className="mt-0.5 truncate text-xs text-slate-500">{item.meta}</div> : null}
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { user, loggedIn } = useSession();

  if (!loggedIn || !user) {
    return (
      <div className="min-h-full bg-[#f5f7fb] pb-10">
        <div className="px-5 pb-2 pt-8">
          <h1 className="text-[1.65rem] font-semibold text-slate-950">我的</h1>
        </div>

        <div className="px-5 pt-3">
          <section className="rounded-lg border border-slate-200 bg-white px-4 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl font-semibold text-slate-700">
                校
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-semibold text-slate-950">请先登录</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(buildLoginRoute(routes.profile))}
              className="mt-5 inline-flex min-h-11 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            >
              立即登录
            </button>
          </section>
        </div>
      </div>
    );
  }

  const visibleSchool = getVisibleProfileText(user.school);
  const visibleGrade = getVisibleProfileText(user.grade);
  const profileMeta = [visibleSchool, visibleGrade].filter(Boolean).join(' · ') || '未选择学校';
  const certificationLabel =
    user.schoolCertificationStatus === 'verified'
      ? '已认证'
      : user.schoolCertificationStatus === 'pending'
        ? '待完成'
        : '未认证';

  const accountItems: ProfileRowItem[] = [
    { icon: UserRoundPen, label: '个人信息', to: routes.accountSettings },
    { icon: CalendarCheck, label: '签到', to: routes.checkin, meta: `${user.stats.points} 积分 · 连续 ${user.stats.checkinStreak} 天` },
    { icon: Bookmark, label: '我的收藏', to: routes.favorites, meta: `${user.stats.favorites} 条` },
    { icon: FolderUp, label: '已获资源', to: routes.myResources, meta: `${user.stats.resources} 份` },
  ];

  const contentItems: ProfileRowItem[] = [
    { icon: Users, label: '我的组队', to: `${routes.teams}?mine=true` },
    { icon: PenSquare, label: '发帖', to: routes.publishPost },
    { icon: FolderUp, label: '资源投稿', to: routes.publishResource },
    { icon: MessageSquare, label: '投稿记录', to: routes.resourceSubmissions },
  ];

  const settingItems: ProfileRowItem[] = [
    { icon: School, label: '切换学校', to: routes.schools, meta: visibleSchool || '未选择' },
    { icon: BadgeCheck, label: '学校认证', to: routes.schoolVerify, meta: certificationLabel },
    { icon: Trophy, label: '我的动态', to: routes.myActivity },
    { icon: Clock3, label: '浏览历史', to: routes.history },
  ];

  return (
    <div className="min-h-full bg-[#f5f7fb] pb-10">
      <div className="px-5 pb-2 pt-8">
        <h1 className="text-[1.65rem] font-semibold text-slate-950">我的</h1>
      </div>

      <section className="mt-3 border-y border-slate-200 bg-white px-5 py-5">
        <Link to={routes.accountSettings} className="flex items-center gap-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={getAvatarAlt(user)} width={64} height={64} className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-2xl font-semibold text-white">
              {getAvatarLabel(user.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-semibold text-slate-950">{user.name}</div>
            <div className="mt-1 truncate text-sm font-medium text-slate-500">{profileMeta}</div>
            <div className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {certificationLabel}
            </div>
          </div>
          <ChevronRight size={17} className="text-slate-300" aria-hidden="true" />
        </Link>
      </section>

      <section className="mt-4 grid grid-cols-4 border-y border-slate-200 bg-white px-4 py-4">
        {[
          { label: '收藏', value: user.stats.favorites },
          { label: '消息', value: user.stats.unreadMessages },
          { label: '组队', value: user.stats.teams },
          { label: '积分', value: user.stats.points },
        ].map((stat) => (
          <div key={stat.label} className="min-w-0 text-center">
            <div className="truncate text-xl font-semibold tabular-nums text-slate-900">{stat.value}</div>
            <div className="mt-1 text-[11px] font-medium text-slate-500">{stat.label}</div>
          </div>
        ))}
      </section>

      <div className="space-y-4 px-5 pt-5">
        <ProfileRowGroup items={accountItems} />
        <ProfileRowGroup title="发布" items={contentItems} />
        <ProfileRowGroup title="设置" items={settingItems} />

        <button
          type="button"
          onClick={() => {
            logout();
            navigate(routes.home);
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-rose-600 transition-colors active:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          <LogOut size={16} aria-hidden="true" />
          退出登录
        </button>
      </div>
    </div>
  );
}
