import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../hooks/useSession';
import { normalizeInternalRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

const campusImageUrl = '/campus-login.webp';

function getLoginPrompt(nextPath: string) {
  if (nextPath.startsWith('/resources/')) return '登录后继续领取资料';
  if (nextPath.startsWith('/competitions/')) return '登录后继续收藏竞赛';
  if (nextPath.startsWith('/teams')) return '登录后继续查看组队';
  if (nextPath.startsWith('/posts') || nextPath.startsWith('/community')) return '登录后继续参与社区';
  return '登录校园成长';
}

export function Login() {
  const navigate = useNavigate();
  const { loggedIn } = useSession();
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const nextPath = useMemo(() => normalizeInternalRoute(searchParams.get('next'), routes.profile), [searchParams]);
  const loginPrompt = useMemo(() => getLoginPrompt(nextPath), [nextPath]);

  useEffect(() => {
    if (loggedIn) {
      navigate(nextPath, { replace: true });
    }
  }, [loggedIn, navigate, nextPath]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(routes.home, { replace: true });
  };

  const handleLogin = () => {
    setErrorMessage('');
    void startQuickLogin({
      navigate,
      nextPath,
      onStart: () => setLoggingIn(true),
      onComplete: () => setLoggingIn(false),
      onError: setErrorMessage,
    });
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-white">
      <div className="flex min-h-[100dvh] w-full flex-col">
        <section className="relative h-[40dvh] min-h-[240px] max-h-[300px] overflow-hidden bg-slate-200">
          <img
            src={campusImageUrl}
            alt="校园场景"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/30" />
          <button
            type="button"
            onClick={handleBack}
            className="absolute left-4 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white/92 p-0 text-slate-900 backdrop-blur-md transition-colors active:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
            aria-label="返回"
          >
            <ArrowLeft size={21} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className="absolute inset-x-0 bottom-0 px-5 pb-7 text-white">
            <h1 className="text-[28px] font-semibold leading-tight">校园成长</h1>
            <p className="mt-1 text-[14px] leading-6 text-white/82">本校竞赛、资料和组队</p>
          </div>
        </section>

        <div className="-mt-2 flex flex-1 flex-col rounded-t-lg bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-7">
          <section className="pb-5">
            <div className="text-xl font-semibold leading-8 text-slate-950">{loginPrompt}</div>
          </section>

          <section className="pt-5" aria-label="登录操作">
            <button
              type="button"
              onClick={handleLogin}
              disabled={loggingIn}
              aria-busy={loggingIn}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#07c160] px-5 py-3.5 text-[16px] font-semibold text-white transition-colors active:scale-[0.99] active:bg-[#059c4e] disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
            >
              {loggingIn ? (
                <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
              ) : (
                <img src="/wechat-logo.svg" alt="" className="h-5 w-5" aria-hidden="true" />
              )}
              {loggingIn ? '正在登录' : '微信登录'}
            </button>

            <div aria-live="polite" className="min-h-8">
              {errorMessage ? (
                <p role="alert" className="px-2 pt-2 text-center text-sm leading-6 text-rose-600">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate(routes.home, { replace: true })}
              className="flex min-h-11 w-full items-center justify-center bg-transparent px-4 py-2 text-sm font-medium text-slate-500 transition-colors active:text-slate-800"
            >
              先逛逛
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
