import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getRuntimeModeLabel } from '../../config/runtime';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { CompetitionCard } from '../../components/CompetitionCard';
import { EmptyState } from '../../components/EmptyState';
import { PostCard } from '../../components/PostCard';
import { RequestStateCard } from '../../components/RequestStateCard';
import { ResourceCard } from '../../components/ResourceCard';
import { SearchBar } from '../../components/SearchBar';
import { SectionTitle } from '../../components/SectionTitle';
import { TeamCard } from '../../components/TeamCard';
import {
  buildAiRoute,
  buildCompetitionDetailRoute,
  buildPostDetailRoute,
  buildResourceDetailRoute,
  buildSearchRoute,
  buildTeamDetailRoute,
  PAGE_ROUTES,
} from '../../constants/routes';
import { usePageRequest } from '../../hooks/usePageRequest';
import { useSessionUser } from '../../hooks/useSessionUser';
import { fetchHomeFeed, togglePostFavorite, togglePostLike } from '../../services/app-service';
import type { HomeFeed, PostItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { pageTopInset } from '../../utils/layout';
import { executeMutation } from '../../utils/mutation';

const quickLinks = [
  {
    key: 'competition',
    mark: '赛',
    label: '找竞赛',
    style: { background: '#dbeafe', color: '#2563eb' },
    onClick: () => Taro.switchTab({ url: PAGE_ROUTES.competitions }),
  },
  {
    key: 'resource',
    mark: '资',
    label: '找资料',
    style: { background: '#ccfbf1', color: '#0f766e' },
    onClick: () => Taro.switchTab({ url: PAGE_ROUTES.resources }),
  },
  {
    key: 'team',
    mark: '队',
    label: '组队大厅',
    style: { background: '#ffedd5', color: '#ea580c' },
    onClick: () => Taro.navigateTo({ url: PAGE_ROUTES.teams }),
  },
  {
    key: 'guide',
    mark: '帖',
    label: '看经验',
    style: { background: '#ede9fe', color: '#7c3aed' },
    onClick: () => Taro.switchTab({ url: PAGE_ROUTES.community }),
  },
];

const defaultFeed: HomeFeed = {
  heroPrompt: '',
  urgentCompetitions: [],
  hotResources: [],
  latestTeams: [],
  featuredPosts: [],
};

export default function HomePage() {
  const { user, loggedIn } = useSessionUser();
  const {
    data: feed,
    setData: setFeed,
    status,
    errorMessage,
    reload: reloadFeed,
  } = usePageRequest<HomeFeed>({
    initialData: defaultFeed,
    errorMessage: '首页内容加载失败，请稍后重试。',
    request: () => fetchHomeFeed(),
  });
  const [likingPostId, setLikingPostId] = useState('');
  const [favoritingPostId, setFavoritingPostId] = useState('');

  const userName = user?.name || '同学';

  const handleToggleFeaturedPostLike = useCallback(
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

      setFeed((current) => ({
        ...current,
        featuredPosts: current.featuredPosts.map((item) =>
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
        ),
      }));
    },
    [setFeed]
  );

  const handleToggleFeaturedPostFavorite = useCallback(
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

      setFeed((current) => ({
        ...current,
        featuredPosts: current.featuredPosts.map((item) =>
          item.id === post.id
            ? {
                ...item,
                viewer: {
                  isLiked: item.viewer?.isLiked ?? false,
                  isFavorited: result.favorite,
                },
              }
            : item
        ),
      }));
    },
    [setFeed]
  );

  const heroDescription = useMemo(() => {
    if (status === 'loading') {
      return '正在同步近期竞赛、热门资源、组队动态和社区精选。';
    }

    if (status === 'error') {
      return '首页聚合流暂时不可用，你仍然可以先进入竞赛、资源和社区页面浏览。';
    }

    if (status === 'auth_expired') {
      return '登录状态已失效，重新登录后可以继续同步个性化首页内容。';
    }

    return feed.heroPrompt || '围绕竞赛、资源、组队和经验，给你一条更清晰的校园成长路径。';
  }, [feed.heroPrompt, status]);

  const renderSectionContent = () => {
    if (status === 'loading') {
      return (
        <RequestStateCard
          mode='loading'
          title='正在加载首页内容'
          description='正在拼装近期竞赛、热门资源、最新组队和社区精选。'
          className='section'
        />
      );
    }

    if (status === 'error') {
      return (
        <RequestStateCard
          mode='error'
          title='首页内容加载失败'
          description={errorMessage}
          actionText='重新加载'
          onAction={() => void reloadFeed()}
          className='section'
        />
      );
    }

    if (status === 'auth_expired') {
      return (
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后可以继续同步首页聚合内容和消息提醒。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      );
    }

    return (
      <>
        <View className='section'>
          <SectionTitle
            title='近期急需'
            actionText='竞赛列表'
            onAction={() => Taro.switchTab({ url: PAGE_ROUTES.competitions })}
          />
          {feed.urgentCompetitions.length === 0 ? (
            <EmptyState
              title='近期还没有重点竞赛'
              description='稍后再来看看，或者直接去竞赛页浏览完整列表。'
              actionText='去竞赛页'
              onAction={() => Taro.switchTab({ url: PAGE_ROUTES.competitions })}
            />
          ) : (
            <ScrollView className='horizontal-scroll' scrollX showScrollbar={false}>
              <View className='horizontal-scroll__inner horizontal-scroll__inner--cards'>
                {feed.urgentCompetitions.map((item) => (
                  <View key={item.id} className='rail-card'>
                    <CompetitionCard
                      competition={item}
                      onClick={() => Taro.navigateTo({ url: buildCompetitionDetailRoute(item.id) })}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        <View className='section'>
          <SectionTitle
            title='热门资源'
            actionText='资源页'
            onAction={() => Taro.switchTab({ url: PAGE_ROUTES.resources })}
          />
          <View className='stack'>
            {feed.hotResources.length === 0 ? (
              <EmptyState
                title='还没有推荐资源'
                description='可以先去资源页浏览免费资料、模板和攻略。'
                actionText='去资源页'
                onAction={() => Taro.switchTab({ url: PAGE_ROUTES.resources })}
              />
            ) : (
              feed.hotResources.map((item) => (
                <ResourceCard
                  key={item.id}
                  resource={item}
                  onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(item.id) })}
                />
              ))
            )}
          </View>
        </View>

        <View className='section'>
          <SectionTitle
            title='最新组队'
            actionText='发布招募'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.publishTeam })}
          />
          <View className='stack'>
            {feed.latestTeams.length === 0 ? (
              <EmptyState
                title='暂时没有新的招募'
                description='你可以先去组队大厅看看，或者直接发布一条新的招募。'
                actionText='去组队大厅'
                onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.teams })}
              />
            ) : (
              feed.latestTeams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  onClick={() => Taro.navigateTo({ url: buildTeamDetailRoute(team.id) })}
                />
              ))
            )}
          </View>
        </View>

        <View className='section'>
          <SectionTitle
            title='社区精选'
            actionText='更多内容'
            onAction={() => Taro.switchTab({ url: PAGE_ROUTES.community })}
          />
          <View className='stack'>
            {feed.featuredPosts.length === 0 ? (
              <EmptyState
                title='暂时没有精选内容'
                description='可以先去社区页看看经验帖、问答和避坑内容。'
                actionText='去社区页'
                onAction={() => Taro.switchTab({ url: PAGE_ROUTES.community })}
              />
            ) : (
              feed.featuredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => Taro.navigateTo({ url: buildPostDetailRoute(post.id) })}
                  onLike={() => void handleToggleFeaturedPostLike(post)}
                  likeLoading={likingPostId === post.id}
                  onFavorite={() => void handleToggleFeaturedPostFavorite(post)}
                  favoriteLoading={favoritingPostId === post.id}
                />
              ))
            )}
          </View>
        </View>
      </>
    );
  };

  return (
    <View className='page-shell' style={{ paddingTop: `${pageTopInset}px` }}>
      <View className='home-stage'>
        <View className='split-row home-stage__head'>
          <View>
            <Text className='page-eyebrow'>校园成长</Text>
            <Text className='page-title'>你好，{userName}</Text>
            <Text className='page-subtitle'>
              把竞赛、资源、组队和经验收束成一个真正可执行的校园成长工作台。
            </Text>
          </View>

          <View className='home-stage__aside'>
            <Text className='home-stage__mode'>{getRuntimeModeLabel()}</Text>
            <View
              className='home-stage__message'
              onClick={() =>
                loggedIn
                  ? Taro.navigateTo({ url: PAGE_ROUTES.messages })
                  : Taro.navigateTo({ url: PAGE_ROUTES.login })
              }
              hoverClass='pressable--hover'
            >
              <Text>{loggedIn ? '消息' : '登录'}</Text>
            </View>
          </View>
        </View>

        <SearchBar
          readonly
          placeholder='搜竞赛、找资料、看经验帖'
          value='搜竞赛、找资料、看经验帖'
          actionText='全站'
          onClick={() => Taro.navigateTo({ url: buildSearchRoute() })}
          onAction={() => Taro.navigateTo({ url: buildSearchRoute() })}
        />

        <View
          className='hero-panel hero-panel--layered'
          style={{ background: 'linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)' }}
          onClick={() => Taro.navigateTo({ url: buildAiRoute() })}
          hoverClass='pressable--hover'
        >
          <Text className='hero-panel__eyebrow'>AI 成长助手</Text>
          <Text className='hero-panel__title'>不确定先做什么，就先从一个目标开始拆解。</Text>
          <Text className='hero-panel__desc'>{heroDescription}</Text>

          <View className='hero-panel__actions'>
            <View className='hero-panel__chip'>
              <Text>让 AI 帮我拆路径</Text>
            </View>
            <View
              className='hero-panel__chip hero-panel__chip--ghost'
              onClick={(event) => {
                event.stopPropagation();
                Taro.navigateTo({ url: PAGE_ROUTES.teams });
              }}
            >
              <Text>去组队大厅</Text>
            </View>
          </View>

          <View className='hero-panel__metrics'>
            <View className='hero-panel__metric'>
              <Text className='hero-panel__metric-value'>{feed.urgentCompetitions.length}</Text>
              <Text className='hero-panel__metric-label'>近期重点竞赛</Text>
            </View>
            <View className='hero-panel__metric'>
              <Text className='hero-panel__metric-value'>{feed.hotResources.length}</Text>
              <Text className='hero-panel__metric-label'>热门资源</Text>
            </View>
            <View className='hero-panel__metric'>
              <Text className='hero-panel__metric-value'>{feed.latestTeams.length}</Text>
              <Text className='hero-panel__metric-label'>活跃招募中</Text>
            </View>
          </View>
        </View>
      </View>

      <AuthStatusCard
        className='section'
        loggedIn={loggedIn}
        userName={loggedIn ? userName : undefined}
        guestTitle='登录后，前端链路才真正完整'
        guestDescription='登录后可以同步收藏、订单、组队申请和消息提醒，后面切真实微信身份时也会沿用这条链路。'
        authedTitle='当前身份已生效'
        authedDescription='你现在可以把首页、资源、组队和消息链路都当成真实业务流继续联调。'
        guestActionText='去登录'
        authedActionText='进入我的'
        onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        onAuthedAction={() => Taro.switchTab({ url: PAGE_ROUTES.profile })}
      />

      <View className='quick-grid'>
        {quickLinks.map((item) => (
          <View
            key={item.key}
            className='quick-grid__item'
            onClick={item.onClick}
            hoverClass='pressable--hover'
          >
            <View className='quick-grid__icon' style={item.style}>
              <Text>{item.mark}</Text>
            </View>
            <Text className='quick-grid__label'>{item.label}</Text>
          </View>
        ))}
      </View>

      {renderSectionContent()}
    </View>
  );
}
