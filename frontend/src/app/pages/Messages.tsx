import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { NotificationItem } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { Toast, useToast } from '../components/Toast';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchMessages, markNotificationRead, markNotificationsRead } from '../lib/app-service';
import { displayMessageCategory, formatNotificationTime } from '../lib/format';
import { getRequestErrorMessage } from '../lib/request-error';
import { buildMessageTargetRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

const allCategoryValue = '__all__';

export function Messages() {
  const navigate = useNavigate();
  const { loggedIn } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(allCategoryValue);
  const { toast, showToast, clearToast } = useToast();
  const { data, setData, status, errorMessage, run } = useRequestState<NotificationItem[]>({
    initialData: () => [],
    errorMessage: '消息列表加载失败，请稍后重试。',
  });

  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    void run(fetchMessages);
  }, [loggedIn, run]);

  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(data.map((item) => item.category)));
    return [
      { value: allCategoryValue, label: '全部' },
      ...values.map((value) => ({
        value,
        label: displayMessageCategory(value),
      })),
    ];
  }, [data]);

  const visibleMessages = useMemo(() => {
    if (activeCategory === allCategoryValue) {
      return data;
    }

    return data.filter((item) => item.category === activeCategory);
  }, [activeCategory, data]);

  const unreadCount = useMemo(() => data.filter((item) => item.unread).length, [data]);

  async function openMessage(item: NotificationItem) {
    if (!loggedIn) {
      await startQuickLogin({
        navigate,
        nextPath: routes.messages,
        onStart: () => setLoggingIn(true),
        onComplete: () => setLoggingIn(false),
      });
      return;
    }

    if (item.unread) {
      setData((current) => current.map((entry) => (entry.id === item.id ? { ...entry, unread: false } : entry)));

      try {
        await markNotificationRead(item.id);
      } catch {
        // keep the optimistic state to avoid blocking navigation
      }
    }

    const target = buildMessageTargetRoute(item);
    if (target) {
      navigate(target);
    }
  }

  async function markAllAsRead() {
    if (!unreadCount) {
      return;
    }

    try {
      await markNotificationsRead({ all: true });
      setData((current) => current.map((entry) => ({ ...entry, unread: false })));
      showToast('已全部标记已读', 'success');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '全部标记已读失败，请稍后重试。'), 'error');
    }
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader
        title="消息"
        back
        rightText={loggedIn && unreadCount ? '全部已读' : undefined}
        onRightClick={() => void markAllAsRead()}
      />

      <div className="space-y-4 px-4">
        {!loggedIn ? (
          <StateCard
            mode="auth"
            title="登录后查看消息"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.messages,
                onStart: () => setLoggingIn(true),
                onComplete: () => setLoggingIn(false),
              })
            }
          />
        ) : null}

        {loggedIn && categoryOptions.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categoryOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={activeCategory === item.value}
                onClick={() => setActiveCategory(item.value)}
                className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  activeCategory === item.value ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-500'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {loggedIn && status === 'loading' ? (
          <StateCard mode="loading" title="正在加载消息" />
        ) : null}

        {loggedIn && status === 'error' ? (
          <StateCard
            mode="error"
            title="消息加载失败"
            description={errorMessage}
            actionText="重新加载"
            onAction={() => void run(fetchMessages)}
          />
        ) : null}

        {loggedIn && status === 'auth_expired' ? (
          <StateCard
            mode="auth"
            title="登录状态已失效"
            actionText={loggingIn ? '登录中…' : '重新登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.messages,
                onStart: () => setLoggingIn(true),
                onComplete: () => setLoggingIn(false),
              })
            }
          />
        ) : null}

        {loggedIn && status === 'success' && visibleMessages.length === 0 ? (
          <StateCard
            mode="empty"
            title={activeCategory === allCategoryValue ? '还没有消息' : '当前分类暂无消息'}
          />
        ) : null}

        {loggedIn && status === 'success' && visibleMessages.length > 0 ? (
          <section className="overflow-hidden border-y border-slate-200 bg-white">
            <div className="divide-y divide-slate-100">
              {visibleMessages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openMessage(item)}
                className="w-full px-4 py-4 text-left transition active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span>{displayMessageCategory(item.category)}</span>
                      {item.unread ? <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="未读" /> : null}
                    </div>

                    <div className={`mt-2 text-base font-semibold ${item.unread ? 'text-slate-900' : 'text-slate-600'}`}>{item.title}</div>
                    <p className={`mt-1 line-clamp-2 text-sm leading-6 ${item.unread ? 'text-slate-600' : 'text-slate-500'}`}>{item.content}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs font-medium text-slate-400">{formatNotificationTime(item.time)}</div>
                    <ChevronRight size={16} className="ml-auto mt-5 text-slate-300" aria-hidden="true" />
                  </div>
                </div>
              </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
