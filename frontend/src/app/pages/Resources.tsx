import { Plus } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { useSearchParams } from 'react-router';
import type { ResourceQuery } from '../../types/api';
import type { ResourceItem } from '../../types/entities';
import { ResourceCard } from '../components/ResourceCard';
import { CompactSearchHeader } from '../components/CompactSearchHeader';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { fetchResourceList } from '../lib/app-service';
import { routes } from '../lib/routes';
import { floatingCreateButtonClass } from '../components/ui';
import { resourceCategoryOptions } from '../lib/domain-options';
import { dataCacheKeys, writeCachedData } from '../lib/query-cache';

export function Resources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';
  const categoryParam = searchParams.get('category') || '全部';
  const category = resourceCategoryOptions.find((item) => item.value === categoryParam)?.value ?? '全部';
  const query: ResourceQuery = {
    keyword,
    category: category === '全部' ? undefined : category,
    priceType: '免费',
  };
  const cacheKey = dataCacheKeys.resourcesList({ keyword, category, priceType: query.priceType });

  const { data, status, errorMessage, run } = useRequestState<ResourceItem[]>({
    initialData: () => [],
    errorMessage: '资源列表加载失败，请稍后重试。',
    cacheKey,
  });

  function loadResources() {
    return fetchResourceList(query).then((items) => {
      items.forEach((item) => writeCachedData(dataCacheKeys.resourceDetail(item.id), item));
      return items;
    });
  }

  useEffect(() => {
    void run(loadResources);
  }, [keyword, category, run]);

  function updateQuery(next: { keyword?: string; category?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.keyword !== undefined) {
      next.keyword ? params.set('keyword', next.keyword) : params.delete('keyword');
    }
    if (next.category !== undefined) {
      next.category && next.category !== '全部' ? params.set('category', next.category) : params.delete('category');
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] px-4 pb-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-white/70 bg-[rgba(245,247,250,0.86)] px-4 pb-3 backdrop-blur-[22px] backdrop-saturate-150">
        <CompactSearchHeader sticky={false} title="资源" scope="resources" value={keyword} onValueChange={(value) => updateQuery({ keyword: value })} onSubmit={(value) => updateQuery({ keyword: value })} placeholder="搜索资料、模板和攻略" />
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {resourceCategoryOptions.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => updateQuery({ category: item.value || '全部' })}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 py-2 text-sm font-semibold transition-[background-color,color,transform] ${
                category === item.value ? 'bg-slate-900 text-white' : 'bg-white/85 text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
          <Link
            to={routes.resourceSubmissions}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/85 px-3.5 py-2 text-sm font-semibold text-slate-700 active:scale-[0.98]"
          >
            我的投稿
          </Link>
        </div>
      </div>

      <div className="space-y-3.5 pt-3.5">
        {status === 'loading' ? (
          <StateCard mode="loading" title="正在加载资源列表" description="下载量、分类和资源状态正在同步中。" />
        ) : null}

        {status === 'error' ? (
          <StateCard
            mode="error"
            title="资源列表加载失败"
            description={errorMessage}
            actionText="重新加载"
            onAction={() => void run(loadResources, { forceRefresh: true })}
          />
        ) : null}

        {status === 'success' && data.length === 0 ? (
          <StateCard mode="empty" title="还没有资源内容" description="等管理员发布资源后，这里会显示最新内容。" />
        ) : null}

        <div className="space-y-3">
          {status === 'success' ? data.map((item) => <ResourceCard key={item.id} resource={item} />) : null}
        </div>
      </div>

      <Link
        to={routes.publishResource}
        className={floatingCreateButtonClass}
        aria-label="发布资源"
      >
        <Plus size={25} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
