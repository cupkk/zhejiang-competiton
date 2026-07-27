import { useEffect, useRef, useState } from 'react';
import { useSession } from '../hooks/useSession';
import { loginWithWechatCode } from '../lib/app-service';
import { clearOnboardingResumeStep } from '../lib/onboarding-state';
import { getRequestErrorMessage } from '../lib/request-error';
import { restartMiniProgramLogin } from '../lib/quick-login';

const MINI_PROGRAM_CODE_PARAMS = ['mp_login_code', 'wechat_code'];
const MINI_PROGRAM_META_PARAMS = ['mp_login_ts', 'mp_entry', 'mp_shell_build', 'mp_entry_ts'];
const MINI_PROGRAM_SESSION_PARAM = 'mp_session';

function getMiniProgramLoginCode() {
  if (typeof window === 'undefined') {
    return '';
  }

  const params = new URLSearchParams(window.location.search);
  for (const key of MINI_PROGRAM_CODE_PARAMS) {
    const value = params.get(key)?.trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function clearMiniProgramLoginParams() {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  let changed = false;

  [...MINI_PROGRAM_CODE_PARAMS, ...MINI_PROGRAM_META_PARAMS].forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (changed) {
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

function clearLegacyMiniProgramSessionToken() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.hash.slice(1));
  let changed = false;
  if (params.has(MINI_PROGRAM_SESSION_PARAM)) {
    params.delete(MINI_PROGRAM_SESSION_PARAM);
    changed = true;
  }
  MINI_PROGRAM_META_PARAMS.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (!changed) return;
  const hash = params.toString();
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${hash ? `#${hash}` : ''}`);
}

export function WechatMiniProgramLoginBridge() {
  const { loggedIn } = useSession();
  const consumedCodeRef = useRef('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    clearLegacyMiniProgramSessionToken();

    const code = getMiniProgramLoginCode();
    if (!code) {
      return;
    }

    if (loggedIn) {
      clearMiniProgramLoginParams();
      return;
    }

    if (consumedCodeRef.current === code) {
      return;
    }

    consumedCodeRef.current = code;
    setErrorMessage('');
    void loginWithWechatCode(code)
      .catch((error) => setErrorMessage(getRequestErrorMessage(error, '微信登录失败，请重新登录。')))
      .finally(() => clearMiniProgramLoginParams());
  }, [loggedIn]);

  if (!errorMessage) return null;

  const entryPath = new URLSearchParams(window.location.search).get('mp_entry') || window.location.pathname || '/';
  const retry = () => {
    setErrorMessage('');
    if (!restartMiniProgramLogin(entryPath)) {
      window.location.assign(`/login?next=${encodeURIComponent(entryPath)}`);
    }
  };
  const browse = () => {
    clearMiniProgramLoginParams();
    clearLegacyMiniProgramSessionToken();
    clearOnboardingResumeStep();
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/20 px-5 backdrop-blur-sm">
      <section role="alert" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">登录未完成</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{errorMessage}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 min-h-12 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white active:bg-blue-700"
        >
          重新登录
        </button>
        <button
          type="button"
          onClick={browse}
          className="mt-2 min-h-11 w-full rounded-lg text-sm font-medium text-slate-500 active:bg-slate-50"
        >
          先浏览
        </button>
      </section>
    </div>
  );
}
