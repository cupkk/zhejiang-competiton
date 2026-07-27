import type { NavigateFunction } from 'react-router';
import { loginWithWechatCode } from './app-service';
import { getRequestErrorMessage } from './request-error';
import { normalizeInternalRoute, routes } from './routes';

interface QuickLoginOptions {
  navigate: NavigateFunction;
  nextPath: string;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (message: string) => void;
}

declare global {
  interface Window {
    __wxjs_environment?: string;
    wx?: {
      login?: (options: {
        success?: (result: { code?: string }) => void;
        fail?: (error: unknown) => void;
      }) => void;
      miniProgram?: {
        getEnv?: (callback: (result: { miniprogram?: boolean }) => void) => void;
        redirectTo?: (options: { url: string; success?: () => void; fail?: () => void }) => void;
        navigateTo?: (options: { url: string; success?: () => void; fail?: () => void }) => void;
        reLaunch?: (options: { url: string; success?: () => void; fail?: () => void }) => void;
      };
    };
  }
}

function isMiniProgramWebView() {
  if (window.__wxjs_environment === 'miniprogram') {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const getEnv = window.wx?.miniProgram?.getEnv;
    if (!getEnv) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(false), 500);
    try {
      getEnv((result) => finish(Boolean(result.miniprogram)));
    } catch {
      finish(false);
    }
  });
}

function buildMiniProgramWebViewUrl(nextPath: string) {
  return `/pages/webview/index?path=${encodeURIComponent(normalizeInternalRoute(nextPath, routes.home))}`;
}

export function restartMiniProgramLogin(nextPath: string) {
  const miniProgram = window.wx?.miniProgram;
  if (!miniProgram) {
    return false;
  }

  const url = buildMiniProgramWebViewUrl(nextPath);
  if (miniProgram.redirectTo) {
    miniProgram.redirectTo({
      url,
      fail: () => miniProgram.navigateTo?.({ url, fail: () => miniProgram.reLaunch?.({ url }) }),
    });
    return true;
  }

  if (miniProgram.navigateTo) {
    miniProgram.navigateTo({ url, fail: () => miniProgram.reLaunch?.({ url }) });
    return true;
  }

  if (miniProgram.reLaunch) {
    miniProgram.reLaunch({ url });
    return true;
  }

  return false;
}

async function waitForMiniProgramBridge(timeoutMs = 900) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (window.wx?.login || window.wx?.miniProgram) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }
}

function getWechatMiniProgramCode() {
  return new Promise<string>((resolve, reject) => {
    if (!window.wx?.login) {
      reject(new Error('wechat_mini_program_unavailable'));
      return;
    }

    window.wx.login({
      success: (result) => {
        if (result.code) {
          resolve(result.code);
          return;
        }
        reject(new Error('wechat_login_code_missing'));
      },
      fail: () => reject(new Error('wechat_login_failed')),
    });
  });
}

export async function startQuickLogin({ navigate, nextPath, onStart, onComplete, onError }: QuickLoginOptions) {
  onStart?.();
  const safeNextPath = normalizeInternalRoute(nextPath, routes.home);

  try {
    if (import.meta.env.DEV && !window.wx?.login) {
      await loginWithWechatCode('local-browser-preview');
      navigate(safeNextPath, { replace: true });
      return;
    }

    if (!window.wx?.login && !window.wx?.miniProgram) {
      await waitForMiniProgramBridge();
    }

    if (!window.wx?.login) {
      if ((await isMiniProgramWebView()) && restartMiniProgramLogin(safeNextPath)) {
        return;
      }
      throw new Error('请在微信小程序内登录。');
    }

    const code = await getWechatMiniProgramCode();
    await loginWithWechatCode(code);
    navigate(safeNextPath, { replace: true });
  } catch (error) {
    const message = getRequestErrorMessage(error, '登录失败，请稍后重试。');
    if (onError) {
      onError(message);
    } else {
      window.alert(message);
    }
  } finally {
    onComplete?.();
  }
}
