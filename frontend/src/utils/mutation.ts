import Taro from '@tarojs/taro';
import { PAGE_ROUTES } from '../constants/routes';
import { showPendingToast, showSuccessToast } from './feedback';
import { getRequestErrorMessage, isAuthExpiredError } from './request-error';

interface ExecuteMutationOptions<T> {
  task: () => Promise<T>;
  loadingTitle: string;
  successMessage?: string;
  fallbackErrorMessage: string;
  authRedirectUrl?: string;
}

export async function executeMutation<T>({
  task,
  loadingTitle,
  successMessage,
  fallbackErrorMessage,
  authRedirectUrl = PAGE_ROUTES.login,
}: ExecuteMutationOptions<T>): Promise<T | null> {
  Taro.showLoading({ title: loadingTitle });

  try {
    const result = await task();
    Taro.hideLoading();

    if (successMessage) {
      showSuccessToast(successMessage);
    }

    return result;
  } catch (error) {
    Taro.hideLoading();
    showPendingToast(getRequestErrorMessage(error, fallbackErrorMessage));

    if (isAuthExpiredError(error)) {
      setTimeout(() => {
        Taro.navigateTo({ url: authRedirectUrl });
      }, 250);
    }

    return null;
  }
}
