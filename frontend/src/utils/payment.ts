import Taro from '@tarojs/taro';
import type { OrderPayResult } from '../types/api';
import { showPendingToast, showSuccessToast } from './feedback';

type PaymentInvokeStatus = 'success' | 'cancelled' | 'failed';

export async function invokeWechatMiniProgramPayment(result: OrderPayResult): Promise<PaymentInvokeStatus> {
  if (result.paymentMode === 'mock' || !result.paymentParams) {
    showSuccessToast('支付已完成');
    return 'success';
  }

  try {
    await Taro.requestPayment(result.paymentParams);
    showSuccessToast('支付结果已提交，正在同步订单状态');
    return 'success';
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.toLowerCase().includes('cancel')) {
      showPendingToast('你已取消本次支付');
      return 'cancelled';
    }

    showPendingToast('支付未完成，请稍后重试');
    return 'failed';
  }
}
