import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import type { CompetitionQuery } from '../../types/api';
import type { Competition } from '../../types/entities';
import { CompetitionCard } from '../components/CompetitionCard';
import { CompactSearchHeader } from '../components/CompactSearchHeader';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { fetchCompetitionList } from '../lib/app-service';
import { competitionCategoryOptions, competitionLevelOptions, competitionSortOptions } from '../lib/domain-options';
import { dataCacheKeys, writeCachedData } from '../lib/query-cache';

const filterSelectClass =
  'min-h-11 min-w-0 w-full appearance-none rounded-lg border border-[#d7e0ec] bg-white/92 px-3 text-sm font-semibold text-[#41506a] outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-blue-100/70';

export function Competitions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';
  const categoryParam = searchParams.get('category') || '';
  const levelParam = searchParams.get('level') || '';
  const sortParam = searchParams.get('sort') || '推荐';
  const category = competitionCategoryOptions.find((item) => item.value === categoryParam)?.value;
  const level = competitionLevelOptions.find((item) => item.value === levelParam)?.value;
  const sort = competitionSortOptions.find((item) => item.value === sortParam)?.value ?? '推荐';
  const cacheKey = dataCacheKeys.competitionsList({ keyword, category, level, sort });
  const { data, status, errorMessage, run } = useRequestState<Competition[]>({
    initialData: () => [],
    errorMessage: '竞赛列表加载失败，请稍后重试。',
    cacheKey,
  });
  const activeCount = data.filter((item) => item.scheduleStatus === 'announced' || item.scheduleStatus === 'partially_announced').length;
  const upcomingCount = data.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30).length;
  const referenceCount = data.filter((item) => item.dataFreshness === 'reference').length;

  function loadCompetitions() {
    return fetchCompetitionList({ keyword, category, level, sort, limit: 30 } as CompetitionQuery).then((items) => {
      items.forEach((item) => writeCachedData(dataCacheKeys.competitionDetail(item.id), item));
      return items;
    });
  }

  useEffect(() => {
    void run(loadCompetitions);
  }, [category, keyword, level, sort, run]);

  function updateQuery(next: { keyword?: string; category?: string; level?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === 'sort' && value === '推荐')) params.set(key, value);
      else params.delete(key);
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#edf1f7] px-4 pb-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-[#dce5f0]/80 bg-[rgba(237,241,247,0.88)] px-4 pb-3 backdrop-blur-[22px] backdrop-saturate-150">
        <CompactSearchHeader sticky={false} title="竞赛" scope="competitions" value={keyword} onValueChange={(value) => updateQuery({ keyword: value })} onSubmit={(value) => updateQuery({ keyword: value })} placeholder="搜索竞赛、主办方或关键词" />
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="竞赛分类" value={category || ''} onChange={(event) => updateQuery({ category: event.target.value })} className={filterSelectClass}>
            {competitionCategoryOptions.map((item) => <option key={item.label} value={item.value || ''}>{item.label}</option>)}
          </select>
          <select aria-label="赛事级别" value={level || ''} onChange={(event) => updateQuery({ level: event.target.value })} className={filterSelectClass}>
            {competitionLevelOptions.map((item) => <option key={item.label} value={item.value || ''}>{item.label === '全部' ? '全部级别' : item.label}</option>)}
          </select>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-[#dce4ef] p-1" aria-label="竞赛排序">
          {competitionSortOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={sort === item.value}
              onClick={() => updateQuery({ sort: item.value })}
              className={`min-h-11 rounded-md px-1 text-xs font-semibold ${sort === item.value ? 'bg-[#172033] text-white shadow-sm' : 'text-[#617089]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3.5 pt-3.5">
        {status === 'success' ? (
          <section className="grid grid-cols-3 divide-x divide-[#dce4ef] rounded-lg border border-[#d7e0ec] bg-white px-2 py-3 shadow-[0_8px_22px_rgba(29,45,72,0.05)]" aria-label="竞赛概览">
            <div className="px-2 text-center"><div className="text-xl font-semibold text-[#1769e0]">{activeCount}</div><div className="mt-0.5 text-[11px] font-medium text-[#748198]">赛程中</div></div>
            <div className="px-2 text-center"><div className="text-xl font-semibold text-[#d97706]">{upcomingCount}</div><div className="mt-0.5 text-[11px] font-medium text-[#748198]">30 天内</div></div>
            <div className="px-2 text-center"><div className="text-xl font-semibold text-[#59677d]">{referenceCount}</div><div className="mt-0.5 text-[11px] font-medium text-[#748198]">往届参考</div></div>
          </section>
        ) : null}
        {status === 'loading' ? <StateCard mode="loading" title="正在加载竞赛" /> : null}
        {status === 'error' ? (
          <StateCard mode="error" title="竞赛列表加载失败" description={errorMessage} actionText="重新加载" onAction={() => void run(loadCompetitions, { forceRefresh: true })} />
        ) : null}
        {status === 'success' && data.length === 0 ? (
          <StateCard mode="empty" title="没有匹配的竞赛" description="调整分类、级别或关键词后再试。" />
        ) : null}
        <div className="space-y-3">{status === 'success' ? data.map((item) => <CompetitionCard key={item.id} competition={item} />) : null}</div>
      </div>
    </div>
  );
}
