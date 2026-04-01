import { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { ChipTabs } from '../../components/ChipTabs';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { ResourceCard } from '../../components/ResourceCard';
import { TeamCard } from '../../components/TeamCard';
import { TopBar } from '../../components/TopBar';
import { COMPETITION_DETAIL_TABS } from '../../constants/enums';
import {
  buildAiRoute,
  buildPublishTeamRoute,
  buildResourceDetailRoute,
  buildTeamDetailRoute,
  PAGE_ROUTES,
} from '../../constants/routes';
import { useRequestState } from '../../hooks/useRequestState';
import { useSessionUser } from '../../hooks/useSessionUser';
import {
  createCompetitionEnrollment,
  fetchCompetitionDetail,
  fetchResourcesForCompetition,
  fetchTeamsForCompetition,
  toggleCompetitionFavorite,
} from '../../services/app-service';
import type { Competition, ResourceItem, TeamItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { showPendingToast } from '../../utils/feedback';
import { formatCount } from '../../utils/format';
import { executeMutation } from '../../utils/mutation';

const fallbackCompetition: Competition = {
  id: '',
  title: '',
  level: '',
  category: '',
  host: '',
  target: '',
  status: '报名中',
  deadline: '',
  daysLeft: 0,
  views: 0,
  difficulty: '',
  coverLabel: '',
  coverGradient: 'linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)',
  tags: [],
  description: '',
  recommendedFor: [],
  actionHints: [],
};

export default function CompetitionDetailPage() {
  const router = useRouter();
  const { user, loggedIn } = useSessionUser();
  const [activeTab, setActiveTab] = useState<(typeof COMPETITION_DETAIL_TABS)[number]>(
    COMPETITION_DETAIL_TABS[0]
  );
  const {
    data: competition,
    setData: setCompetition,
    status: detailStatus,
    errorMessage: detailError,
    run: runDetail,
  } = useRequestState<Competition>({
    initialData: fallbackCompetition,
    errorMessage: '竞赛详情加载失败，请稍后重试。',
  });
  const {
    data: relatedResources,
    status: resourceStatus,
    errorMessage: resourceError,
    run: runRelatedResources,
    reset: resetRelatedResources,
  } = useRequestState<ResourceItem[]>({
    initialData: () => [],
    errorMessage: '关联资料加载失败，请稍后重试。',
  });
  const {
    data: relatedTeams,
    status: teamStatus,
    errorMessage: teamError,
    run: runRelatedTeams,
    reset: resetRelatedTeams,
  } = useRequestState<TeamItem[]>({
    initialData: () => [],
    errorMessage: '关联组队加载失败，请稍后重试。',
  });

  const loadCompetition = useCallback(async () => {
    await runDetail(() => fetchCompetitionDetail(router.params.id));
  }, [router.params.id, runDetail]);

  const loadRelatedResources = useCallback(
    async (competitionId: string) => {
      await runRelatedResources(() => fetchResourcesForCompetition(competitionId));
    },
    [runRelatedResources]
  );

  const loadRelatedTeams = useCallback(
    async (competitionId: string) => {
      await runRelatedTeams(() => fetchTeamsForCompetition(competitionId));
    },
    [runRelatedTeams]
  );

  const handleToggleFavorite = useCallback(async () => {
    if (!ensureLoggedIn({ message: '登录后才能收藏竞赛' })) {
      return;
    }

    const nextFavorite = !competition.viewer?.isFavorited;
    const result = await executeMutation({
      task: () => toggleCompetitionFavorite(competition.id, { favorite: nextFavorite }),
      loadingTitle: nextFavorite ? '收藏中' : '取消中',
      successMessage: nextFavorite ? '已收藏竞赛' : '已取消收藏',
      fallbackErrorMessage: '竞赛收藏状态更新失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setCompetition((current) => ({
      ...current,
      viewer: {
        isFavorited: result.favorite,
        isEnrolled: current.viewer?.isEnrolled ?? false,
      },
    }));
  }, [competition.id, competition.viewer?.isFavorited, setCompetition]);

  const handleEnroll = useCallback(async () => {
    if (!ensureLoggedIn({ message: '登录后才能报名或组队' })) {
      return;
    }

    if (competition.viewer?.isEnrolled) {
      Taro.navigateTo({ url: PAGE_ROUTES.teams });
      return;
    }

    const result = await executeMutation({
      task: () => createCompetitionEnrollment(competition.id),
      loadingTitle: '提交中',
      successMessage: '报名状态已更新',
      fallbackErrorMessage: '报名状态更新失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setCompetition((current) => ({
      ...current,
      viewer: {
        isFavorited: current.viewer?.isFavorited ?? false,
        isEnrolled: result.enrolled,
      },
    }));
  }, [competition.id, competition.viewer?.isEnrolled, setCompetition]);

  useEffect(() => {
    void loadCompetition();
  }, [loadCompetition]);

  useEffect(() => {
    if (!competition.id || detailStatus !== 'success') {
      resetRelatedResources([], 'idle');
      resetRelatedTeams([], 'idle');
      return;
    }

    void loadRelatedResources(competition.id);
    void loadRelatedTeams(competition.id);
  }, [
    competition.id,
    detailStatus,
    loadRelatedResources,
    loadRelatedTeams,
    resetRelatedResources,
    resetRelatedTeams,
  ]);

  if (detailStatus === 'loading') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='竞赛详情' />
        <RequestStateCard
          mode='loading'
          title='正在加载竞赛详情'
          description='正在同步竞赛基础信息、关联资料和招募动态。'
          className='section'
        />
      </View>
    );
  }

  if (detailStatus === 'error') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='竞赛详情' />
        <RequestStateCard
          mode='error'
          title='竞赛详情加载失败'
          description={detailError}
          actionText='重新加载'
          onAction={() => void loadCompetition()}
          className='section'
        />
      </View>
    );
  }

  if (detailStatus === 'auth_expired') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='竞赛详情' />
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后可以继续同步竞赛详情和你的个性化操作状态。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      </View>
    );
  }

  return (
    <View className='page-shell page-shell--detail'>
      <View className='detail-hero' style={{ background: competition.coverGradient }}>
        <TopBar
          title='竞赛详情'
          light
          overlay
          rightText='分享'
          onRightClick={() => showPendingToast('分享能力接入中')}
        />

        <View className='tag-row'>
          <Text className='tag tag--muted'>{competition.status}</Text>
          <Text className='tag tag--muted'>{competition.level}</Text>
          <Text className='tag tag--muted'>{competition.category}</Text>
        </View>

        <Text className='detail-hero__title'>{competition.title}</Text>
        <Text className='detail-hero__desc'>
          {competition.host} · 面向 {competition.target} · 距离截止还有 {competition.daysLeft} 天
        </Text>

        <View className='detail-summary detail-summary--hero'>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>热度</Text>
            <Text className='detail-summary__value'>{formatCount(competition.views)}</Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>资料数</Text>
            <Text className='detail-summary__value'>
              {resourceStatus === 'success' ? relatedResources.length : '--'}
            </Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>组队数</Text>
            <Text className='detail-summary__value'>
              {teamStatus === 'success' ? relatedTeams.length : '--'}
            </Text>
          </View>
        </View>
      </View>

      <View
        className='surface-card section competition-detail__helper interactive-card'
        onClick={() => Taro.navigateTo({ url: buildAiRoute({ source: 'competition', id: competition.id }) })}
        hoverClass='pressable--hover'
      >
        <View className='menu-row__meta'>
          <View className='helper-badge'>
            <Text>AI</Text>
          </View>
          <View className='helper-copy'>
            <Text className='helper-copy__title'>AI 帮我判断值不值得做</Text>
            <Text className='helper-copy__desc'>从适配度、准备顺序和站内资源三个角度给你建议。</Text>
          </View>
        </View>
        <Text className='metric-text metric-text--strong'>进入</Text>
      </View>

      <AuthStatusCard
        className='section'
        loggedIn={loggedIn}
        userName={loggedIn ? user?.name : undefined}
        guestTitle='登录后再进入报名和组队动作'
        guestDescription='收藏、报名、组队发布和申请加入都会绑定到个人身份，后端联调时也会沿用这套规则。'
        authedTitle='当前身份可直接参与动作'
        authedDescription='你现在可以收藏竞赛、发起组队招募，后续接上真实报名接口后也会走同一入口。'
        guestActionText='去登录'
        authedActionText='发起组队'
        onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        onAuthedAction={() => Taro.navigateTo({ url: buildPublishTeamRoute({ compId: competition.id, compName: competition.title }) })}
      />

      <ChipTabs
        items={[...COMPETITION_DETAIL_TABS]}
        active={activeTab}
        onChange={(value) => setActiveTab(value as (typeof COMPETITION_DETAIL_TABS)[number])}
        className='section'
      />

      {activeTab === '详情' ? (
        <View className='stack'>
          <View className='surface-card stack'>
            <View className='info-grid'>
              <View className='info-item'>
                <Text className='info-item__label'>主办方</Text>
                <Text className='info-item__value'>{competition.host}</Text>
              </View>
              <View className='info-item'>
                <Text className='info-item__label'>报名截止</Text>
                <Text className='info-item__value'>{competition.deadline}</Text>
              </View>
              <View className='info-item'>
                <Text className='info-item__label'>难度</Text>
                <Text className='info-item__value'>{competition.difficulty}</Text>
              </View>
              <View className='info-item'>
                <Text className='info-item__label'>适合人群</Text>
                <Text className='info-item__value'>{competition.target}</Text>
              </View>
            </View>

            <View>
              <Text className='section-title__text' style={{ fontSize: '28px' }}>
                竞赛简介
              </Text>
              <Text className='detail-paragraph' style={{ marginTop: '14px' }}>
                {competition.description}
              </Text>
            </View>
          </View>

          <View className='surface-card stack'>
            <Text className='section-title__text' style={{ fontSize: '28px' }}>
              适合你的画像
            </Text>
            <View className='tag-row'>
              {competition.recommendedFor.map((item) => (
                <Text key={item} className='tag tag--strong'>
                  {item}
                </Text>
              ))}
            </View>
          </View>

          <View className='surface-card stack'>
            <Text className='section-title__text' style={{ fontSize: '28px' }}>
              准备顺序
            </Text>
            <View className='stack'>
              {competition.actionHints.map((item, index) => (
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
      ) : null}

      {activeTab === '资料' ? (
        <View className='stack'>
          {resourceStatus === 'loading' ? (
            <RequestStateCard
              mode='loading'
              title='正在加载关联资料'
              description='正在同步这场竞赛对应的资料和模板。'
            />
          ) : resourceStatus === 'error' ? (
            <RequestStateCard
              mode='error'
              title='关联资料加载失败'
              description={resourceError}
              actionText='重新加载'
              onAction={() => void loadRelatedResources(competition.id)}
            />
          ) : resourceStatus === 'auth_expired' ? (
            <RequestStateCard
              mode='auth_expired'
              title='登录状态已失效'
              description='重新登录后可以继续同步竞赛关联资料。'
              actionText='重新登录'
              onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
            />
          ) : relatedResources.length === 0 ? (
            <EmptyState
              title='暂时没有关联资料'
              description='后端联调后，这里会优先展示该竞赛的高相关资料。'
            />
          ) : (
            relatedResources.map((item) => (
              <ResourceCard
                key={item.id}
                resource={item}
                onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(item.id) })}
              />
            ))
          )}
        </View>
      ) : null}

      {activeTab === '组队' ? (
        <View className='stack'>
          {teamStatus === 'loading' ? (
            <RequestStateCard
              mode='loading'
              title='正在加载组队招募'
              description='正在同步围绕这场竞赛发起的招募和队伍动态。'
            />
          ) : teamStatus === 'error' ? (
            <RequestStateCard
              mode='error'
              title='关联组队加载失败'
              description={teamError}
              actionText='重新加载'
              onAction={() => void loadRelatedTeams(competition.id)}
            />
          ) : teamStatus === 'auth_expired' ? (
            <RequestStateCard
              mode='auth_expired'
              title='登录状态已失效'
              description='重新登录后可以继续同步围绕该竞赛的组队招募。'
              actionText='重新登录'
              onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
            />
          ) : relatedTeams.length === 0 ? (
            <EmptyState
              title='暂时还没有招募帖'
              description='你可以成为第一个围绕这个竞赛发起组队的人。'
            />
          ) : (
            relatedTeams.map((item) => (
              <TeamCard
                key={item.id}
                team={item}
                onClick={() => Taro.navigateTo({ url: buildTeamDetailRoute(item.id) })}
              />
            ))
          )}

          <View
            className='pill-button pill-button--outline'
            onClick={() => {
              if (!ensureLoggedIn({ message: '登录后才能发布组队' })) {
                return;
              }

              Taro.navigateTo({
                url: buildPublishTeamRoute({ compId: competition.id, compName: competition.title }),
              });
            }}
            hoverClass='pressable--hover'
          >
            <Text>围绕这个竞赛发布组队</Text>
          </View>
        </View>
      ) : null}

      <View className='bottom-bar'>
        <View
          className='bottom-bar__minor pill-button pill-button--ghost'
          onClick={() => void handleToggleFavorite()}
          hoverClass='pressable--hover'
        >
          <Text>
            {loggedIn
              ? competition.viewer?.isFavorited
                ? '已收藏'
                : '收藏'
              : '登录后收藏'}
          </Text>
        </View>
        <View
          className='bottom-bar__major pill-button pill-button--primary'
          onClick={() => void handleEnroll()}
          hoverClass='pressable--hover'
        >
          <Text>
            {loggedIn
              ? competition.viewer?.isEnrolled
                ? '已报名，去看组队'
                : '立即报名 / 去组队'
              : '登录后报名 / 组队'}
          </Text>
        </View>
      </View>
    </View>
  );
}
