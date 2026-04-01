import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { ChipTabs } from '../../components/ChipTabs';
import { CompetitionCard } from '../../components/CompetitionCard';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { SearchBar } from '../../components/SearchBar';
import {
  COMMON_FILTER_ALL,
  COMPETITION_LEVEL_OPTIONS,
  COMPETITION_SORT_OPTIONS,
} from '../../constants/enums';
import {
  buildCompetitionDetailRoute,
  buildSearchRoute,
  PAGE_ROUTES,
} from '../../constants/routes';
import { usePageRequest } from '../../hooks/usePageRequest';
import { fetchCompetitionList } from '../../services/app-service';
import type { Competition, CompetitionSort } from '../../types/entities';
import { pageTopInset } from '../../utils/layout';

export default function CompetitionsPage() {
  const [activeLevel, setActiveLevel] = useState<(typeof COMPETITION_LEVEL_OPTIONS)[number]>(COMMON_FILTER_ALL);
  const [activeSort, setActiveSort] = useState<CompetitionSort>(COMPETITION_SORT_OPTIONS[0]);
  const [keyword, setKeyword] = useState('');
  const {
    data: list,
    status,
    errorMessage,
    reload: reloadCompetitions,
  } = usePageRequest<Competition[]>({
    initialData: () => [],
    errorMessage: '竞赛列表加载失败，请稍后重试。',
    request: () =>
      fetchCompetitionList({
        keyword: keyword.trim() || undefined,
        level: activeLevel === COMMON_FILTER_ALL ? undefined : activeLevel,
        sort: activeSort,
      }),
    deps: [keyword, activeLevel, activeSort],
  });

  const spotlight = list[0];

  return (
    <View className='page-shell' style={{ paddingTop: `${pageTopInset}px` }}>
      <Text className='page-eyebrow'>竞赛情报</Text>
      <Text className='page-title'>竞赛情报库</Text>
      <Text className='page-subtitle'>先判断值不值得做，再决定如何准备、何时组队和从哪条线切入。</Text>

      <SearchBar
        placeholder='搜索竞赛名称、主办方、标签'
        value={keyword}
        actionText='全站'
        onChange={setKeyword}
        onAction={() =>
          Taro.navigateTo({ url: buildSearchRoute({ scope: 'competitions', keyword: keyword.trim() }) })
        }
      />

      <View className='section'>
        <ChipTabs
          items={[...COMPETITION_LEVEL_OPTIONS]}
          active={activeLevel}
          onChange={(value) => setActiveLevel(value as (typeof COMPETITION_LEVEL_OPTIONS)[number])}
        />
        <ChipTabs
          items={COMPETITION_SORT_OPTIONS}
          active={activeSort}
          onChange={(value) => setActiveSort(value as CompetitionSort)}
          className='tab-strip--subtle'
        />
      </View>

      {status === 'loading' ? (
        <RequestStateCard
          mode='loading'
          title='正在刷新竞赛列表'
          description='正在拉取当前筛选条件下的竞赛和推荐结果。'
          className='section'
        />
      ) : status === 'error' ? (
        <RequestStateCard
          mode='error'
          title='竞赛列表加载失败'
          description={errorMessage}
          actionText='重新加载'
          onAction={() => void reloadCompetitions()}
          className='section'
        />
      ) : status === 'auth_expired' ? (
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后可以继续同步你的竞赛浏览和推荐偏好。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      ) : (
        <>
          {spotlight ? (
            <View className='spotlight-card section' style={{ background: spotlight.coverGradient }}>
              <Text className='spotlight-card__eyebrow'>当前推荐</Text>
              <Text className='spotlight-card__title'>{spotlight.title}</Text>
              <Text className='spotlight-card__desc'>
                {spotlight.category} · {spotlight.host} · 还剩 {spotlight.daysLeft} 天
              </Text>
              <View className='tag-row' style={{ marginTop: '16px' }}>
                {spotlight.recommendedFor.slice(0, 3).map((tag) => (
                  <Text key={tag} className='tag tag--muted'>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          <View className='section'>
            <View className='stack'>
              {list.length === 0 ? (
                <EmptyState
                  title='没有找到匹配竞赛'
                  description='换个关键词，或者切换筛选条件再试一次。'
                  actionText='重新加载'
                  onAction={() => void reloadCompetitions()}
                />
              ) : (
                list.map((item) => (
                  <CompetitionCard
                    key={item.id}
                    competition={item}
                    onClick={() => Taro.navigateTo({ url: buildCompetitionDetailRoute(item.id) })}
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
