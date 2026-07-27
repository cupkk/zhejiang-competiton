import { BookmarkX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import {
  fetchFavorites,
  toggleCompetitionFavorite,
  togglePostFavorite,
  toggleResourceFavorite,
} from '../lib/app-service';
import {
  buildCompetitionDetailRoute,
  buildPostDetailRoute,
  buildResourceDetailRoute,
  routes,
} from '../lib/routes';
import { displayPostCategory, formatDateTimeLabel } from '../lib/format';
import { startQuickLogin } from '../lib/quick-login';
import type { FavoriteCollection } from '../../types/entities';

const emptyFavorites: FavoriteCollection = {
  competitions: [],
  resources: [],
  posts: [],
};

function FavoriteItem({
  title,
  meta,
  to,
  onRemove,
}: {
  title: string;
  meta: string;
  to: string;
  onRemove: () => Promise<void> | void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <Link to={to} className="block">
        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
        <div className="mt-2 line-clamp-1 text-sm leading-6 text-slate-500">{meta}</div>
      </Link>
      <button
        type="button"
        onClick={() => void onRemove()}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600"
      >
        <BookmarkX size={14} />
        取消收藏
      </button>
    </div>
  );
}

export function Favorites() {
  const navigate = useNavigate();
  const { loggedIn } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const [scope, setScope] = useState<'all' | 'competition' | 'resource' | 'post'>('all');
  const state = useRequestState<FavoriteCollection>({
    initialData: emptyFavorites,
    errorMessage: '收藏内容加载失败，请稍后重试。',
  });

  useEffect(() => {
    if (!loggedIn) {
      state.reset(emptyFavorites);
      return;
    }

    void state.run(() => fetchFavorites());
  }, [loggedIn, state.reset, state.run]);

  const sections = useMemo(
    () => [
      { key: 'competition' as const, title: '收藏的竞赛', count: state.data.competitions.length },
      { key: 'resource' as const, title: '收藏的资源', count: state.data.resources.length },
      { key: 'post' as const, title: '收藏的帖子', count: state.data.posts.length },
    ],
    [state.data],
  );
  const visibleSections = sections.filter((section) => {
    if (scope !== 'all') return scope === section.key;
    return section.count > 0;
  });

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <PageHeader title="收藏" back />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.favorites,
                onStart: () => setLoggingIn(true),
                onComplete: () => setLoggingIn(false),
              })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <PageHeader title="收藏" back />

      <div className="space-y-3.5 px-4">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold text-slate-500">类型</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { value: 'all', label: '全部' },
              { value: 'competition', label: '竞赛' },
              { value: 'resource', label: '资源' },
              { value: 'post', label: '帖子' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setScope(item.value as typeof scope)}
                className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  scope === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {state.status === 'loading' ? (
          <StateCard mode="loading" title="正在加载收藏" />
        ) : null}
        {state.status === 'error' ? (
          <StateCard
            mode="error"
            title="收藏内容加载失败"
            description={state.errorMessage}
            actionText="重新加载"
            onAction={() => void state.run(() => fetchFavorites())}
          />
        ) : null}

        {state.status === 'success' && visibleSections.length === 0 ? (
          <StateCard mode="empty" title="还没有收藏" />
        ) : null}

        {state.status === 'success' &&
          visibleSections.map((section) => (
              <section key={section.key} className="space-y-3">
                <div className="px-1 text-[1rem] font-semibold text-slate-900">{section.title}</div>
                {section.key === 'competition' &&
                  state.data.competitions.map((item) => (
                    <FavoriteItem
                      key={item.id}
                      title={item.title}
                      meta={`收藏于 ${formatDateTimeLabel(item.viewer?.favoritedAt)} · 截止 ${item.deadline}`}
                      to={buildCompetitionDetailRoute(item.id)}
                      onRemove={async () => {
                        await toggleCompetitionFavorite(item.id, { favorite: false });
                        state.setData({
                          ...state.data,
                          competitions: state.data.competitions.filter((target) => target.id !== item.id),
                        });
                      }}
                    />
                  ))}
                {section.key === 'resource' &&
                  state.data.resources.map((item) => (
                    <FavoriteItem
                      key={item.id}
                      title={item.title}
                      meta={`收藏于 ${formatDateTimeLabel(item.viewer?.favoritedAt)} · ${item.price === 0 ? '可直接领取' : '暂未公开'}`}
                      to={buildResourceDetailRoute(item.id)}
                      onRemove={async () => {
                        await toggleResourceFavorite(item.id, { favorite: false });
                        state.setData({
                          ...state.data,
                          resources: state.data.resources.filter((target) => target.id !== item.id),
                        });
                      }}
                    />
                  ))}
                {section.key === 'post' &&
                  state.data.posts.map((item) => (
                    <FavoriteItem
                      key={item.id}
                      title={item.title}
                      meta={`收藏于 ${formatDateTimeLabel(item.viewer?.favoritedAt)} · ${displayPostCategory(item.category)}`}
                      to={buildPostDetailRoute(item.id)}
                      onRemove={async () => {
                        await togglePostFavorite(item.id, { favorite: false });
                        state.setData({
                          ...state.data,
                          posts: state.data.posts.filter((target) => target.id !== item.id),
                        });
                      }}
                    />
                  ))}
                {section.count === 0 ? (
                  <StateCard mode="empty" title={`${section.title}为空`} />
                ) : null}
              </section>
          ))}
      </div>
    </div>
  );
}
