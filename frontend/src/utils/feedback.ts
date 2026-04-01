import Taro from '@tarojs/taro';

export function showPendingToast(message: string) {
  Taro.showToast({
    title: message,
    icon: 'none',
  });
}

export function showSuccessToast(message: string) {
  Taro.showToast({
    title: message,
    icon: 'success',
  });
}
