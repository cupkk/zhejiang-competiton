import { CalendarDays, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CheckinState } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { Toast, useToast } from '../components/Toast';
import { ActionButton } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { checkinCurrentUser, fetchCheckinState } from '../lib/app-service';
import { getAvatarAlt, getAvatarLabel } from '../lib/avatar';
import { getRequestErrorMessage } from '../lib/request-error';
import { routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

const emptyCheckinState: CheckinState = {
  points: 0,
  streak: 0,
  checkedInToday: false,
  todayReward: 5,
  month: '',
  checkedDates: [],
  calendar: [],
};

const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];

function getLeadingBlankCount(month: string) {
  if (!month) return 0;
  const date = new Date(`${month}-01T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getDay();
}

function formatMonthLabel(month: string) {
  if (!month) return '';
  const [year, monthValue] = month.split('-');
  return `${year} 年 ${Number(monthValue)} 月`;
}

export function Checkin() {
  const navigate = useNavigate();
  const { loggedIn, user } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, clearToast } = useToast();
  const state = useRequestState<CheckinState>({
    initialData: emptyCheckinState,
    errorMessage: '签到信息加载失败，请稍后重试。',
  });

  useEffect(() => {
    if (!loggedIn) {
      state.reset(emptyCheckinState);
      return;
    }

    void state.run(() => fetchCheckinState());
  }, [loggedIn, state.reset, state.run]);

  const leadingBlanks = useMemo(() => getLeadingBlankCount(state.data.month), [state.data.month]);

  async function handleCheckin() {
    setSubmitting(true);
    try {
      const result = await checkinCurrentUser();
      state.setData(result);
      showToast(result.message, result.awardedPoints > 0 ? 'success' : 'info');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '签到失败，请稍后重试。'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!loggedIn || !user) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="签到" back fallbackTo={routes.profile} />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.checkin,
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
    <div className="min-h-full bg-[#f5f7fb] pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="签到" back fallbackTo={routes.profile} />

      <div className="space-y-4 px-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={getAvatarAlt(user)}
                width={56}
                height={56}
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xl font-semibold text-white">
                {getAvatarLabel(user.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-500">我的积分</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2rem] font-semibold leading-none tracking-normal text-slate-950">{state.data.points}</span>
                <span className="text-sm font-semibold text-slate-500">分</span>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-blue-600">{state.data.streak}</div>
              <div className="mt-0.5 text-[11px] font-medium text-blue-600">连续天</div>
            </div>
          </div>

          <ActionButton
            type="button"
            fullWidth
            className="mt-4"
            disabled={submitting || state.status === 'loading' || state.data.checkedInToday}
            onClick={() => void handleCheckin()}
          >
            {submitting ? <LoaderCircle size={17} className="animate-spin" /> : state.data.checkedInToday ? <CheckCircle2 size={17} /> : null}
            {state.data.checkedInToday ? '今日已签到' : `今日签到 +${state.data.todayReward}`}
          </ActionButton>
        </section>

        {state.status === 'loading' ? <StateCard mode="loading" title="正在加载签到" /> : null}
        {state.status === 'error' ? (
          <StateCard
            mode="error"
            title="签到信息加载失败"
            description={state.errorMessage}
            actionText="重新加载"
            onAction={() => void state.run(() => fetchCheckinState(), { forceRefresh: true })}
          />
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950">
              <CalendarDays size={18} className="text-slate-500" aria-hidden="true" />
              签到日历
            </div>
            <span className="text-xs font-semibold text-slate-500">{formatMonthLabel(state.data.month)}</span>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
            {weekLabels.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} className="aspect-square" />
            ))}
            {state.data.calendar.map((day) => (
              <div
                key={day.date}
                className={`flex aspect-square items-center justify-center rounded-lg text-sm font-semibold tabular-nums ${
                  day.checked
                    ? 'bg-blue-600 text-white'
                    : day.today
                      ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                      : 'bg-slate-50 text-slate-500'
                }`}
                aria-label={`${day.date}${day.checked ? ' 已签到' : ''}`}
              >
                {day.day}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
