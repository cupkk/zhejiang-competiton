import { useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { ChipTabs } from '../../components/ChipTabs';
import { CompetitionCard } from '../../components/CompetitionCard';
import { EmptyState } from '../../components/EmptyState';
import { PostCard } from '../../components/PostCard';
import { RequestStateCard } from '../../components/RequestStateCard';
import { ResourceCard } from '../../components/ResourceCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TopBar } from '../../components/TopBar';
import {
  FAVORITE_SCOPE_TABS,
  FAVORITE_SCOPE_TAB_TO_VALUE,
  FAVORITE_SCOPE_VALUE_TO_TAB,
} from '../../constants/enums';
import {
  buildCompetitionDetailRoute,
  buildPostDetailRoute,
  buildResourceDetailRoute,
  PAGE_ROUTES,
} from '../../constants/routes';
import { useProtectedRequest } from '../../hooks/useProtectedRequest';
import {
  fetchFavorites,
  toggleCompetitionFavorite,
  togglePostFavorite,
  toggleResourceFavorite,
} from '../../services/app-service';
import type {
  Competition,
  FavoriteCollection,
  FavoriteScope,
  PostItem,
  ResourceItem,
} from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { executeMutation } from '../../utils/mutation';

const FAVORITE_SORT_TABS = ['按收藏时间', '按内容类型'] as const;
const FAVORITE_SORT_TAB_TO_VALUE = {
  按收藏时间: 'time',
  按内容类型: 'type',
} as const;

type FavoriteSortTab = (typeof FAVORITE_SORT_TABS)[number];
type FavoriteSortMode = (typeof FAVORITE_SORT_TAB_TO_VALUE)[FavoriteSortTab];
type FavoriteTimelineItem =
  | { id: string; type: 'competition'; favoritedAt?: string; item: Competition }
  | { id: string; type: 'resource'; favoritedAt?: string; item: ResourceItem }
  | { id: string; type: 'post'; favoritedAt?: string; item: PostItem };

const defaultFavorites: FavoriteCollection = {
  competitions: [],
  resources: [],
  posts: [],
};

function resolveInitialTab() {
  const scope = (Taro.getCurrentInstance().router?.params?.scope as FavoriteScope | undefined) || 'all';
  return FAVORITE_SCOPE_VALUE_TO_TAB[scope] ?? FAVORITE_SCOPE_TABS[0];
}

function sortByFavoriteTime<T extends { viewer?: { favoritedAt?: string } }>(items: T[]) {
  return [...items].sort((left, right) =>
    (right.viewer?.favoritedAt || '').localeCompare(left.viewer?.favoritedAt || '')
  );
}

function formatFavoriteTimeLabel(value?: string) {
  if (!value) {
    return '收藏时间待同步';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '最近收藏';
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');

  return `收藏于 ${year}-${month}-${day} ${hour}:${minute}`;
}

function buildTimelineItems(favorites: FavoriteCollection): FavoriteTimelineItem[] {
  return [
    ...favorites.competitions.map((item) => ({
      id: `competition-${item.id}`,
      type: 'competition' as const,
      favoritedAt: item.viewer?.favoritedAt,
      item,
    })),
    ...favorites.resources.map((item) => ({
      id: `resource-${item.id}`,
      type: 'resource' as const,
      favoritedAt: item.viewer?.favoritedAt,
      item,
    })),
    ...favorites.posts.map((item) => ({
      id: `post-${item.id}`,
      type: 'post' as const,
      favoritedAt: item.viewer?.favoritedAt,
      item,
    })),
  ].sort((left, right) => (right.favoritedAt || '').localeCompare(left.favoritedAt || ''));
}

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<(typeof FAVORITE_SCOPE_TABS)[number]>(resolveInitialTab);
  const [activeSortTab, setActiveSortTab] = useState<FavoriteSortTab>(FAVORITE_SORT_TABS[0]);
  const [favoritingCompetitionId, setFavoritingCompetitionId] = useState('');
  const [favoritingResourceId, setFavoritingResourceId] = useState('');
  const [favoritingPostId, setFavoritingPostId] = useState('');

  const scope = FAVORITE_SCOPE_TAB_TO_VALUE[activeTab];
  const sortMode: FavoriteSortMode = FAVORITE_SORT_TAB_TO_VALUE[activeSortTab];

  const {
    data: favorites,
    setData: setFavorites,
    status,
    errorMessage,
    reload,
    loggedIn,
    refreshSession,
  } = useProtectedRequest<FavoriteCollection>({
    initialData: defaultFavorites,
    errorMessage: '收藏列表加载失败，请稍后重试。',
    request: () => fetchFavorites({ scope }),
    deps: [scope],
  });

  useDidShow(() => {
    void reload();
  });

  const sortedFavorites = useMemo(
    () => ({
      competitions: sortByFavoriteTime(favorites.competitions),
      resources: sortByFavoriteTime(favorites.resources),
      posts: sortByFavoriteTime(favorites.posts),
    }),
    [favorites]
  );

  const timelineItems = useMemo(() => buildTimelineItems(sortedFavorites), [sortedFavorites]);
  const totalCount =
    sortedFavorites.competitions.length +
    sortedFavorites.resources.length +
    sortedFavorites.posts.length;

  const removeCompetition = (id: string) => {
    setFavorites((current) => ({
      ...current,
      competitions: current.competitions.filter((item) => item.id !== id),
    }));
  };

  const removeResource = (id: string) => {
    setFavorites((current) => ({
      ...current,
      resources: current.resources.filter((item) => item.id !== id),
    }));
  };

  const removePost = (id: string) => {
    setFavorites((current) => ({
      ...current,
      posts: current.posts.filter((item) => item.id !== id),
    }));
  };

  const handleToggleCompetitionFavorite = async (competition: Competition) => {
    if (!ensureLoggedIn({ message: '登录后才能维护收藏列表' })) {
      return;
    }

    setFavoritingCompetitionId(competition.id);
    const result = await executeMutation({
      task: () => toggleCompetitionFavorite(competition.id, { favorite: false }),
      loadingTitle: '取消收藏',
      successMessage: '已从我的收藏移除',
      fallbackErrorMessage: '竞赛收藏状态更新失败，请稍后重试。',
    });
    setFavoritingCompetitionId('');

    if (!result) {
      return;
    }

    removeCompetition(competition.id);
    void refreshSession();
  };

  const handleToggleResourceFavorite = async (resource: ResourceItem) => {
    if (!ensureLoggedIn({ message: '登录后才能维护收藏列表' })) {
      return;
    }

    setFavoritingResourceId(resource.id);
    const result = await executeMutation({
      task: () => toggleResourceFavorite(resource.id, { favorite: false }),
      loadingTitle: '取消收藏',
      successMessage: '已从我的收藏移除',
      fallbackErrorMessage: '资源收藏状态更新失败，请稍后重试。',
    });
    setFavoritingResourceId('');

    if (!result) {
      return;
    }

    removeResource(resource.id);
    void refreshSession();
  };

  const handleTogglePostFavorite = async (post: PostItem) => {
    if (!ensureLoggedIn({ message: '登录后才能维护收藏列表' })) {
      return;
    }

    setFavoritingPostId(post.id);
    const result = await executeMutation({
      task: () => togglePostFavorite(post.id, { favorite: false }),
      loadingTitle: '取消收藏',
      successMessage: '已从我的收藏移除',
      fallbackErrorMessage: '帖子收藏状态更新失败，请稍后重试。',
    });
    setFavoritingPostId('');

    if (!result) {
      return;
    }

    removePost(post.id);
    void refreshSession();
  };

  const renderCompetitionList = (items: Competition[]) =>
    items.length === 0 ? (
      <EmptyState
        title='还没有收藏竞赛'
        description='看到合适的比赛先收藏，后面就能集中跟进报名节点。'
        actionText='去找竞赛'
        onAction={() => Taro.switchTab({ url: PAGE_ROUTES.competitions })}
      />
    ) : (
      <View className='stack'>
        {items.map((item) => (
          <CompetitionCard
            key={item.id}
            competition={item}
            onClick={() => Taro.navigateTo({ url: buildCompetitionDetailRoute(item.id) })}
            actionText='取消收藏'
            onAction={() => void handleToggleCompetitionFavorite(item)}
            actionLoading={favoritingCompetitionId === item.id}
          />
        ))}
      </View>
    );

  const renderResourceList = (items: ResourceItem[]) =>
    items.length === 0 ? (
      <EmptyState
        title='还没有收藏资源'
        description='把想之后再细读的资料、模板和攻略先收进收藏夹。'
        actionText='去找资源'
        onAction={() => Taro.switchTab({ url: PAGE_ROUTES.resources })}
      />
    ) : (
      <View className='stack'>
        {items.map((item) => (
          <ResourceCard
            key={item.id}
            resource={item}
            onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(item.id) })}
            actionText='取消收藏'
            onAction={() => void handleToggleResourceFavorite(item)}
            actionLoading={favoritingResourceId === item.id}
          />
        ))}
      </View>
    );

  const renderPostList = (items: PostItem[]) =>
    items.length === 0 ? (
      <EmptyState
        title='还没有收藏帖子'
        description='社区里值得反复回看的经验帖、问答和避坑帖可以先收藏起来。'
        actionText='去社区页'
        onAction={() => Taro.switchTab({ url: PAGE_ROUTES.community })}
      />
    ) : (
      <View className='stack'>
        {items.map((item) => (
          <PostCard
            key={item.id}
            post={item}
            onClick={() => Taro.navigateTo({ url: buildPostDetailRoute(item.id) })}
            onFavorite={() => void handleTogglePostFavorite(item)}
            favoriteLoading={favoritingPostId === item.id}
          />
        ))}
      </View>
    );

  const renderTimelineList = () => {
    if (timelineItems.length === 0) {
      return (
        <EmptyState
          title='你还没有收藏内容'
          description='先去逛竞赛、资源和社区，把后续要继续跟进的内容收进来。'
          actionText='去发现内容'
          onAction={() => Taro.switchTab({ url: PAGE_ROUTES.home })}
        />
      );
    }

    return (
      <View className='stack'>
        {timelineItems.map((entry) => {
          if (entry.type === 'competition') {
            return (
              <View key={entry.id}>
                <Text className='favorites-timeline__meta'>{formatFavoriteTimeLabel(entry.favoritedAt)}</Text>
                <CompetitionCard
                  competition={entry.item}
                  onClick={() => Taro.navigateTo({ url: buildCompetitionDetailRoute(entry.item.id) })}
                  actionText='取消收藏'
                  onAction={() => void handleToggleCompetitionFavorite(entry.item)}
                  actionLoading={favoritingCompetitionId === entry.item.id}
                />
              </View>
            );
          }

          if (entry.type === 'resource') {
            return (
              <View key={entry.id}>
                <Text className='favorites-timeline__meta'>{formatFavoriteTimeLabel(entry.favoritedAt)}</Text>
                <ResourceCard
                  resource={entry.item}
                  onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(entry.item.id) })}
                  actionText='取消收藏'
                  onAction={() => void handleToggleResourceFavorite(entry.item)}
                  actionLoading={favoritingResourceId === entry.item.id}
                />
              </View>
            );
          }

          return (
            <View key={entry.id}>
              <Text className='favorites-timeline__meta'>{formatFavoriteTimeLabel(entry.favoritedAt)}</Text>
              <PostCard
                post={entry.item}
                onClick={() => Taro.navigateTo({ url: buildPostDetailRoute(entry.item.id) })}
                onFavorite={() => void handleTogglePostFavorite(entry.item)}
                favoriteLoading={favoritingPostId === entry.item.id}
              />
            </View>
          );
        })}
      </View>
    );
  };

  const renderAllSections = () => {
    if (totalCount === 0) {
      return (
        <EmptyState
          title='你还没有收藏内容'
          description='先去逛竞赛、资源和社区，把后续要继续跟进的内容收进来。'
          actionText='去发现内容'
          onAction={() => Taro.switchTab({ url: PAGE_ROUTES.home })}
        />
      );
    }

    if (sortMode === 'time') {
      return renderTimelineList();
    }

    return (
      <View className='stack'>
        <View className='section'>
          <SectionTitle
            title='收藏竞赛'
            actionText='去竞赛页'
            onAction={() => Taro.switchTab({ url: PAGE_ROUTES.competitions })}
          />
          <View className='stack' style={{ marginTop: '18px' }}>
            {renderCompetitionList(sortedFavorites.competitions)}
          </View>
        </View>

        <View className='section'>
          <SectionTitle
            title='收藏资源'
            actionText='去资源页'
            onAction={() => Taro.switchTab({ url: PAGE_ROUTES.resources })}
          />
          <View className='stack' style={{ marginTop: '18px' }}>
            {renderResourceList(sortedFavorites.resources)}
          </View>
        </View>

        <View className='section'>
          <SectionTitle
            title='收藏帖子'
            actionText='去社区页'
            onAction={() => Taro.switchTab({ url: PAGE_ROUTES.community })}
          />
          <View className='stack' style={{ marginTop: '18px' }}>
            {renderPostList(sortedFavorites.posts)}
          </View>
        </View>
      </View>
    );
  };

  const renderSingleScope = () => {
    if (scope === 'competition') {
      return renderCompetitionList(sortedFavorites.competitions);
    }

    if (scope === 'resource') {
      return renderResourceList(sortedFavorites.resources);
    }

    return renderPostList(sortedFavorites.posts);
  };

  return (
    <View className='page-shell'>
      <TopBar
        title='我的收藏'
        rightText={loggedIn ? '回到我的' : '去登录'}
        onRightClick={() =>
          loggedIn
            ? Taro.switchTab({ url: PAGE_ROUTES.profile })
            : Taro.navigateTo({ url: PAGE_ROUTES.login })
        }
      />

      <View className='surface-card section'>
        <Text className='page-title' style={{ fontSize: '34px' }}>
          把值得继续推进的内容收在一起
        </Text>
        <Text className='page-subtitle' style={{ marginTop: '12px' }}>
          这里会汇总你收藏过的竞赛、资源和帖子，方便你后面集中复盘和继续行动。
        </Text>
        <View className='stats-grid' style={{ marginTop: '20px' }}>
          <View className='stats-grid__cell'>
            <Text className='stats-grid__value'>{totalCount}</Text>
            <Text className='stats-grid__label'>全部收藏</Text>
          </View>
          <View className='stats-grid__cell'>
            <Text className='stats-grid__value'>{sortedFavorites.competitions.length}</Text>
            <Text className='stats-grid__label'>竞赛</Text>
          </View>
          <View className='stats-grid__cell'>
            <Text className='stats-grid__value'>{sortedFavorites.resources.length}</Text>
            <Text className='stats-grid__label'>资源</Text>
          </View>
          <View className='stats-grid__cell'>
            <Text className='stats-grid__value'>{sortedFavorites.posts.length}</Text>
            <Text className='stats-grid__label'>帖子</Text>
          </View>
        </View>
      </View>

      <ChipTabs
        items={FAVORITE_SCOPE_TABS}
        active={activeTab}
        onChange={(value) => setActiveTab(value as (typeof FAVORITE_SCOPE_TABS)[number])}
        className='section'
      />

      {loggedIn && status === 'success' && scope === 'all' && totalCount > 1 ? (
        <ChipTabs
          items={FAVORITE_SORT_TABS}
          active={activeSortTab}
          onChange={(value) => setActiveSortTab(value as FavoriteSortTab)}
          className='section'
        />
      ) : null}

      <View className='section'>
        {status === 'loading' ? (
          <RequestStateCard
            mode='loading'
            title='正在加载收藏列表'
            description='正在同步你收藏的竞赛、资源和帖子。'
          />
        ) : status === 'error' ? (
          <RequestStateCard
            mode='error'
            title='收藏列表加载失败'
            description={errorMessage}
            actionText='重新加载'
            onAction={() => void reload()}
          />
        ) : status === 'auth_expired' ? (
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='重新登录后才能继续查看和管理我的收藏。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        ) : !loggedIn ? (
          <EmptyState
            title='登录后查看我的收藏'
            description='登录后会自动汇总你收藏的竞赛、资源和帖子，形成后续跟进闭环。'
            actionText='去登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        ) : scope === 'all' ? (
          renderAllSections()
        ) : (
          renderSingleScope()
        )}
      </View>
    </View>
  );
}
