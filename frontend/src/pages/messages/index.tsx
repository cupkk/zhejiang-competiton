import { useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { ChipTabs } from '../../components/ChipTabs';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { MESSAGE_CATEGORY_OPTIONS } from '../../constants/enums';
import { buildMessageTargetRoute, PAGE_ROUTES } from '../../constants/routes';
import { useProtectedRequest } from '../../hooks/useProtectedRequest';
import {
  fetchMessages,
  markNotificationRead,
  markNotificationsRead,
} from '../../services/app-service';
import type { MessageCategory, NotificationItem } from '../../types/entities';
import { showPendingToast, showSuccessToast } from '../../utils/feedback';
import { getRequestErrorMessage, isAuthExpiredError } from '../../utils/request-error';

const messageBenefits = [
  '组队申请、招募反馈和队友留言会统一收口。',
  '审核结果、订单进度和资源到账状态会集中提醒。',
  '后续接入订阅消息后，站内与微信提醒会共用同一套状态。',
];

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<MessageCategory>(MESSAGE_CATEGORY_OPTIONS[0]);
  const {
    user,
    loggedIn,
    data: messages,
    setData: setMessages,
    status,
    errorMessage,
    reload: reloadMessages,
    refreshSession,
  } = useProtectedRequest<NotificationItem[]>({
    initialData: () => [],
    errorMessage: '消息加载失败，请稍后重试。',
    request: () => fetchMessages({ category: activeTab }),
    deps: [activeTab],
  });

  const unreadIds = useMemo(
    () => messages.filter((item) => item.unread).map((item) => item.id),
    [messages]
  );

  const markVisibleAsReadLocally = (ids: string[]) => {
    const idSet = new Set(ids);
    setMessages((current) =>
      current.map((entry) => (idSet.has(entry.id) ? { ...entry, unread: false } : entry))
    );
  };

  const restoreVisibleAsUnreadLocally = (ids: string[]) => {
    const idSet = new Set(ids);
    setMessages((current) =>
      current.map((entry) => (idSet.has(entry.id) ? { ...entry, unread: true } : entry))
    );
  };

  const handleOpen = async (item: NotificationItem) => {
    if (item.unread) {
      markVisibleAsReadLocally([item.id]);

      try {
        await markNotificationRead(item.id);
        void refreshSession();
      } catch (error) {
        restoreVisibleAsUnreadLocally([item.id]);
        showPendingToast(getRequestErrorMessage(error, '消息状态更新失败，请稍后重试。'));

        if (isAuthExpiredError(error)) {
          Taro.navigateTo({ url: PAGE_ROUTES.login });
          return;
        }
      }
    }

    const targetRoute = buildMessageTargetRoute(item);
    if (targetRoute) {
      Taro.navigateTo({ url: targetRoute });
      return;
    }

    Taro.showToast({
      title: '当前消息暂时没有可跳转目标',
      icon: 'none',
    });
  };

  const handleMarkVisibleRead = async () => {
    if (unreadIds.length === 0) {
      showPendingToast('当前列表已经全部读过了');
      return;
    }

    markVisibleAsReadLocally(unreadIds);

    try {
      const result = await markNotificationsRead({
        ids: unreadIds,
      });
      void refreshSession();
      showSuccessToast(result.updatedCount > 0 ? '当前列表已批量已读' : '没有新的未读消息');
    } catch (error) {
      restoreVisibleAsUnreadLocally(unreadIds);
      showPendingToast(getRequestErrorMessage(error, '批量已读失败，请稍后重试。'));

      if (isAuthExpiredError(error)) {
        Taro.navigateTo({ url: PAGE_ROUTES.login });
      }
    }
  };

  const handleMarkAllRead = async () => {
    const previousMessages = messages;
    setMessages((current) => current.map((entry) => ({ ...entry, unread: false })));

    try {
      const result = await markNotificationsRead({ all: true });
      void refreshSession();
      showSuccessToast(result.updatedCount > 0 ? '全部消息已读完成' : '当前没有新的未读消息');
    } catch (error) {
      setMessages(previousMessages);
      showPendingToast(getRequestErrorMessage(error, '全部已读失败，请稍后重试。'));

      if (isAuthExpiredError(error)) {
        Taro.navigateTo({ url: PAGE_ROUTES.login });
      }
    }
  };

  return (
    <View className='page-shell'>
      <TopBar
        title='消息中心'
        rightText={loggedIn ? '全部已读' : '登录'}
        onRightClick={() => {
          if (!loggedIn) {
            Taro.navigateTo({ url: PAGE_ROUTES.login });
            return;
          }

          void handleMarkAllRead();
        }}
      />

      <AuthStatusCard
        loggedIn={loggedIn}
        userName={user?.name}
        guestTitle='登录后统一处理站内提醒'
        guestDescription='游客态不展示私有消息流，登录后集中查看组队申请、审核通知和订单进度。'
        authedTitle='消息链路已就绪'
        authedDescription='新的组队申请、审核提醒和订单进度会在这里集中承接。'
        guestActionText='去登录'
        authedActionText='回到我的'
        onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        onAuthedAction={() => Taro.switchTab({ url: PAGE_ROUTES.profile })}
      />

      {status === 'auth_expired' ? (
        <View className='section'>
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='消息列表需要有效身份才能读取，请重新登录后继续查看。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        </View>
      ) : null}

      {status === 'auth_expired' ? null : loggedIn ? (
        <>
          <View className='surface-card section'>
            <Text className='page-subtitle' style={{ marginTop: '0' }}>
              重要动作的站内提醒会优先收口在这里，后续再接微信订阅消息。
            </Text>
          </View>

          <ChipTabs
            items={MESSAGE_CATEGORY_OPTIONS}
            active={activeTab}
            onChange={(value) => setActiveTab(value as MessageCategory)}
            className='section'
          />

          {status === 'success' && messages.length > 0 ? (
            <View className='section'>
              <View style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <View
                  className='pill-button pill-button--ghost'
                  onClick={() => void handleMarkVisibleRead()}
                  hoverClass='pressable--hover'
                >
                  <Text>当前列表批量已读</Text>
                </View>
                <View
                  className='pill-button pill-button--ghost'
                  onClick={() => void handleMarkAllRead()}
                  hoverClass='pressable--hover'
                >
                  <Text>全部已读</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View className='section'>
            <View className='stack'>
              {status === 'loading' ? (
                <RequestStateCard
                  mode='loading'
                  title='正在拉取消息流'
                  description='正在同步组队提醒、审核结果和订单通知。'
                />
              ) : status === 'error' ? (
                <RequestStateCard
                  mode='error'
                  title='消息加载失败'
                  description={errorMessage}
                  actionText='重新加载'
                  onAction={() => void reloadMessages()}
                />
              ) : messages.length === 0 ? (
                <EmptyState
                  title='当前没有消息'
                  description='等有新的审核、订单或组队动态时，这里会出现提醒。'
                />
              ) : (
                messages.map((item) => (
                  <View
                    key={item.id}
                    className={`message-card interactive-card ${item.unread ? '' : 'message-card--read'}`.trim()}
                    onClick={() => void handleOpen(item)}
                    hoverClass='pressable--hover'
                  >
                    <View className='message-card__body'>
                      <View className='split-row'>
                        <View className='menu-row__meta'>
                          <Text className='tag tag--strong'>{item.category}</Text>
                          {item.unread ? <View className='message-card__dot' /> : null}
                        </View>
                        <Text className='metric-text'>{item.time}</Text>
                      </View>
                      <Text className='menu-row__title' style={{ marginTop: '14px' }}>
                        {item.title}
                      </Text>
                      <Text className='detail-paragraph' style={{ marginTop: '10px', fontSize: '22px' }}>
                        {item.content}
                      </Text>
                      <Text className='message-card__cta'>{item.ctaText}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </>
      ) : (
        <>
          <View className='surface-card section stack'>
            <Text className='section-title__text' style={{ fontSize: '28px' }}>
              登录后你会在这里看到
            </Text>
            {messageBenefits.map((item, index) => (
              <View key={item} className='step-row'>
                <View className='step-row__index'>
                  <Text>{index + 1}</Text>
                </View>
                <Text className='step-row__text'>{item}</Text>
              </View>
            ))}
          </View>

          <View className='section'>
            <EmptyState
              title='游客态暂不展示消息列表'
              description='登录后集中查看组队申请、审核结果、订单提醒和系统通知。'
              actionText='去登录'
              onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
            />
          </View>
        </>
      )}
    </View>
  );
}
