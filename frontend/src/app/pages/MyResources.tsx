import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { Toast, useToast } from '../components/Toast';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { createResourceDownload, fetchOwnedResources } from '../lib/app-service';
import { downloadWithAuth } from '../lib/download';
import { buildResourceDetailRoute, routes } from '../lib/routes';
import { getRequestErrorMessage } from '../lib/request-error';
import { startQuickLogin } from '../lib/quick-login';
import type { OwnedResourceItem } from '../../types/entities';

export function MyResources() {
  const navigate = useNavigate();
  const { loggedIn } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const { toast, showToast, clearToast } = useToast();
  const state = useRequestState<OwnedResourceItem[]>({
    initialData: () => [],
    errorMessage: '我的资源加载失败，请稍后重试。',
  });

  useEffect(() => {
    if (!loggedIn) {
      state.reset([]);
      return;
    }

    void state.run(() => fetchOwnedResources());
  }, [loggedIn, state.reset, state.run]);

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="我的资源" back />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.myResources,
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
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="我的资源" back />

      <div className="space-y-3.5 px-4">
        {state.status === 'loading' ? (
          <StateCard mode="loading" title="正在加载资源" />
        ) : null}
        {state.status === 'error' ? (
          <StateCard
            mode="error"
            title="我的资源加载失败"
            description={state.errorMessage}
            actionText="重新加载"
            onAction={() => void state.run(() => fetchOwnedResources())}
          />
        ) : null}
        {state.status === 'success' && state.data.length === 0 ? (
          <StateCard mode="empty" title="还没有资源" />
        ) : null}

        <div className="space-y-3">
          {state.status === 'success'
            ? state.data.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <Link to={buildResourceDetailRoute(item.resourceId)} className="block">
                    <div className="text-[15px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-2 text-sm text-slate-500">
                      {item.type} · {item.accessType === 'free' ? '免费获取' : '历史入库'}
                    </div>
                  </Link>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>获取时间：{item.acquiredAt}</span>
                    <span>下载 {item.downloadCount} 次</span>
                  </div>
                  {item.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.tags.map((tag, index) => (
                        <span key={`${tag}-${index}`} className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const grant = await createResourceDownload(item.resourceId);
                        await downloadWithAuth(grant.downloadUrl, grant.filename);
                      } catch (error) {
                        showToast(getRequestErrorMessage(error, '下载失败，请稍后重试。'), 'error');
                      }
                    }}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
                  >
                    <Download size={16} />
                    下载资源
                  </button>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
