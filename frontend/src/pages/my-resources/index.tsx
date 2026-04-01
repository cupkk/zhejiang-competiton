import { useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { buildResourceDetailRoute, PAGE_ROUTES } from '../../constants/routes';
import { useProtectedRequest } from '../../hooks/useProtectedRequest';
import {
  createResourceDownload,
  fetchOwnedResources,
} from '../../services/app-service';
import type { OwnedResourceItem } from '../../types/entities';
import { downloadGrantedResource } from '../../utils/download';
import { showPendingToast } from '../../utils/feedback';
import { executeMutation } from '../../utils/mutation';

export default function MyResourcesPage() {
  const {
    user,
    loggedIn,
    data: list,
    status,
    errorMessage,
    reload: reloadResources,
  } = useProtectedRequest<OwnedResourceItem[]>({
    initialData: () => [],
    errorMessage: '资源资产加载失败，请稍后重试。',
    request: () => fetchOwnedResources(),
  });

  const summary = useMemo(() => {
    const freeCount = list.filter((item) => item.accessType === 'free').length;
    const paidCount = list.filter((item) => item.accessType === 'paid').length;
    const totalDownloads = list.reduce((total, item) => total + item.downloadCount, 0);

    return {
      freeCount,
      paidCount,
      totalDownloads,
    };
  }, [list]);

  const goResources = () => {
    Taro.switchTab({ url: PAGE_ROUTES.resources });
  };

  const handleDownload = async (resourceId: string) => {
    const result = await executeMutation({
      task: () => createResourceDownload(resourceId),
      loadingTitle: '准备下载',
      successMessage: '下载授权已刷新',
      fallbackErrorMessage: '下载授权获取失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    try {
      await downloadGrantedResource(result);
      await reloadResources();
    } catch (error) {
      showPendingToast(error instanceof Error ? error.message : '下载资源失败，请稍后重试。');
    }
  };

  return (
    <View className='page-shell'>
      <TopBar
        title='我的资源'
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
        guestTitle='登录后查看已获取资源'
        guestDescription='游客态不展示私有资源资产，登录后集中查看领取、购买和下载记录。'
        authedTitle='你的资源资产已收口'
        authedDescription='这里已经接上真实下载授权接口，领取和购买后的资料都可以继续下载。'
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
            description='资源资产需要有效身份才能读取，请重新登录后继续查看。'
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
                <Text className='stats-grid__value'>{list.length}</Text>
                <Text className='stats-grid__label'>资源总数</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>{summary.freeCount}</Text>
                <Text className='stats-grid__label'>免费领取</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>{summary.paidCount}</Text>
                <Text className='stats-grid__label'>付费购买</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>{summary.totalDownloads}</Text>
                <Text className='stats-grid__label'>累计下载</Text>
              </View>
            </View>
          </View>

          <View className='section'>
            <View className='stack'>
              {status === 'loading' ? (
                <RequestStateCard
                  mode='loading'
                  title='正在同步资源资产'
                  description='正在拉取你已领取、已购买和可继续下载的资料。'
                />
              ) : status === 'error' ? (
                <RequestStateCard
                  mode='error'
                  title='资源资产加载失败'
                  description={errorMessage}
                  actionText='重新加载'
                  onAction={() => void reloadResources()}
                />
              ) : list.length === 0 ? (
                <EmptyState
                  title='还没有已获取资源'
                  description='可以先去资源页领取免费资料，或购买适合你的模板与服务。'
                  actionText='去资源页'
                  onAction={goResources}
                />
              ) : (
                list.map((item) => (
                  <View key={item.id} className='surface-card stack'>
                    <View
                      className='interactive-card'
                      onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(item.resourceId) })}
                      hoverClass='pressable--hover'
                    >
                      <View className='split-row'>
                        <Text className='tag tag--strong'>
                          {item.accessType === 'free' ? '免费领取' : '已购买'}
                        </Text>
                        <Text className='metric-text'>已下载 {item.downloadCount} 次</Text>
                      </View>
                      <Text className='menu-row__title' style={{ marginTop: '14px' }}>
                        {item.title}
                      </Text>
                      <Text className='menu-row__desc'>
                        {item.type} · 获取于 {item.acquiredAt}
                      </Text>
                      <View className='tag-row' style={{ marginTop: '14px' }}>
                        {item.tags.map((tag) => (
                          <Text key={tag} className='tag'>
                            {tag}
                          </Text>
                        ))}
                      </View>
                    </View>

                    <View className='resource-asset-card__actions'>
                      <View
                        className='pill-button pill-button--outline'
                        onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(item.resourceId) })}
                        hoverClass='pressable--hover'
                      >
                        <Text>查看详情</Text>
                      </View>
                      <View
                        className='pill-button pill-button--primary'
                        onClick={() => void handleDownload(item.resourceId)}
                        hoverClass='pressable--hover'
                      >
                        <Text>继续下载</Text>
                      </View>
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
            title='游客态暂不展示资源资产'
            description='登录后才会显示你已领取、已购买和可继续下载的资料。'
            actionText='去登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        </View>
      )}
    </View>
  );
}
