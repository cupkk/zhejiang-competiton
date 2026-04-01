import { useMemo } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import {
  buildRefundResultRoute,
  buildResourceDetailRoute,
  PAGE_ROUTES,
} from '../../constants/routes';
import { useProtectedRequest } from '../../hooks/useProtectedRequest';
import {
  createOrderPayment,
  createOrderRefund,
  fetchOrders,
} from '../../services/app-service';
import type { OrderItem } from '../../types/entities';
import { executeMutation } from '../../utils/mutation';
import { invokeWechatMiniProgramPayment } from '../../utils/payment';

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

export default function OrdersPage() {
  const {
    user,
    loggedIn,
    data: orders,
    status,
    errorMessage,
    reload: reloadOrders,
  } = useProtectedRequest<OrderItem[]>({
    initialData: () => [],
    errorMessage: '订单加载失败，请稍后重试。',
    request: () => fetchOrders(),
  });

  const summary = useMemo(() => {
    const paidCount = orders.filter((item) => item.status === '已完成').length;
    const pendingCount = orders.filter((item) => item.status === '待支付').length;
    const refundCount = orders.filter((item) => item.status === '退款中' || item.status === '已退款').length;
    const totalAmount = orders.reduce((total, item) => total + item.amount, 0);

    return {
      paidCount,
      pendingCount,
      refundCount,
      totalAmount,
    };
  }, [orders]);

  const goResources = () => {
    Taro.switchTab({ url: PAGE_ROUTES.resources });
  };

  const openRefundResult = (orderId: string) => {
    Taro.navigateTo({ url: buildRefundResultRoute(orderId) });
  };

  const handlePay = async (orderId: string) => {
    const result = await executeMutation({
      task: () => createOrderPayment(orderId),
      loadingTitle: '拉起支付',
      fallbackErrorMessage: '支付参数获取失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    const paymentStatus = await invokeWechatMiniProgramPayment(result);
    if (paymentStatus !== 'success') {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));
    await reloadOrders();
  };

  const handleRefund = async (orderId: string) => {
    const result = await executeMutation({
      task: () => createOrderRefund(orderId, { reason: '用户在前端发起退款申请' }),
      loadingTitle: '提交退款',
      successMessage: '退款请求已提交',
      fallbackErrorMessage: '退款申请提交失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    await reloadOrders();
    openRefundResult(orderId);
  };

  return (
    <View className='page-shell'>
      <TopBar
        title='我的订单'
        rightText={loggedIn ? '资源页' : '登录'}
        onRightClick={() => {
          if (loggedIn) {
            goResources();
            return;
          }

          Taro.navigateTo({ url: PAGE_ROUTES.login });
        }}
      />

      <AuthStatusCard
        loggedIn={loggedIn}
        userName={user?.name}
        guestTitle='登录后查看订单与支付进度'
        guestDescription='游客态不展示私有订单，登录后统一查看资源购买、到账和退款状态。'
        authedTitle='支付与退款链路已接入'
        authedDescription='订单页已经接入真实支付、退款申请和退款结果页，后续状态会持续同步。'
        guestActionText='去登录'
        authedActionText='去资源页'
        onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        onAuthedAction={goResources}
      />

      {status === 'auth_expired' ? (
        <View className='section'>
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='订单列表需要有效身份才能读取，请重新登录后继续查看。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        </View>
      ) : null}

      {status === 'auth_expired' ? null : loggedIn ? (
        <>
          <View className='surface-card section'>
            <View className='stats-grid'>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>{orders.length}</Text>
                <Text className='stats-grid__label'>订单总数</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>{summary.paidCount}</Text>
                <Text className='stats-grid__label'>已完成</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>{summary.pendingCount}</Text>
                <Text className='stats-grid__label'>待支付</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>{summary.refundCount}</Text>
                <Text className='stats-grid__label'>退款相关</Text>
              </View>
            </View>
            <Text className='page-subtitle' style={{ marginTop: '18px' }}>
              当前累计订单金额 {formatAmount(summary.totalAmount)}
            </Text>
          </View>

          <View className='section'>
            <View className='stack'>
              {status === 'loading' ? (
                <RequestStateCard
                  mode='loading'
                  title='正在同步订单状态'
                  description='正在拉取支付、到账和退款进度。'
                />
              ) : status === 'error' ? (
                <RequestStateCard
                  mode='error'
                  title='订单加载失败'
                  description={errorMessage}
                  actionText='重新加载'
                  onAction={() => void reloadOrders()}
                />
              ) : orders.length === 0 ? (
                <EmptyState
                  title='暂时没有订单'
                  description='从资源页领取或购买后，这里会展示完整订单状态与到账进度。'
                  actionText='去资源页'
                  onAction={goResources}
                />
              ) : (
                orders.map((item) => (
                  <View key={item.id} className='surface-card stack'>
                    <View
                      className='interactive-card'
                      onClick={() =>
                        item.resourceId
                          ? Taro.navigateTo({ url: buildResourceDetailRoute(item.resourceId) })
                          : undefined
                      }
                      hoverClass='pressable--hover'
                    >
                      <View className='split-row'>
                        <Text className='tag tag--strong'>{item.status}</Text>
                        <Text className='metric-text'>{item.createdAt}</Text>
                      </View>
                      <Text className='menu-row__title' style={{ marginTop: '14px' }}>
                        {item.title}
                      </Text>
                      <Text className='menu-row__desc'>
                        {item.coverLabel} · {item.itemType === 'resource' ? '资源' : '服务'}
                      </Text>
                      <Text className='page-title' style={{ fontSize: '34px', marginTop: '14px' }}>
                        {formatAmount(item.amount)}
                      </Text>
                      {item.paidAt ? (
                        <Text className='menu-row__desc' style={{ marginTop: '10px' }}>
                          支付完成于 {item.paidAt}
                        </Text>
                      ) : null}
                      {item.refundRequestedAt ? (
                        <Text className='menu-row__desc' style={{ marginTop: '10px' }}>
                          退款发起于 {item.refundRequestedAt}
                        </Text>
                      ) : null}
                    </View>

                    <View className='order-card__actions'>
                      {item.status === '待支付' ? (
                        <View
                          className='pill-button pill-button--primary'
                          onClick={() => void handlePay(item.id)}
                          hoverClass='pressable--hover'
                        >
                          <Text>立即支付</Text>
                        </View>
                      ) : null}

                      {item.status === '已完成' ? (
                        <View
                          className='pill-button pill-button--outline'
                          onClick={() => void handleRefund(item.id)}
                          hoverClass='pressable--hover'
                        >
                          <Text>申请退款</Text>
                        </View>
                      ) : null}

                      {item.status === '退款中' || item.status === '已退款' ? (
                        <View
                          className='pill-button pill-button--ghost'
                          onClick={() => openRefundResult(item.id)}
                          hoverClass='pressable--hover'
                        >
                          <Text>{item.status === '退款中' ? '查看退款进度' : '查看退款结果'}</Text>
                        </View>
                      ) : null}

                      {item.status === '退款中' ? (
                        <Text className='metric-text'>退款处理中，结果页会自动轮询最新状态。</Text>
                      ) : null}

                      {item.status === '已退款' ? (
                        <Text className='metric-text'>
                          {item.refundCompletedAt
                            ? `退款已完成：${item.refundCompletedAt}`
                            : '退款已完成，相关资产已同步更新。'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </>
      ) : (
        <View className='section'>
          <EmptyState
            title='游客态暂不展示订单列表'
            description='登录后统一查看资源购买、支付状态、退款进度和后续到账结果。'
            actionText='去登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        </View>
      )}
    </View>
  );
}
