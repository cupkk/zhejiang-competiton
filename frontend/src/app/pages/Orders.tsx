import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchOrders } from '../lib/app-service';
import { displayOrderStatus, formatPrice } from '../lib/format';
import { buildResourceDetailRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';
import type { OrderItem } from '../../types/entities';
import { useState } from 'react';

export function Orders() {
  const navigate = useNavigate();
  const { loggedIn } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const state = useRequestState<OrderItem[]>({
    initialData: () => [],
    errorMessage: '订单列表加载失败，请稍后重试。',
  });

  useEffect(() => {
    if (!loggedIn) {
      state.reset([]);
      return;
    }

    void state.run(() => fetchOrders());
  }, [loggedIn, state.reset, state.run]);

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <PageHeader title="记录" back />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.orders,
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
      <PageHeader title="记录" back />

      <div className="space-y-3.5 px-4">
        {state.status === 'loading' ? <StateCard mode="loading" title="正在加载记录" /> : null}
        {state.status === 'error' ? (
          <StateCard
            mode="error"
            title="订单列表加载失败"
            description={state.errorMessage}
            actionText="重新加载"
            onAction={() => void state.run(() => fetchOrders())}
          />
        ) : null}
        {state.status === 'success' && state.data.length === 0 ? (
          <StateCard mode="empty" title="暂无记录" />
        ) : null}
        {state.status === 'success'
          ? state.data.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[15px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-2 text-sm text-slate-500">
                      {item.itemType === 'resource' ? '资源记录' : '服务记录'} · {item.createdAt}
                    </div>
                  </div>
                  <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {displayOrderStatus(item.status)}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-lg font-semibold text-slate-900">{formatPrice(item.amount)}</div>
                  {item.resourceId ? (
                    <Link to={buildResourceDetailRoute(item.resourceId)} className="text-sm font-semibold text-blue-600">
                      查看资源
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}
