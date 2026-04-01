import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { ChipTabs } from '../../components/ChipTabs';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { ResourceCard } from '../../components/ResourceCard';
import { SearchBar } from '../../components/SearchBar';
import {
  COMMON_FILTER_ALL,
  RESOURCE_CATEGORY_OPTIONS,
  RESOURCE_PRICE_OPTIONS,
} from '../../constants/enums';
import { buildResourceDetailRoute, buildSearchRoute, PAGE_ROUTES } from '../../constants/routes';
import { usePageRequest } from '../../hooks/usePageRequest';
import { fetchResourceList } from '../../services/app-service';
import type { ResourceItem, ResourcePriceType } from '../../types/entities';
import { pageTopInset } from '../../utils/layout';

export default function ResourcesPage() {
  const [keyword, setKeyword] = useState('');
  const [priceType, setPriceType] = useState<ResourcePriceType>(RESOURCE_PRICE_OPTIONS[0]);
  const [category, setCategory] = useState<(typeof RESOURCE_CATEGORY_OPTIONS)[number]>(COMMON_FILTER_ALL);
  const {
    data: list,
    status,
    errorMessage,
    reload: reloadResources,
  } = usePageRequest<ResourceItem[]>({
    initialData: () => [],
    errorMessage: '资源列表加载失败，请稍后重试。',
    request: () =>
      fetchResourceList({
        keyword: keyword.trim() || undefined,
        priceType: priceType === COMMON_FILTER_ALL ? undefined : priceType,
        category: category === COMMON_FILTER_ALL ? undefined : category,
      }),
    deps: [keyword, priceType, category],
  });

  const featured = list[0];

  return (
    <View className='page-shell' style={{ paddingTop: `${pageTopInset}px` }}>
      <Text className='page-eyebrow'>资源中心</Text>
      <Text className='page-title'>学习资源库</Text>
      <Text className='page-subtitle'>用更轻的资料、模板和攻略，帮助你更快完成一次真实行动。</Text>

      <SearchBar
        placeholder='搜索资料、模板、真题、攻略'
        value={keyword}
        actionText='全站'
        onChange={setKeyword}
        onAction={() =>
          Taro.navigateTo({ url: buildSearchRoute({ scope: 'resources', keyword: keyword.trim() }) })
        }
      />

      <View className='section'>
        <ChipTabs
          items={RESOURCE_PRICE_OPTIONS}
          active={priceType}
          onChange={(value) => setPriceType(value as ResourcePriceType)}
        />
        <ChipTabs
          items={[...RESOURCE_CATEGORY_OPTIONS]}
          active={category}
          onChange={(value) => setCategory(value as (typeof RESOURCE_CATEGORY_OPTIONS)[number])}
          className='tab-strip--subtle'
        />
      </View>

      {status === 'loading' ? (
        <RequestStateCard
          mode='loading'
          title='正在刷新资源列表'
          description='正在拉取当前筛选条件下的资料、模板和攻略。'
          className='section'
        />
      ) : status === 'error' ? (
        <RequestStateCard
          mode='error'
          title='资源列表加载失败'
          description={errorMessage}
          actionText='重新加载'
          onAction={() => void reloadResources()}
          className='section'
        />
      ) : status === 'auth_expired' ? (
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后可以继续同步你的资源浏览和购买偏好。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      ) : (
        <>
          {featured ? (
            <View className='surface-card resource-summary-card section'>
              <View className='resource-summary-card__cover' style={{ background: featured.coverGradient }}>
                <Text className='resource-summary-card__label'>{featured.coverLabel}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text className='resource-summary-card__title'>{featured.title}</Text>
                <Text className='resource-summary-card__desc'>{featured.suitableFor}</Text>
                <View className='tag-row' style={{ marginTop: '14px' }}>
                  {featured.previewPoints.map((point) => (
                    <Text key={point} className='tag'>
                      {point}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          <View className='section'>
            <View className='stack'>
              {list.length === 0 ? (
                <EmptyState
                  title='没有找到匹配资源'
                  description='试试更短的关键词，或者切换价格和分类。'
                  actionText='重新加载'
                  onAction={() => void reloadResources()}
                />
              ) : (
                list.map((item) => (
                  <ResourceCard
                    key={item.id}
                    resource={item}
                    onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(item.id) })}
                  />
                ))
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}
