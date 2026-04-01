import Taro from '@tarojs/taro';
import type { ResourceDownloadResult } from '../types/api';
import { getAuthToken } from '../services/session';
import { showPendingToast, showSuccessToast } from './feedback';

export async function downloadGrantedResource(result: ResourceDownloadResult) {
  const token = getAuthToken();
  const response = await Taro.downloadFile({
    url: result.downloadUrl,
    header: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  if (response.statusCode < 200 || response.statusCode >= 300 || !response.tempFilePath) {
    throw new Error('下载文件失败，请稍后重试。');
  }

  try {
    await Taro.openDocument({
      filePath: response.tempFilePath,
      showMenu: true,
    });
    showSuccessToast('资源已打开');
    return response.tempFilePath;
  } catch {
    try {
      const saved = await Taro.saveFile({
        tempFilePath: response.tempFilePath,
      });
      if ('savedFilePath' in saved) {
        showSuccessToast('资源已保存到本地');
        return saved.savedFilePath;
      }

      throw new Error('保存资源失败，请稍后重试。');
    } catch {
      await Taro.setClipboardData({
        data: result.downloadUrl,
      });
      showPendingToast('已复制下载链接，请稍后重试打开');
      return response.tempFilePath;
    }
  }
}
