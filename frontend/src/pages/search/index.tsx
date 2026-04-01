import { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { ChipTabs } from '../../components/ChipTabs';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { SearchBar } from '../../components/SearchBar';
import { TopBar } from '../../components/TopBar';
import {
  SEARCH_SCOPE_TABS,
  SEARCH_SCOPE_TAB_TO_VALUE,
  SEARCH_SCOPE_VALUE_TO_TAB,
} from '../../constants/enums';
import { PAGE_ROUTES } from '../../constants/routes';
import { useRequestState } from '../../hooks/useRequestState';
import { fetchSearchSuggestions, searchContent } from '../../services/app-service';
import type { SearchResultItem, SearchScope, SearchSuggestion } from '../../types/entities';

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState(router.params.keyword ?? '');
  const [activeScope, setActiveScope] = useState<(typeof SEARCH_SCOPE_TABS)[number]>(
    SEARCH_SCOPE_VALUE_TO_TAB[(router.params.scope as SearchScope) || 'all']
  );
  const {
    data: suggestions,
    status: suggestionStatus,
    errorMessage: suggestionError,
    run: runSuggestions,
  } = useRequestState<SearchSuggestion[]>({
    initialData: () => [],
    errorMessage: '搜索建议加载失败，请稍后重试。',
  });
  const {
    data: results,
    status: searchStatus,
    errorMessage: searchError,
    run: runSearchRequest,
    reset: resetSearchResults,
  } = useRequestState<SearchResultItem[]>({
    initialData: () => [],
    errorMessage: '搜索失败，请稍后重试。',
  });

  const loadSuggestions = useCallback(async () => {
    await runSuggestions(() => fetchSearchSuggestions());
  }, [runSuggestions]);

  const runSearch = useCallback(
    async (nextKeyword = keyword, nextScope = activeScope) => {
      const trimmed = nextKeyword.trim();
      if (!trimmed) {
        resetSearchResults([], 'idle');
        return;
      }

      await runSearchRequest(() => searchContent({ keyword: trimmed, scope: SEARCH_SCOPE_TAB_TO_VALUE[nextScope] }));
    },
    [activeScope, keyword, resetSearchResults, runSearchRequest]
  );

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (router.params.keyword?.trim()) {
      void runSearch(router.params.keyword, activeScope);
    }
  }, []);

  useEffect(() => {
    if (keyword.trim()) {
      void runSearch(keyword, activeScope);
    }
  }, [activeScope]);

  return (
    <View className='page-shell'>
      <TopBar title='全站搜索' />

      <SearchBar
        placeholder='搜索竞赛、资源、帖子、组队'
        value={keyword}
        actionText='确定'
        onChange={setKeyword}
        onConfirm={() => void runSearch()}
        onAction={() => void runSearch()}
      />

      <ChipTabs
        items={[...SEARCH_SCOPE_TABS]}
        active={activeScope}
        onChange={(value) => setActiveScope(value as (typeof SEARCH_SCOPE_TABS)[number])}
        className='section'
      />

      {!keyword.trim() ? (
        <View className='section'>
          {suggestionStatus === 'loading' ? (
            <RequestStateCard
              mode='loading'
              title='正在加载搜索建议'
              description='正在同步热门搜索词和默认检索入口。'
            />
          ) : suggestionStatus === 'error' ? (
            <RequestStateCard
              mode='error'
              title='搜索建议加载失败'
              description={suggestionError}
              actionText='重新加载'
              onAction={() => void loadSuggestions()}
            />
          ) : suggestionStatus === 'auth_expired' ? (
            <RequestStateCard
              mode='auth_expired'
              title='登录状态已失效'
              description='重新登录后可以继续同步你的搜索偏好。'
              actionText='重新登录'
              onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
            />
          ) : (
            <View className='surface-card stack'>
              <Text className='section-title__text' style={{ fontSize: '28px' }}>
                热门搜索
              </Text>
              <View className='tag-row'>
                {suggestions.map((item) => (
                  <Text
                    key={item.id}
                    className='tag tag--strong'
                    onClick={() => {
                      setKeyword(item.label);
                      const tab = SEARCH_SCOPE_VALUE_TO_TAB[item.scope];
                      setActiveScope(tab);
                      void runSearch(item.label, tab);
                    }}
                  >
                    {item.label}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : (
        <View className='section'>
          <View className='stack'>
            {searchStatus === 'loading' ? (
              <RequestStateCard
                mode='loading'
                title='正在搜索内容'
                description='正在检索竞赛、资源、帖子和组队信息。'
              />
            ) : searchStatus === 'error' ? (
              <RequestStateCard
                mode='error'
                title='搜索失败'
                description={searchError}
                actionText='重新搜索'
                onAction={() => void runSearch()}
              />
            ) : searchStatus === 'auth_expired' ? (
              <RequestStateCard
                mode='auth_expired'
                title='登录状态已失效'
                description='重新登录后可以继续同步你的搜索结果和偏好。'
                actionText='重新登录'
                onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
              />
            ) : results.length === 0 ? (
              <EmptyState
                title='没有找到对应内容'
                description='可以换个关键词，或切换搜索范围后重试。'
                actionText='重新搜索'
                onAction={() => void runSearch()}
              />
            ) : (
              results.map((item) => (
                <View
                  key={`${item.scope}-${item.id}`}
                  className='search-result-card interactive-card'
                  onClick={() => Taro.navigateTo({ url: item.link })}
                  hoverClass='pressable--hover'
                >
                  <View className='search-result-card__body'>
                    <View className='split-row'>
                      <Text className='tag tag--strong'>{SEARCH_SCOPE_VALUE_TO_TAB[item.scope]}</Text>
                      <Text className='metric-text'>{item.meta}</Text>
                    </View>
                    <Text className='menu-row__title' style={{ marginTop: '14px' }}>
                      {item.title}
                    </Text>
                    <Text className='menu-row__desc'>{item.subtitle}</Text>
                    <View className='tag-row' style={{ marginTop: '14px' }}>
                      {item.tags.slice(0, 3).map((tag) => (
                        <Text key={tag} className='tag'>
                          {tag}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
}
