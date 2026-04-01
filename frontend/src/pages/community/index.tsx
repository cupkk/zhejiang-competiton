import { useCallback, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { ChipTabs } from '../../components/ChipTabs';
import { EmptyState } from '../../components/EmptyState';
import { PostCard } from '../../components/PostCard';
import { RequestStateCard } from '../../components/RequestStateCard';
import { SearchBar } from '../../components/SearchBar';
import { POST_CATEGORY_OPTIONS } from '../../constants/enums';
import { buildPostDetailRoute, buildSearchRoute, PAGE_ROUTES } from '../../constants/routes';
import { usePageRequest } from '../../hooks/usePageRequest';
import { fetchPostList, togglePostFavorite, togglePostLike } from '../../services/app-service';
import type { PostCategory, PostItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { pageTopInset } from '../../utils/layout';
import { executeMutation } from '../../utils/mutation';

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<PostCategory>(POST_CATEGORY_OPTIONS[0]);
  const [likingPostId, setLikingPostId] = useState('');
  const [favoritingPostId, setFavoritingPostId] = useState('');
  const {
    data: list,
    setData: setList,
    status,
    errorMessage,
    reload: reloadPosts,
  } = usePageRequest<PostItem[]>({
    initialData: () => [],
    errorMessage: '社区内容加载失败，请稍后重试。',
    request: () => fetchPostList({ category: activeTab }),
    deps: [activeTab],
  });

  const handleTogglePostLike = useCallback(
    async (post: PostItem) => {
      if (!ensureLoggedIn({ message: '登录后才能点赞帖子' })) {
        return;
      }

      const nextLiked = !post.viewer?.isLiked;
      setLikingPostId(post.id);
      const result = await executeMutation({
        task: () => togglePostLike(post.id, nextLiked),
        loadingTitle: nextLiked ? '提交点赞' : '取消点赞',
        successMessage: nextLiked ? '已点赞帖子' : '已取消点赞',
        fallbackErrorMessage: '帖子点赞状态更新失败，请稍后重试。',
      });
      setLikingPostId('');

      if (!result) {
        return;
      }

      setList((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likes: result.likes,
                viewer: {
                  isLiked: result.liked,
                  isFavorited: item.viewer?.isFavorited ?? false,
                },
              }
            : item
        )
      );
    },
    [setList]
  );

  const handleTogglePostFavorite = useCallback(
    async (post: PostItem) => {
      if (!ensureLoggedIn({ message: '登录后才能收藏帖子' })) {
        return;
      }

      const nextFavorite = !post.viewer?.isFavorited;
      setFavoritingPostId(post.id);
      const result = await executeMutation({
        task: () => togglePostFavorite(post.id, { favorite: nextFavorite }),
        loadingTitle: nextFavorite ? '提交收藏' : '取消收藏',
        successMessage: nextFavorite ? '已收藏帖子' : '已取消收藏',
        fallbackErrorMessage: '帖子收藏状态更新失败，请稍后重试。',
      });
      setFavoritingPostId('');

      if (!result) {
        return;
      }

      setList((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                viewer: {
                  isLiked: item.viewer?.isLiked ?? false,
                  isFavorited: result.favorite,
                },
              }
            : item
        )
      );
    },
    [setList]
  );

  return (
    <View className='page-shell' style={{ paddingTop: `${pageTopInset}px` }}>
      <Text className='page-eyebrow'>社区交流</Text>
      <Text className='page-title'>交流社区</Text>
      <Text className='page-subtitle'>经验、问答和避坑内容，会反向支撑竞赛选择、资料转化和组队决策。</Text>

      <SearchBar
        readonly
        placeholder='搜经验贴、问答、攻略'
        value='搜经验贴、问答、攻略'
        actionText='搜索'
        onClick={() => Taro.navigateTo({ url: buildSearchRoute({ scope: 'posts' }) })}
        onAction={() => Taro.navigateTo({ url: buildSearchRoute({ scope: 'posts' }) })}
      />

      <View className='section'>
        <ChipTabs
          items={POST_CATEGORY_OPTIONS}
          active={activeTab}
          onChange={(value) => setActiveTab(value as PostCategory)}
        />
      </View>

      <View className='section'>
        {status === 'loading' ? (
          <RequestStateCard
            mode='loading'
            title='正在刷新社区内容'
            description='正在同步当前分类下的经验贴、问答和避坑内容。'
          />
        ) : status === 'error' ? (
          <RequestStateCard
            mode='error'
            title='社区内容加载失败'
            description={errorMessage}
            actionText='重新加载'
            onAction={() => void reloadPosts()}
          />
        ) : status === 'auth_expired' ? (
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='重新登录后可以继续同步你的社区浏览偏好和互动状态。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        ) : list.length === 0 ? (
          <EmptyState
            title='当前分类还没有内容'
            description='可以先切换其他分类，或者直接发布一条新的经验帖。'
            actionText='重新加载'
            onAction={() => void reloadPosts()}
          />
        ) : (
          <View className='stack'>
            {list.map((item) => (
              <PostCard
                key={item.id}
                post={item}
                onClick={() => Taro.navigateTo({ url: buildPostDetailRoute(item.id) })}
                onLike={() => void handleTogglePostLike(item)}
                likeLoading={likingPostId === item.id}
                onFavorite={() => void handleTogglePostFavorite(item)}
                favoriteLoading={favoritingPostId === item.id}
              />
            ))}
          </View>
        )}
      </View>

      <View
        className='floating-action'
        onClick={() => Taro.navigateTo({ url: PAGE_ROUTES.publishPost })}
        hoverClass='pressable--hover'
      >
        <Text>发帖</Text>
      </View>
    </View>
  );
}
