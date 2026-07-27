import { Bell, BookOpen, ChevronRight, Clock3, Trophy, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { SchoolVerificationNotice, hasVerifiedSchool } from '../components/SchoolVerificationNotice';
import { CompactSearchHeader } from '../components/CompactSearchHeader';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchHomeFeed } from '../lib/app-service';
import {
  displayCompetitionLevel,
  displayCompetitionStatus,
  displayResourceCategory,
  formatCompetitionDeadline,
} from '../lib/format';
import {
  buildCompetitionDetailRoute,
  buildResourceDetailRoute,
  buildTeamDetailRoute,
  routes,
} from '../lib/routes';
import type { HomeFeed } from '../../types/entities';

const fallbackHomeFeed: HomeFeed = {
  banners: [],
  quickLinks: [],
  urgentCompetitions: [],
  hotResources: [],
  latestTeams: [],
  featuredPosts: [],
};

const moduleStyles = {
  competition: {
    icon: 'bg-[#1769e0] text-white', shell: 'border-[#cfe0f8] bg-[#f4f8ff]',
    primary: 'border-[#d8e6fa] bg-white/72', action: 'text-[#1769e0]', eyebrow: '赛事日历',
  },
  resource: {
    icon: 'bg-[#008a63] text-white', shell: 'border-[#cbe7dc] bg-[#f1faf6]',
    primary: 'border-[#d4ebe2] bg-white/72', action: 'text-[#007a58]', eyebrow: '资料库',
  },
  team: {
    icon: 'bg-[#e88413] text-white', shell: 'border-[#f0dec6] bg-[#fff8ed]',
    primary: 'border-[#f1e2cc] bg-white/72', action: 'text-[#b75b00]', eyebrow: '组队大厅',
  },
} as const;

function HomeModule({
  title,
  actionTo,
  icon,
  tone,
  children,
}: {
  title: string;
  actionTo: string;
  icon: ReactNode;
  tone: keyof typeof moduleStyles;
  children: ReactNode;
}) {
  const style = moduleStyles[tone];
  return (
    <section className={`overflow-hidden rounded-lg border shadow-[0_12px_30px_rgba(29,45,72,0.075)] ${style.shell}`}>
      <div className="flex min-h-[4.7rem] items-center gap-3 px-4 py-3.5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-[0_6px_14px_rgba(29,45,72,0.12)] ${style.icon}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-[#7b8798]">{style.eyebrow}</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[18px] font-semibold leading-6 text-[#172033]">{title}</h2>
            <span className="text-xs font-semibold text-[#78869a]">精选</span>
          </div>
        </div>
        <Link
          to={actionTo}
          className={`inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-md px-1 text-sm font-semibold active:opacity-60 ${style.action}`}
        >
          全部
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className={`mx-3 mb-3 overflow-hidden rounded-lg border ${style.primary}`}>{children}</div>
    </section>
  );
}

function ModuleState({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return loading ? (
    <div className="space-y-2 px-4 py-4" aria-label="正在加载">
      <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200/75" />
      <div className="h-3 w-2/5 animate-pulse rounded bg-slate-200/60" />
    </div>
  ) : <div className="flex min-h-[4.75rem] items-center px-4 text-sm text-slate-500">{children}</div>;
}

export function Home() {
  const { loggedIn, user } = useSession();
  const { data, status, errorMessage, run } = useRequestState<HomeFeed>({
    initialData: fallbackHomeFeed,
    errorMessage: '首页加载失败，请重试。',
  });

  useEffect(() => {
    void run(fetchHomeFeed);
  }, [run]);

  const loading = status === 'loading' || status === 'idle';
  const failed = status === 'error';

  return (
    <div className="min-h-full bg-[#edf1f7] px-4 pb-8 pt-0">
      <CompactSearchHeader
        placeholder="搜索竞赛、资料、队伍"
        trailing={<Link to={routes.messages} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/90 bg-white/92 text-[#41506a] shadow-[0_7px_22px_rgba(29,45,72,0.09)] active:scale-[0.96]" aria-label="消息"><Bell size={20} strokeWidth={2.2} /></Link>}
      />

      {failed ? (
        <div className="mb-3 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50 px-3.5 text-sm text-rose-700" role="alert">
          <span className="min-w-0 truncate">{errorMessage}</span>
          <button type="button" className="min-h-11 shrink-0 font-semibold" onClick={() => void run(fetchHomeFeed, { forceRefresh: true })}>
            重试
          </button>
        </div>
      ) : null}

      <main className="space-y-3.5">
        <HomeModule
          title="竞赛"
          actionTo={routes.competitions}
          tone="competition"
          icon={<Trophy size={21} strokeWidth={2.2} />}
        >
          {loading ? <ModuleState loading>正在加载竞赛</ModuleState> : null}
          {!loading && data.urgentCompetitions.length === 0 ? <ModuleState>暂无可展示的竞赛</ModuleState> : null}
          {!loading
            ? data.urgentCompetitions.slice(0, 2).map((item, index) => (
                <Link key={item.id} to={buildCompetitionDetailRoute(item.id)} className={`flex items-center gap-3 px-4 ${index === 0 ? 'min-h-[6.25rem] py-4' : 'min-h-[4.5rem] border-t border-[#d8e6fa] py-3'} active:bg-[#e8f1ff]`}>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold">
                      <span className="text-[#1769e0]">{displayCompetitionStatus(item.status)}</span>
                      <span className="truncate text-slate-400">{item.category} · {displayCompetitionLevel(item.level)}</span>
                    </div>
                    <h3 className={`${index === 0 ? 'line-clamp-2 text-[17px]' : 'line-clamp-1 text-[15px]'} font-semibold leading-6 text-slate-950`}>{item.title}</h3>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 size={13} aria-hidden="true" />
                      {formatCompetitionDeadline(item.deadline, item.daysLeft, item.scheduleStatus)}
                    </div>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-slate-300" aria-hidden="true" />
                </Link>
              ))
            : null}
        </HomeModule>

        <HomeModule
          title="资源"
          actionTo={routes.resources}
          tone="resource"
          icon={<BookOpen size={21} strokeWidth={2.2} />}
        >
          {loading ? <ModuleState loading>正在加载资源</ModuleState> : null}
          {!loading && data.hotResources.length === 0 ? <ModuleState>暂无可领取的资源</ModuleState> : null}
          {!loading
            ? data.hotResources.slice(0, 2).map((item, index) => (
                <Link key={item.id} to={buildResourceDetailRoute(item.id)} className={`flex items-center gap-3 px-4 ${index === 0 ? 'min-h-[5.75rem] py-4' : 'min-h-[4.5rem] border-t border-[#d4ebe2] py-3'} active:bg-[#e5f6ef]`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#dff4eb] text-xs font-semibold text-[#007a58]">
                    {item.type.split('/')[0].trim().slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-[15px] font-semibold leading-6 text-slate-950">{item.title}</h3>
                    <p className="truncate text-xs text-slate-500">{displayResourceCategory(item.category)} · {item.file ? item.sizeLabel : '官方来源'}</p>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-slate-300" aria-hidden="true" />
                </Link>
              ))
            : null}
        </HomeModule>

        <HomeModule
          title="组队"
          actionTo={routes.teams}
          tone="team"
          icon={<Users size={21} strokeWidth={2.2} />}
        >
          {loading ? <ModuleState loading>正在加载组队</ModuleState> : null}
          {!loading && data.latestTeams.length === 0 ? <ModuleState>暂无公开组队</ModuleState> : null}
          {!loading
            ? data.latestTeams.slice(0, 2).map((item, index) => (
                <Link key={item.id} to={buildTeamDetailRoute(item.id)} className={`flex items-center gap-3 px-4 ${index === 0 ? 'min-h-[6rem] py-4' : 'min-h-[4.5rem] border-t border-[#f1e2cc] py-3'} active:bg-[#fff0d8]`}>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-amber-700">
                      <span>{item.listingType === 'member_available' ? '求加入' : '招募中'}</span>
                      <span className="truncate text-slate-400">{item.compName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className={`${index === 0 ? 'line-clamp-2 text-[17px]' : 'line-clamp-1 text-[15px]'} min-w-0 flex-1 font-semibold leading-6 text-slate-950`}>{item.title}</h3>
                      {item.isExample ? <span className="shrink-0 rounded-md bg-white/70 px-2 py-1 text-[10px] font-semibold text-amber-700">内测示例</span> : null}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {item.listingType === 'member_available'
                        ? item.weeklyCommitment || '时间可沟通'
                        : `${item.current}/${item.max} 人 · ${item.missingRoles.slice(0, 2).join('、') || '角色可沟通'}`}
                    </p>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-slate-300" aria-hidden="true" />
                </Link>
              ))
            : null}
        </HomeModule>
      </main>

      {loggedIn && !hasVerifiedSchool(user) ? (
        <div className="mt-3">
          <SchoolVerificationNotice compact />
        </div>
      ) : null}
    </div>
  );
}
