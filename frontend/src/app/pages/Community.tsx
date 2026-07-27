import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { PostQuery } from '../../types/api';
import type { PostItem, QuestionFilter } from '../../types/entities';
import { PostCard } from '../components/PostCard';
import { hasVerifiedSchool, SchoolVerificationNotice } from '../components/SchoolVerificationNotice';
import { StateCard } from '../components/StateCard';
import { bareInputClass, floatingCreateButtonClass, searchShellClass } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchPostList } from '../lib/app-service';
import { postCategoryTabs } from '../lib/domain-options';
import { dataCacheKeys, writeCachedData } from '../lib/query-cache';
import { routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

const questionFilters: Array<{ label: string; value: QuestionFilter }> = [
  { label: '最新', value: 'latest' },
  { label: '待回答', value: 'unanswered' },
  { label: '已解决', value: 'resolved' },
];

export function Community() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loggedIn, user } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const keyword = searchParams.get('keyword') || '';
  const categoryParam = searchParams.get('category') || '推荐';
  const category = postCategoryTabs.find((item) => item.value === categoryParam)?.value ?? '推荐';
  const questionParam = searchParams.get('question') || 'latest';
  const questionFilter = questionFilters.find((item) => item.value === questionParam)?.value ?? 'latest';
  const isQuestionView = category === '问答';
  const query: PostQuery = {
    keyword,
    category: (category === '推荐' ? undefined : category) as PostQuery['category'],
    questionFilter: isQuestionView ? questionFilter : undefined,
  };
  const cacheKey = dataCacheKeys.postsList({ keyword, category, questionFilter: query.questionFilter });
  const { data, status, errorMessage, run } = useRequestState<PostItem[]>({
    initialData: () => [],
    errorMessage: '社区内容加载失败，请稍后重试。',
    cacheKey,
  });

  function loadPosts() {
    return fetchPostList(query).then((items) => {
      items.forEach((item) => writeCachedData(dataCacheKeys.postDetail(item.id), item));
      return items;
    });
  }

  useEffect(() => {
    void run(loadPosts);
  }, [category, keyword, questionFilter, run]);

  function updateQuery(next: { keyword?: string; category?: string; question?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.keyword !== undefined) next.keyword ? params.set('keyword', next.keyword) : params.delete('keyword');
    if (next.category !== undefined) {
      next.category && next.category !== '推荐' ? params.set('category', next.category) : params.delete('category');
      if (next.category !== '问答') params.delete('question');
    }
    if (next.question !== undefined) next.question !== 'latest' ? params.set('question', next.question) : params.delete('question');
    setSearchParams(params, { replace: true });
  }

  function goPublishPost() {
    if (!loggedIn) {
      void startQuickLogin({ navigate, nextPath: routes.publishPost, onStart: () => setLoggingIn(true), onComplete: () => setLoggingIn(false) });
      return;
    }
    navigate(routes.publishPost);
  }

  const emptyTitle = isQuestionView
    ? questionFilter === 'unanswered' ? '暂时没有待回答问题' : questionFilter === 'resolved' ? '暂时没有已解决问题' : '还没有问答'
    : '当前分类还没有内容';

  return (
    <div className="min-h-screen bg-[#f6f7f9] pb-6">
      <div className="fixed inset-x-0 top-0 z-20 mx-auto w-full max-w-[430px] border-b border-slate-200/70 bg-[#f6f7f9]/95 px-4 py-3 backdrop-blur-xl sm:top-4 md:top-8">
        <div className={searchShellClass}>
          <Search className="shrink-0 text-slate-400" size={18} aria-hidden="true" />
          <input value={keyword} onChange={(event) => updateQuery({ keyword: event.target.value })} type="search" name="post-search" aria-label="搜索社区内容" autoComplete="off" placeholder="搜索经验、问答和关键词" className={bareInputClass} />
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1" aria-label="社区分类">
          {postCategoryTabs.map((item) => (
            <button key={item.value} type="button" aria-pressed={category === item.value} onClick={() => updateQuery({ category: item.value })} className={`min-h-11 rounded-lg px-1 text-xs font-semibold ${category === item.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
              {item.label}
            </button>
          ))}
        </div>

        {isQuestionView ? (
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-200/70 p-1" aria-label="问答状态">
            {questionFilters.map((item) => (
              <button key={item.value} type="button" aria-pressed={questionFilter === item.value} onClick={() => updateQuery({ question: item.value })} className={`min-h-11 rounded-md text-sm font-semibold ${questionFilter === item.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`space-y-3.5 px-4 ${isQuestionView ? 'pt-[12.5rem]' : 'pt-[9.25rem]'}`}>
        {loggedIn && !hasVerifiedSchool(user) ? <SchoolVerificationNotice compact /> : null}
        {status === 'loading' ? <StateCard mode="loading" title="正在加载社区内容" /> : null}
        {!loggedIn && loggingIn ? <StateCard mode="loading" title="正在登录" /> : null}
        {status === 'error' ? <StateCard mode="error" title="社区内容加载失败" description={errorMessage} actionText="重新加载" onAction={() => void run(loadPosts, { forceRefresh: true })} /> : null}
        {status === 'success' && data.length === 0 ? <StateCard mode="empty" title={emptyTitle} description={isQuestionView ? '可以发布问题，等待本校同学回答。' : '换个分类看看，或者发布一篇新内容。'} /> : null}
        <div className="space-y-3">{status === 'success' ? data.map((item) => <PostCard key={item.id} post={item} />) : null}</div>
      </div>

      <button type="button" onClick={goPublishPost} disabled={loggingIn} className={floatingCreateButtonClass} aria-label={loggingIn ? '登录中' : '发布帖子'}>
        <Plus size={25} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
