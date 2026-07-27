import { ArrowLeft, ChevronRight, Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { SearchQuery } from '../../types/api';
import type { SearchResultItem, SearchSuggestion } from '../../types/entities';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { fetchSearchSuggestions, searchContent } from '../lib/app-service';
import {
  buildCompetitionDetailRoute,
  buildPostDetailRoute,
  buildResourceDetailRoute,
  buildTeamDetailRoute,
  routes,
} from '../lib/routes';

function resultRoute(item: SearchResultItem) {
  if (item.scope === 'competitions') return buildCompetitionDetailRoute(item.id);
  if (item.scope === 'resources') return buildResourceDetailRoute(item.id);
  if (item.scope === 'teams') return buildTeamDetailRoute(item.id);
  return buildPostDetailRoute(item.id);
}

const scopeLabels: Record<SearchResultItem['scope'], string> = {
  all: '全部', competitions: '竞赛', resources: '资源', posts: '社区', teams: '组队',
};

const tabs = [
  { label: '全部', value: 'all' },
  { label: '竞赛', value: 'competitions' },
  { label: '资源', value: 'resources' },
  { label: '社区', value: 'posts' },
  { label: '组队', value: 'teams' },
] as const;

export function Search() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [scope, setScope] = useState(searchParams.get('scope') || 'all');
  const suggestions = useRequestState<SearchSuggestion[]>({ initialData: () => [], errorMessage: '搜索建议加载失败。' });
  const results = useRequestState<SearchResultItem[]>({ initialData: () => [], errorMessage: '搜索失败，请稍后重试。' });

  useEffect(() => { void suggestions.run(fetchSearchSuggestions); }, [suggestions.run]);

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || '';
    const nextScope = searchParams.get('scope') || 'all';
    setKeyword(nextKeyword);
    setScope(nextScope);
    if (!nextKeyword.trim()) {
      results.reset([]);
      return;
    }
    void results.run(() => searchContent({ keyword: nextKeyword.trim(), scope: nextScope as SearchQuery['scope'] }));
  }, [results.reset, results.run, searchParams]);

  const groups = useMemo(() => {
    const grouped = new Map<SearchResultItem['scope'], SearchResultItem[]>();
    results.data.forEach((item) => grouped.set(item.scope, [...(grouped.get(item.scope) || []), item]));
    return [...grouped.entries()];
  }, [results.data]);

  function submit(nextKeyword = keyword, nextScope = scope) {
    const params = new URLSearchParams();
    if (nextKeyword.trim()) params.set('keyword', nextKeyword.trim());
    params.set('scope', nextScope);
    setSearchParams(params);
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(routes.home, { replace: true });
  }

  return (
    <div className="min-h-full bg-[#f4f6f9] pb-8">
      <header className="sticky top-0 z-30 border-b border-white/80 bg-[rgba(245,247,250,0.88)] px-4 pb-3 pt-3 backdrop-blur-[22px] backdrop-saturate-150">
        <div className="flex min-h-11 items-center gap-2">
          <button type="button" onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-white" aria-label="返回">
            <ArrowLeft size={21} strokeWidth={2.2} />
          </button>
          <div className="search-material flex h-11 min-w-0 flex-1 items-center rounded-[14px] bg-white/92 px-3 shadow-[0_4px_18px_rgba(15,23,42,0.07)]" role="search">
            <SearchIcon size={18} className="shrink-0 text-blue-600" strokeWidth={2.3} aria-hidden="true" />
            <input
              ref={inputRef}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submit()}
              type="search"
              name="site-search"
              aria-label="搜索平台内容"
              autoComplete="off"
              placeholder="搜索竞赛、资源、组队"
              className="app-bare-input ml-2 min-w-0 flex-1 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            {keyword ? (
              <button type="button" onClick={() => { setKeyword(''); inputRef.current?.focus(); }} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100" aria-label="清除搜索">
                <X size={16} />
              </button>
            ) : null}
          </div>
          <button type="button" onClick={() => submit()} disabled={!keyword.trim()} className="min-h-11 min-w-11 shrink-0 text-sm font-semibold text-blue-600 disabled:text-slate-300">搜索</button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="搜索范围">
          {tabs.map((item) => (
            <button key={item.value} type="button" aria-pressed={scope === item.value} onClick={() => { setScope(item.value); submit(keyword, item.value); }} className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold ${scope === item.value ? 'bg-slate-900 text-white' : 'bg-white/85 text-slate-600'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4">
        {!searchParams.get('keyword') ? (
          <section>
            <h1 className="px-1 text-[20px] font-semibold leading-8 text-slate-950">热门搜索</h1>
            {suggestions.status === 'loading' ? <div className="mt-3 space-y-2 rounded-lg bg-white p-4" aria-label="正在加载"><div className="h-11 animate-pulse rounded-md bg-slate-100" /><div className="h-11 animate-pulse rounded-md bg-slate-100" /></div> : null}
            {suggestions.status === 'error' ? <StateCard mode="error" title="建议加载失败" actionText="重试" onAction={() => void suggestions.run(fetchSearchSuggestions)} /> : null}
            {suggestions.status === 'success' && suggestions.data.length === 0 ? <StateCard mode="empty" title="暂无热门搜索" /> : null}
            {suggestions.status === 'success' && suggestions.data.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200/80 bg-white">
                {suggestions.data.map((item) => (
                  <button key={item.id} type="button" onClick={() => { setKeyword(item.label); setScope(item.scope); submit(item.label, item.scope); }} className="flex min-h-[3.5rem] w-full items-center justify-between border-b border-slate-100 px-4 text-left last:border-0 active:bg-slate-50">
                    <span className="min-w-0 truncate text-[15px] font-medium text-slate-800">{item.label}</span>
                    <ChevronRight size={17} className="shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <>
            {results.status === 'loading' ? <div className="space-y-3" aria-label="正在搜索">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-white" />)}</div> : null}
            {results.status === 'error' ? <StateCard mode="error" title="搜索失败" description={results.errorMessage} actionText="重新搜索" onAction={() => submit()} /> : null}
            {results.status === 'success' && results.data.length === 0 ? <StateCard mode="empty" title="没有找到相关内容" description="换个关键词或搜索范围再试。" /> : null}
            {results.status === 'success' ? groups.map(([groupScope, items]) => (
              <section key={groupScope} className="mb-5">
                <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-[17px] font-semibold text-slate-950">{scopeLabels[groupScope]}</h2><span className="text-xs text-slate-400">{items.length} 条</span></div>
                <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white">
                  {items.map((item) => (
                    <Link key={`${item.scope}-${item.id}`} to={resultRoute(item)} className="flex min-h-[5.25rem] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 active:bg-slate-50">
                      <div className="min-w-0 flex-1"><div className="line-clamp-1 text-[15px] font-semibold leading-6 text-slate-900">{item.title}</div><div className="mt-0.5 line-clamp-1 text-sm text-slate-500">{item.subtitle}</div><div className="mt-1 truncate text-xs text-slate-400">{item.meta}</div></div>
                      <ChevronRight size={17} className="shrink-0 text-slate-300" />
                    </Link>
                  ))}
                </div>
              </section>
            )) : null}
          </>
        )}
      </main>
    </div>
  );
}
