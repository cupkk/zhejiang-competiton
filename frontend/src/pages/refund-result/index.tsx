import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { buildResourceDetailRoute, PAGE_ROUTES } from '../../constants/routes';
import { useProtectedRequest } from '../../hooks/useProtectedRequest';
import { fetchOrderDetail } from '../../services/app-service';
import type { OrderItem } from '../../types/entities';

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

export default function RefundResultPage() {
  const router = useRouter();
  const orderId = router.params.id ?? '';
  const [lastSyncAt, setLastSyncAt] = useState('');
  const {
    loggedIn,
    data: order,
    status,
    errorMessage,
    reload,
  } = useProtectedRequest<OrderItem | null>({
    initialData: null,
    errorMessage: '退款结果加载失败，请稍后重试。',
    request: () => fetchOrderDetail(orderId),
    enabled: Boolean(orderId),
  });

  useEffect(() => {
    if (status === 'success') {
      setLastSyncAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    }
  }, [status, order?.status]);

  useEffect(() => {
    if (!loggedIn || status !== 'success' || order?.status !== '退款中') {
      return;
    }

    const timer = setInterval(() => {
      void reload();
    }, 3000);

    return () => clearInterval(timer);
  }, [loggedIn, order?.status, reload, status]);

  const statusCopy = useMemo(() => {
    if (!order) {
      return {
        title: '订单不存在',
        description: '没有找到对应订单，请返回订单页重新选择。',
      };
    }

    if (order.status === '退款中') {
      return {
        title: '退款处理中',
        description: '系统正在轮询最新退款状态，支付平台完成处理后会自动刷新这里的结果。',
      };
    }

    if (order.status === '已退款') {
      return {
        title: '退款已完成',
        description: '这笔订单已经完成退款，相关资源权限也会同步回收。',
      };
    }

    return {
      title: '当前订单未进入退款流程',
      description: '如果你刚提交退款，可以返回订单页重新发起，或稍后再试。',
    };
  }, [order]);

  return (
    <View className='page-shell page-shell--detail'>
      <TopBar
        title='退款结果'
        rightText='订单页'
        onRightClick={() => Taro.navigateBack({ delta: 1 })}
      />

      {!orderId ? (
        <View className='section'>
          <EmptyState
            title='缺少订单参数'
            description='当前页面需要订单 ID 才能查询退款结果。'
            actionText='返回订单页'
            onAction={() => Taro.redirectTo({ url: PAGE_ROUTES.orders })}
          />
        </View>
      ) : status === 'loading' ? (
        <View className='section'>
          <RequestStateCard
            mode='loading'
            title='正在同步退款结果'
            description='正在获取订单状态、退款编号和最新处理进度。'
          />
        </View>
      ) : status === 'error' ? (
        <View className='section'>
          <RequestStateCard
            mode='error'
            title='退款结果加载失败'
            description={errorMessage}
            actionText='重新加载'
            onAction={() => void reload()}
          />
        </View>
      ) : status === 'auth_expired' ? (
        <View className='section'>
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='重新登录后才能继续查看退款进度。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        </View>
      ) : !order ? (
        <View className='section'>
          <EmptyState
            title='没有找到订单'
            description='当前订单可能已不存在，或者你没有访问权限。'
            actionText='返回订单页'
            onAction={() => Taro.redirectTo({ url: PAGE_ROUTES.orders })}
          />
        </View>
      ) : (
        <>
          <View className='surface-card section stack'>
            <View className='split-row'>
              <Text className='tag tag--strong'>{order.status}</Text>
              <Text className='metric-text'>{lastSyncAt ? `最近同步 ${lastSyncAt}` : '等待同步'}</Text>
            </View>
            <Text className='page-title' style={{ fontSize: '38px' }}>
              {statusCopy.title}
            </Text>
            <Text className='page-subtitle'>{statusCopy.description}</Text>

            <View className='refund-result-card__meta'>
              <View className='refund-result-card__cell'>
                <Text className='refund-result-card__label'>订单标题</Text>
                <Text className='refund-result-card__value'>{order.title}</Text>
              </View>
              <View className='refund-result-card__cell'>
                <Text className='refund-result-card__label'>订单金额</Text>
                <Text className='refund-result-card__value'>{formatAmount(order.amount)}</Text>
              </View>
              <View className='refund-result-card__cell'>
                <Text className='refund-result-card__label'>退款编号</Text>
                <Text className='refund-result-card__value'>{order.refundId || '等待生成'}</Text>
              </View>
              <View className='refund-result-card__cell'>
                <Text className='refund-result-card__label'>退款发起时间</Text>
                <Text className='refund-result-card__value'>{order.refundRequestedAt || '尚未发起'}</Text>
              </View>
            </View>

            {order.refundReason ? (
              <View className='refund-result-card__cell'>
                <Text className='refund-result-card__label'>退款原因</Text>
                <Text className='refund-result-card__value'>{order.refundReason}</Text>
              </View>
            ) : null}

            {order.status === '已退款' && order.refundCompletedAt ? (
              <View className='refund-result-card__cell'>
                <Text className='refund-result-card__label'>退款完成时间</Text>
                <Text className='refund-result-card__value'>{order.refundCompletedAt}</Text>
              </View>
            ) : null}
          </View>

          <View className='surface-card section stack'>
            <Text className='section-title__text'>后续动作</Text>
            <View className='order-card__actions'>
              <View
                className='pill-button pill-button--outline'
                onClick={() => void reload()}
                hoverClass='pressable--hover'
              >
                <Text>手动刷新</Text>
              </View>
              <View
                className='pill-button pill-button--ghost'
                onClick={() => Taro.navigateBack({ delta: 1 })}
                hoverClass='pressable--hover'
              >
                <Text>返回订单页</Text>
              </View>
              {order.resourceId ? (
                <View
                  className='pill-button pill-button--primary'
                  onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(order.resourceId) })}
                  hoverClass='pressable--hover'
                >
                  <Text>查看关联资源</Text>
                </View>
              ) : null}
            </View>
            {order.status === '退款中' ? (
              <Text className='metric-text'>轮询每 3 秒自动刷新一次，直到支付平台返回最终结果。</Text>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}
