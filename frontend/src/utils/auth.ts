import Taro from '@tarojs/taro';
import { PAGE_ROUTES } from '../constants/routes';
import { getCurrentSession } from '../services/app-service';

interface EnsureLoginOptions {
  message?: string;
  redirectUrl?: string;
}

export function ensureLoggedIn(options: EnsureLoginOptions = {}) {
  const session = getCurrentSession();
  if (session) {
    return session;
  }

  Taro.showToast({
    title: options.message || '请先登录',
    icon: 'none',
  });

  setTimeout(() => {
    Taro.navigateTo({
      url: options.redirectUrl || PAGE_ROUTES.login,
    });
  }, 250);

  return null;
}
