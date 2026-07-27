import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { TeamQuery } from '../../types/api';
import type { TeamItem, TeamListingType } from '../../types/entities';
import { StateCard } from '../components/StateCard';
import { CompactSearchHeader } from '../components/CompactSearchHeader';
import { hasVerifiedSchool, SchoolVerificationNotice } from '../components/SchoolVerificationNotice';
import { TeamCard } from '../components/TeamCard';
import { floatingCreateButtonClass } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchTeamList } from '../lib/app-service';
import { dataCacheKeys, writeCachedData } from '../lib/query-cache';
import { buildPublishTeamRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';
import { teamShowcaseMode } from '../lib/commercial-config';

type TeamViewMode = TeamListingType | 'mine';
type TeamSchoolScope = 'all' | 'current' | 'other';

const viewOptions: Array<{ value: TeamViewMode; label: string }> = [
  { value: 'team_recruit', label: '找队伍' },
  { value: 'member_available', label: '求加入' },
  { value: 'mine', label: '我的发布' },
];
const schoolScopeOptions: Array<{ value: TeamSchoolScope; label: string }> = [
  { value: 'all', label: '全部高校' },
  { value: 'current', label: '本校' },
  { value: 'other', label: '其他学校' },
];

export function Teams() {
  const navigate = useNavigate();
  const { loggedIn, user } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';
  const mineOnly = searchParams.get('mine') === 'true';
  const listingType: TeamListingType = searchParams.get('type') === 'member_available' ? 'member_available' : 'team_recruit';
  const schoolScopeParam = searchParams.get('schoolScope');
  const schoolScope: TeamSchoolScope = schoolScopeParam === 'current' || schoolScopeParam === 'other' ? schoolScopeParam : 'all';
  const viewMode: TeamViewMode = mineOnly ? 'mine' : listingType;
  const query: TeamQuery = {
    keyword,
    listingType: mineOnly ? undefined : listingType,
    mineOnly,
    showcase: teamShowcaseMode && !mineOnly,
    schoolScope: mineOnly ? undefined : schoolScope,
  };
  const cacheKey = dataCacheKeys.teamsList({
    keyword,
    listingType: query.listingType,
    mineOnly,
    showcase: query.showcase,
    schoolScope: query.schoolScope,
  });
  const { data, status, errorMessage, run } = useRequestState<TeamItem[]>({
    initialData: () => [],
    errorMessage: '组队列表加载失败，请稍后重试。',
    cacheKey,
  });

  function loadTeams() {
    return fetchTeamList(query).then((items) => {
      items.forEach((item) => writeCachedData(dataCacheKeys.teamDetail(item.id), item));
      return items;
    });
  }

  useEffect(() => {
    void run(loadTeams);
  }, [keyword, listingType, mineOnly, run]);

  function updateKeyword(nextKeyword: string) {
    const params = new URLSearchParams(searchParams);
    nextKeyword ? params.set('keyword', nextKeyword) : params.delete('keyword');
    setSearchParams(params, { replace: true });
  }

  async function ensureLoggedIn(nextPath: string) {
    await startQuickLogin({
      navigate,
      nextPath,
      onStart: () => setLoggingIn(true),
      onComplete: () => setLoggingIn(false),
    });
  }

  function selectView(next: TeamViewMode) {
    if (next === 'mine' && !loggedIn) {
      void ensureLoggedIn('/teams?mine=true');
      return;
    }

    const params = new URLSearchParams(searchParams);
    if (next === 'mine') {
      params.set('mine', 'true');
    } else {
      params.delete('mine');
      next === 'member_available' ? params.set('type', next) : params.delete('type');
    }
    setSearchParams(params, { replace: true });
  }

  function selectSchoolScope(next: TeamSchoolScope) {
    if (next !== 'all' && !loggedIn) {
      void ensureLoggedIn(`/teams?schoolScope=${next}`);
      return;
    }
    if (next !== 'all' && !user?.schoolId) {
      navigate(routes.schools);
      return;
    }
    const params = new URLSearchParams(searchParams);
    next === 'all' ? params.delete('schoolScope') : params.set('schoolScope', next);
    setSearchParams(params, { replace: true });
  }

  const publishType: TeamListingType = viewMode === 'member_available' ? 'member_available' : 'team_recruit';
  const publishRoute = buildPublishTeamRoute({ type: publishType });
  const emptyTitle = viewMode === 'member_available' ? '还没有求队信息' : viewMode === 'mine' ? '还没有发布' : '还没有队伍';
  const emptyDescription =
    viewMode === 'member_available'
      ? '可以发布自己的方向和能力，等待同校队长联系。'
      : viewMode === 'mine'
        ? '发布后会先进入审核，通过后公开展示。'
        : '可以先发布一条组队招募。';
  const exampleCount = data.filter((item) => item.isExample).length;

  return (
    <div className="min-h-screen bg-[#edf1f7] px-4 pb-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-[#dce5f0]/80 bg-[rgba(237,241,247,0.88)] px-4 pb-3 backdrop-blur-[22px] backdrop-saturate-150">
        <CompactSearchHeader sticky={false} title="组队" scope="teams" value={keyword} onValueChange={updateKeyword} onSubmit={updateKeyword} placeholder={listingType === 'member_available' ? '搜索方向、能力或竞赛' : '搜索队伍、竞赛或缺口角色'} />
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#dce4ef] p-1" aria-label="组队大厅视图">
          {viewOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={viewMode === item.value}
              onClick={() => selectView(item.value)}
              className={`min-h-11 rounded-md px-2 py-2 text-sm font-semibold transition-[background-color,color,transform] ${
                viewMode === item.value ? 'bg-[#172033] text-white shadow-sm' : 'text-[#617089] active:bg-white/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3.5 pt-3.5">
        {!mineOnly ? (
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#dce4ef] p-1" aria-label="学校范围">
            {schoolScopeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={schoolScope === item.value}
                onClick={() => selectSchoolScope(item.value)}
                className={`min-h-11 rounded-md px-2 text-sm font-semibold ${schoolScope === item.value ? 'bg-white text-slate-950 shadow-sm' : 'text-[#617089]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        {status === 'success' && !mineOnly ? (
          <section className="flex min-h-[4.5rem] items-center justify-between gap-4 rounded-lg border border-[#d7e0ec] bg-white px-4 shadow-[0_8px_22px_rgba(29,45,72,0.05)]">
            <div>
              <div className="text-[11px] font-bold text-[#7b8798]">
                {schoolScope === 'current' ? user?.school || '本校' : schoolScope === 'other' ? '其他学校' : '全部高校'}
              </div>
              <div className="mt-0.5 text-[16px] font-semibold text-[#172033]">{viewMode === 'member_available' ? '正在找队伍的同学' : '组队招募'}</div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div><div className="text-xl font-semibold text-[#1769e0]">{data.length}</div><div className="text-[10px] text-[#8490a2]">当前内容</div></div>
              <div><div className="text-xl font-semibold text-[#e88413]">{exampleCount}</div><div className="text-[10px] text-[#8490a2]">内测示例</div></div>
            </div>
          </section>
        ) : null}
        {!teamShowcaseMode && loggedIn && !hasVerifiedSchool(user) ? <SchoolVerificationNotice compact /> : null}
        {status === 'loading' ? <StateCard mode="loading" title="正在加载组队" /> : null}
        {status === 'error' ? (
          <StateCard
            mode={mineOnly && !loggedIn ? 'auth' : 'error'}
            title={mineOnly && !loggedIn ? '请先登录' : '组队列表加载失败'}
            description={mineOnly && !loggedIn ? '登录后可以查看自己的发布。' : errorMessage}
            actionText={mineOnly && !loggedIn ? (loggingIn ? '登录中…' : '立即登录') : '重新加载'}
            onAction={() => (mineOnly && !loggedIn ? void ensureLoggedIn('/teams?mine=true') : void run(loadTeams, { forceRefresh: true }))}
          />
        ) : null}
        {status === 'success' && data.length === 0 ? (
          <StateCard mode="empty" title={emptyTitle} description={emptyDescription} />
        ) : null}

        <div className="space-y-3">{status === 'success' ? data.map((item) => <TeamCard key={item.id} team={item} />) : null}</div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!loggedIn) {
            void ensureLoggedIn(publishRoute);
            return;
          }
          navigate(publishRoute);
        }}
        disabled={loggingIn}
        className={floatingCreateButtonClass}
        aria-label={loggingIn ? '登录中' : publishType === 'member_available' ? '发布求加入' : '发布组队'}
      >
        <Plus size={25} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
