import Taro from '@tarojs/taro';

const systemInfo = Taro.getSystemInfoSync();

export const statusBarHeight = systemInfo.statusBarHeight || 20;
export const pageTopInset = statusBarHeight + 24;
