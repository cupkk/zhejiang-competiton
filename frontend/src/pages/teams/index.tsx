import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { ChipTabs } from '../../components/ChipTabs';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { SearchBar } from '../../components/SearchBar';
import { TeamCard } from '../../components/TeamCard';
import { TopBar } from '../../components/TopBar';
import { TEAM_FILTER_OPTIONS } from '../../constants/enums';
import { buildPublishTeamRoute, buildTeamDetailRoute, PAGE_ROUTES } from '../../constants/routes';
import { useProtectedRequest } from '../../hooks/useProtectedRequest';
import { fetchTeamList } from '../../services/app-service';
import { ensureLoggedIn } from '../../utils/auth';
import { showPendingToast } from '../../utils/feedback';
import type { TeamItem } from '../../types/entities';

export default function TeamsPage() {
  const router = useRouter();
  const initialMine = router.params.mine === 'true';
  const [activeTab, setActiveTab] = useState<(typeof TEAM_FILTER_OPTIONS)[number]>(
    initialMine ? '我的' : TEAM_FILTER_OPTIONS[0]
  );
  const [keyword, setKeyword] = useState('');
  const {
    user,
    loggedIn,
    data: list,
    status,
    errorMessage,
    reload: reloadTeams,
  } = useProtectedRequest<TeamItem[]>({
    initialData: () => [],
    errorMessage: '组队列表加载失败，请稍后重试。',
    request: () =>
      fetchTeamList({
        keyword: keyword.trim() || undefined,
        status: activeTab === '招募中' ? '招募中' : undefined,
        mineOnly: activeTab === '我的',
      }),
    deps: [keyword, activeTab],
    requiresAuth: activeTab === '我的',
  });

  const openPublish = () => {
    if (!ensureLoggedIn({ message: '登录后才能发布组队' })) {
      return;
    }

    Taro.navigateTo({ url: buildPublishTeamRoute() });
  };

  return (
    <View className='page-shell'>
      <TopBar
        title='组队大厅'
        rightText={loggedIn ? '发布' : '登录'}
        onRightClick={() => {
          if (loggedIn) {
            openPublish();
            return;
          }

          Taro.navigateTo({ url: PAGE_ROUTES.login });
        }}
      />

      <SearchBar
        placeholder='搜索竞赛方向、招募角色、项目目标'
        value={keyword}
        actionText='搜索'
        onChange={setKeyword}
        onAction={() => setKeyword(keyword.trim())}
      />

      <AuthStatusCard
        loggedIn={loggedIn}
        userName={user?.name}
        guestTitle='游客可先浏览公开招募'
        guestDescription='登录后再查看“我的组队”，并直接发布招募、申请加入和跟进进度。'
        authedTitle='你的组队链路已接通'
        authedDescription='现在可以切到“我的”查看发起和参与中的队伍，后续再接申请与审批接口。'
        guestActionText='去登录'
        authedActionText='查看我的'
        onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        onAuthedAction={() => setActiveTab('我的')}
        className='section'
      />

      {status === 'auth_expired' ? (
        <View className='section'>
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='“我的组队”需要有效身份才能读取，请重新登录后继续查看。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        </View>
      ) : null}

      <ChipTabs
        items={[...TEAM_FILTER_OPTIONS]}
        active={activeTab}
        onChange={(value) => {
          const nextTab = value as (typeof TEAM_FILTER_OPTIONS)[number];
          setActiveTab(nextTab);

          if (nextTab === '我的' && !loggedIn) {
            showPendingToast('登录后查看我的组队');
          }
        }}
        className='section'
      />

      <View className='section'>
        <View className='stack'>
          {status === 'auth_expired' ? null : !loggedIn && activeTab === '我的' ? (
            <EmptyState
              title='登录后查看我的组队'
              description='这里会承接你发起的招募、已加入队伍和后续申请处理进度。'
              actionText='去登录'
              onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
            />
          ) : status === 'loading' ? (
            <RequestStateCard
              mode='loading'
              title={activeTab === '我的' ? '正在同步我的组队' : '正在拉取公开招募'}
              description='正在整理当前筛选条件下的队伍和招募信息。'
            />
          ) : status === 'error' ? (
            <RequestStateCard
              mode='error'
              title='组队列表加载失败'
              description={errorMessage}
              actionText='重新加载'
              onAction={() => void reloadTeams()}
            />
          ) : list.length === 0 ? (
            <EmptyState
              title={activeTab === '我的' ? '你还没有参与中的队伍' : '当前没有匹配队伍'}
              description={
                activeTab === '我的'
                  ? '可以先浏览公开招募，或者直接发起一条新的组队招募。'
                  : '可以切换筛选条件，或者直接发起一条新的组队招募。'
              }
              actionText={loggedIn ? '发布组队' : '去登录'}
              onAction={loggedIn ? openPublish : () => Taro.navigateTo({ url: PAGE_ROUTES.login })}
            />
          ) : (
            list.map((item) => (
              <TeamCard
                key={item.id}
                team={item}
                onClick={() => Taro.navigateTo({ url: buildTeamDetailRoute(item.id) })}
              />
            ))
          )}
        </View>
      </View>

      <View
        className='floating-action'
        onClick={loggedIn ? openPublish : () => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        hoverClass='pressable--hover'
      >
        <Text>{loggedIn ? '发招募' : '去登录'}</Text>
      </View>
    </View>
  );
}
