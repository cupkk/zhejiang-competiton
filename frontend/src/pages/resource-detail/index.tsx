import { useCallback, useEffect, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { CompetitionCard } from '../../components/CompetitionCard';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import {
  buildAiRoute,
  buildCompetitionDetailRoute,
  buildResourceDetailRoute,
  PAGE_ROUTES,
} from '../../constants/routes';
import { getCompetitionById } from '../../data/mock';
import { useRequestState } from '../../hooks/useRequestState';
import { useSessionUser } from '../../hooks/useSessionUser';
import {
  createResourceAcquire,
  createResourceDownload,
  fetchResourceDetail,
  fetchResourceList,
  toggleResourceFavorite,
} from '../../services/app-service';
import type { Competition, ResourceItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { showPendingToast } from '../../utils/feedback';
import { formatPrice } from '../../utils/format';
import { downloadGrantedResource } from '../../utils/download';
import { executeMutation } from '../../utils/mutation';

const fallbackResource: ResourceItem = {
  id: '',
  title: '',
  type: '',
  category: '',
  price: 0,
  downloads: 0,
  rating: 0,
  authorName: '',
  authorMark: '',
  authorTitle: '',
  coverLabel: '',
  coverGradient: 'linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)',
  tags: [],
  description: '',
  sizeLabel: '',
  suitableFor: '',
  previewPoints: [],
  relatedCompetitionIds: [],
};

export default function ResourceDetailPage() {
  const router = useRouter();
  const { user, loggedIn } = useSessionUser();
  const {
    data: resource,
    setData: setResource,
    status: detailStatus,
    errorMessage: detailError,
    run: runDetail,
  } = useRequestState<ResourceItem>({
    initialData: fallbackResource,
    errorMessage: '资源详情加载失败，请稍后重试。',
  });
  const {
    data: relatedResources,
    status: relatedStatus,
    errorMessage: relatedError,
    run: runRelated,
    reset: resetRelated,
  } = useRequestState<ResourceItem[]>({
    initialData: () => [],
    errorMessage: '相关推荐加载失败，请稍后重试。',
  });

  const loadResource = useCallback(async () => {
    await runDetail(() => fetchResourceDetail(router.params.id));
  }, [router.params.id, runDetail]);

  const loadRelatedResources = useCallback(async () => {
    await runRelated(async () => {
      const list = await fetchResourceList({ limit: 3 });
      return list.filter((item) => item.id !== router.params.id).slice(0, 2);
    });
  }, [router.params.id, runRelated]);

  useEffect(() => {
    void loadResource();
  }, [loadResource]);

  useEffect(() => {
    if (!resource.id || detailStatus !== 'success') {
      resetRelated([], 'idle');
      return;
    }

    void loadRelatedResources();
  }, [detailStatus, loadRelatedResources, resetRelated, resource.id]);

  const relatedCompetitions = useMemo<Competition[]>(() => {
    return resource.relatedCompetitionIds.map((id) => getCompetitionById(id));
  }, [resource.relatedCompetitionIds]);

  const handleToggleFavorite = useCallback(async () => {
    if (!ensureLoggedIn({ message: '登录后才能收藏资源' })) {
      return;
    }

    const nextFavorite = !resource.viewer?.isFavorited;
    const result = await executeMutation({
      task: () => toggleResourceFavorite(resource.id, { favorite: nextFavorite }),
      loadingTitle: nextFavorite ? '收藏中' : '取消中',
      successMessage: nextFavorite ? '已收藏资源' : '已取消收藏',
      fallbackErrorMessage: '资源收藏状态更新失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setResource((current) => ({
      ...current,
      viewer: {
        isFavorited: result.favorite,
        accessStatus: current.viewer?.accessStatus ?? 'not_acquired',
      },
    }));
  }, [resource.id, resource.viewer?.isFavorited, setResource]);

  const handleAcquire = useCallback(async () => {
    if (!ensureLoggedIn({ message: '登录后才能领取或购买资源' })) {
      return;
    }

    const accessStatus = resource.viewer?.accessStatus ?? 'not_acquired';
    if (accessStatus === 'owned') {
      const downloadResult = await executeMutation({
        task: () => createResourceDownload(resource.id),
        loadingTitle: '准备下载',
        successMessage: '下载授权已刷新',
        fallbackErrorMessage: '下载授权获取失败，请稍后重试。',
      });

      if (!downloadResult) {
        return;
      }

      try {
        await downloadGrantedResource(downloadResult);
      } catch (error) {
        showPendingToast(error instanceof Error ? error.message : '下载资源失败，请稍后重试。');
      }
      return;
    }

    if (accessStatus === 'pending_payment') {
      Taro.navigateTo({ url: PAGE_ROUTES.orders });
      return;
    }

    const mode = resource.price === 0 ? 'free' : 'paid';
    const result = await executeMutation({
      task: () => createResourceAcquire(resource.id, { mode }),
      loadingTitle: mode === 'free' ? '领取中' : '下单中',
      successMessage: mode === 'free' ? '资源已领取' : '订单已创建',
      fallbackErrorMessage: mode === 'free' ? '资源领取失败，请稍后重试。' : '创建订单失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setResource((current) => ({
      ...current,
      viewer: {
        isFavorited: current.viewer?.isFavorited ?? false,
        accessStatus: result.accessStatus,
      },
    }));

    if (result.accessStatus === 'owned') {
      const downloadResult = await executeMutation({
        task: () => createResourceDownload(resource.id),
        loadingTitle: '准备下载',
        successMessage: '资源已到账，正在打开',
        fallbackErrorMessage: '下载授权获取失败，请稍后重试。',
      });

      if (!downloadResult) {
        return;
      }

      try {
        await downloadGrantedResource(downloadResult);
      } catch (error) {
        showPendingToast(error instanceof Error ? error.message : '下载资源失败，请稍后重试。');
      }
      return;
    }

    setTimeout(() => {
      Taro.navigateTo({ url: PAGE_ROUTES.orders });
    }, 300);
  }, [resource.id, resource.price, resource.viewer?.accessStatus, setResource]);

  if (detailStatus === 'loading') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='资源详情' />
        <RequestStateCard
          mode='loading'
          title='正在加载资源详情'
          description='正在同步资源信息、作者信息和相关推荐。'
          className='section'
        />
      </View>
    );
  }

  if (detailStatus === 'error') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='资源详情' />
        <RequestStateCard
          mode='error'
          title='资源详情加载失败'
          description={detailError}
          actionText='重新加载'
          onAction={() => void loadResource()}
          className='section'
        />
      </View>
    );
  }

  if (detailStatus === 'auth_expired') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='资源详情' />
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后可以继续同步资源详情和你的资源操作状态。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      </View>
    );
  }

  return (
    <View className='page-shell page-shell--detail'>
      <TopBar title='资源详情' rightText='分享' onRightClick={() => showPendingToast('分享能力接入中')} />

      <View className='surface-card stack'>
        <View className='cover-block' style={{ background: resource.coverGradient }}>
          <Text className='cover-block__label'>{resource.type}</Text>
          <Text className='cover-block__title'>{resource.title}</Text>
          <Text className='cover-block__meta'>{resource.suitableFor}</Text>
        </View>

        <View className='detail-summary'>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>价格</Text>
            <Text className='detail-summary__value'>{formatPrice(resource.price)}</Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>下载</Text>
            <Text className='detail-summary__value'>{resource.downloads}</Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>评分</Text>
            <Text className='detail-summary__value'>{resource.rating}</Text>
          </View>
        </View>

        <View className='split-row'>
          <View className='menu-row__meta'>
            <View className='avatar'>
              <Text>{resource.authorMark}</Text>
            </View>
            <View>
              <Text className='menu-row__title'>{resource.authorName}</Text>
              <Text className='menu-row__desc'>{resource.authorTitle}</Text>
            </View>
          </View>
          <View className='pill-button pill-button--ghost' style={{ height: '62px' }}>
            <Text>{resource.sizeLabel}</Text>
          </View>
        </View>
      </View>

      <View
        className='surface-card section resource-detail__helper interactive-card'
        onClick={() => Taro.navigateTo({ url: buildAiRoute({ source: 'resource', id: resource.id }) })}
        hoverClass='pressable--hover'
      >
        <View className='menu-row__meta'>
          <View className='helper-badge'>
            <Text>AI</Text>
          </View>
          <View className='helper-copy'>
            <Text className='helper-copy__title'>AI 解析这个资源现在值不值得用</Text>
            <Text className='helper-copy__desc'>告诉我你的方向和阶段，我帮你判断是否该现在就下手。</Text>
          </View>
        </View>
        <Text className='metric-text metric-text--strong'>进入</Text>
      </View>

      <AuthStatusCard
        className='section'
        loggedIn={loggedIn}
        userName={loggedIn ? user?.name : undefined}
        guestTitle='登录后再走资源领取和购买'
        guestDescription='资源获取、订单状态、下载权限和后续退款都会依赖登录态，这里已经预留好了真实接口入口。'
        authedTitle='当前账号可直接承接资源链路'
        authedDescription='你现在可以领取、购买和记录订单，后面只需要把支付与下载接口切到真实后端。'
        guestActionText='去登录'
        authedActionText='查看我的资源'
        onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        onAuthedAction={() => Taro.navigateTo({ url: PAGE_ROUTES.myResources })}
      />

      <View className='surface-card section stack'>
        <View className='info-grid'>
          <View className='info-item'>
            <Text className='info-item__label'>文件格式</Text>
            <Text className='info-item__value'>{resource.type}</Text>
          </View>
          <View className='info-item'>
            <Text className='info-item__label'>文件大小</Text>
            <Text className='info-item__value'>{resource.sizeLabel}</Text>
          </View>
        </View>

        <View>
          <Text className='section-title__text' style={{ fontSize: '28px' }}>
            资源简介
          </Text>
          <Text className='detail-paragraph' style={{ marginTop: '14px' }}>
            {resource.description}
          </Text>
        </View>

        <View>
          <Text className='section-title__text' style={{ fontSize: '28px' }}>
            你将获得
          </Text>
          <View className='stack' style={{ marginTop: '14px' }}>
            {resource.previewPoints.map((item, index) => (
              <View key={item} className='step-row'>
                <View className='step-row__index'>
                  <Text>{index + 1}</Text>
                </View>
                <Text className='step-row__text'>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {relatedCompetitions.length > 0 ? (
        <View className='section'>
          <Text className='section-title__text'>相关竞赛</Text>
          <View className='stack' style={{ marginTop: '18px' }}>
            {relatedCompetitions.map((item) => (
              <CompetitionCard
                key={item.id}
                competition={item}
                onClick={() => Taro.navigateTo({ url: buildCompetitionDetailRoute(item.id) })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View className='section'>
        <Text className='section-title__text'>相关推荐</Text>
        <View className='stack' style={{ marginTop: '18px' }}>
          {relatedStatus === 'loading' ? (
            <RequestStateCard
              mode='loading'
              title='正在加载相关推荐'
              description='正在同步相近类型的资料、模板和攻略。'
            />
          ) : relatedStatus === 'error' ? (
            <RequestStateCard
              mode='error'
              title='相关推荐加载失败'
              description={relatedError}
              actionText='重新加载'
              onAction={() => void loadRelatedResources()}
            />
          ) : relatedStatus === 'auth_expired' ? (
            <RequestStateCard
              mode='auth_expired'
              title='登录状态已失效'
              description='重新登录后可以继续同步相关推荐。'
              actionText='重新登录'
              onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
            />
          ) : (
            relatedResources.map((item) => (
              <View
                key={item.id}
                className='surface-card surface-card--compact interactive-card'
                onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(item.id) })}
                hoverClass='pressable--hover'
              >
                <Text className='menu-row__title'>{item.title}</Text>
                <Text className='menu-row__desc'>
                  {item.type} · {formatPrice(item.price)} · {item.downloads} 次下载
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View className='bottom-bar'>
        <View
          className='bottom-bar__minor pill-button pill-button--ghost'
          onClick={() => void handleToggleFavorite()}
          hoverClass='pressable--hover'
        >
          <Text>
            {loggedIn
              ? resource.viewer?.isFavorited
                ? '已收藏'
                : '收藏'
              : '登录后收藏'}
          </Text>
        </View>
        <View
          className='bottom-bar__major pill-button pill-button--primary'
          onClick={() => void handleAcquire()}
          hoverClass='pressable--hover'
        >
          <Text>
            {loggedIn
              ? resource.viewer?.accessStatus === 'owned'
                ? '立即下载资源'
                : resource.viewer?.accessStatus === 'pending_payment'
                  ? '查看待支付订单'
                  : resource.price === 0
                    ? '免费领取'
                    : `${formatPrice(resource.price)} 立即购买`
              : '登录后领取 / 购买'}
          </Text>
        </View>
      </View>
    </View>
  );
}
