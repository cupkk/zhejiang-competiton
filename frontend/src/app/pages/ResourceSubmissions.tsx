import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchMyResourceSubmissions } from '../lib/app-service';
import { formatDateTimeLabel, statusTone } from '../lib/format';
import { buildResourceDetailRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';
import type { ResourceSubmissionSummary } from '../lib/admin-types';

export function ResourceSubmissions() {
  const navigate = useNavigate();
  const { loggedIn } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const state = useRequestState<ResourceSubmissionSummary[]>({
    initialData: () => [],
    errorMessage: '投稿记录加载失败，请稍后重试。',
  });

  useEffect(() => {
    if (!loggedIn) {
      state.reset([]);
      return;
    }

    void state.run(fetchMyResourceSubmissions);
  }, [loggedIn, state.reset, state.run]);

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <PageHeader title="我的投稿" back />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.resourceSubmissions,
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
      <PageHeader title="我的投稿" back />

      <div className="space-y-3.5 px-4">
        {state.status === 'loading' ? (
          <StateCard mode="loading" title="正在加载投稿" />
        ) : null}

        {state.status === 'error' ? (
          <StateCard
            mode="error"
            title="投稿记录加载失败"
            description={state.errorMessage}
            actionText="重新加载"
            onAction={() => void state.run(fetchMyResourceSubmissions)}
          />
        ) : null}

        {state.status === 'success' && state.data.length === 0 ? (
          <StateCard mode="empty" title="还没有投稿" />
        ) : null}

        {state.status === 'success'
          ? state.data.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[15px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-2 text-sm text-slate-500">
                      {item.type} · {item.category} · 免费投稿
                    </div>
                  </div>
                  <span className={`rounded-md px-3 py-1 text-xs font-semibold ${statusTone(item.moderationStatus)}`}>
                    {item.moderationStatus === 'approved'
                      ? '已通过'
                      : item.moderationStatus === 'rejected'
                        ? '已驳回'
                        : '待审核'}
                  </span>
                </div>

                <div className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{item.description}</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag, index) => (
                    <span key={`${tag}-${index}`} className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-4 text-xs text-slate-400">
                  创建于 {formatDateTimeLabel(item.createdAt)} · 更新于 {formatDateTimeLabel(item.updatedAt)}
                </div>

                {item.reviewNote ? (
                  <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    审核说明：{item.reviewNote}
                  </div>
                ) : null}

                {item.moderationStatus === 'approved' ? (
                  <Link
                    to={buildResourceDetailRoute(item.id)}
                    className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
                  >
                    查看资源详情
                  </Link>
                ) : null}
              </div>
            ))
          : null}
      </div>
    </div>
  );
}
