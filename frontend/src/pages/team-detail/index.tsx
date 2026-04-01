import { useCallback, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { PAGE_ROUTES } from '../../constants/routes';
import { useRequestState } from '../../hooks/useRequestState';
import { useSessionUser } from '../../hooks/useSessionUser';
import { createTeamApplication, fetchTeamDetail } from '../../services/app-service';
import type { TeamItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { showPendingToast } from '../../utils/feedback';
import { executeMutation } from '../../utils/mutation';

const fallbackTeam: TeamItem = {
  id: '',
  title: '',
  compName: '',
  status: '招募中',
  target: '',
  current: 0,
  max: 0,
  missingRoles: [],
  deadline: '',
  authorName: '',
  authorMark: '',
  authorGrade: '',
  authorMajor: '',
  schoolLimit: false,
  requirements: [],
  contactHint: '',
};

export default function TeamDetailPage() {
  const router = useRouter();
  const { user, loggedIn } = useSessionUser();
  const { data: team, setData: setTeam, status, errorMessage, run: runTeam } = useRequestState<TeamItem>({
    initialData: fallbackTeam,
    errorMessage: '组队详情加载失败，请稍后重试。',
  });

  const loadTeam = useCallback(async () => {
    await runTeam(() => fetchTeamDetail(router.params.id));
  }, [router.params.id, runTeam]);

  const handleApply = useCallback(async () => {
    if (!ensureLoggedIn({ message: '登录后才能申请加入' })) {
      return;
    }

    if (team.viewer?.hasApplied) {
      Taro.navigateTo({ url: PAGE_ROUTES.messages });
      return;
    }

    const result = await executeMutation({
      task: () => createTeamApplication(team.id),
      loadingTitle: '提交中',
      successMessage: '申请已提交',
      fallbackErrorMessage: '提交申请失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setTeam((current) => ({
      ...current,
      viewer: {
        hasApplied: result.applied,
        applicationStatus: result.status,
      },
    }));
  }, [setTeam, team.id, team.viewer?.hasApplied]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  if (status === 'loading') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='组队详情' />
        <RequestStateCard
          mode='loading'
          title='正在加载组队详情'
          description='正在同步队伍信息、招募要求和发起人资料。'
          className='section'
        />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='组队详情' />
        <RequestStateCard
          mode='error'
          title='组队详情加载失败'
          description={errorMessage}
          actionText='重新加载'
          onAction={() => void loadTeam()}
          className='section'
        />
      </View>
    );
  }

  if (status === 'auth_expired') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='组队详情' />
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后可以继续同步组队详情和你的申请状态。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      </View>
    );
  }

  return (
    <View className='page-shell page-shell--detail'>
      <TopBar title='组队详情' rightText='分享' onRightClick={() => showPendingToast('分享能力接入中')} />

      <View className='surface-card stack'>
        <View className='tag-row'>
          <Text className='tag tag--strong'>{team.status}</Text>
          <Text className='tag'>{team.compName}</Text>
        </View>

        <Text className='page-title' style={{ fontSize: '40px' }}>
          {team.title}
        </Text>

        <View className='detail-summary'>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>当前人数</Text>
            <Text className='detail-summary__value'>
              {team.current} / {team.max}
            </Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>缺口角色</Text>
            <Text className='detail-summary__value'>{team.max - team.current}</Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>截止时间</Text>
            <Text className='detail-summary__value detail-summary__value--small'>{team.deadline}</Text>
          </View>
        </View>

        <View className='info-grid'>
          <View className='info-item'>
            <Text className='info-item__label'>学校要求</Text>
            <Text className='info-item__value'>{team.schoolLimit ? '仅限同校' : '不限学校'}</Text>
          </View>
          <View className='info-item'>
            <Text className='info-item__label'>项目方向</Text>
            <Text className='info-item__value'>{team.target}</Text>
          </View>
        </View>
      </View>

      <AuthStatusCard
        className='section'
        loggedIn={loggedIn}
        userName={loggedIn ? user?.name : undefined}
        guestTitle='登录后再申请加入队伍'
        guestDescription='申请记录、审核结果和联系方式都会绑定到个人身份，后端接入后会直接落到这条链路里。'
        authedTitle='当前身份可直接申请加入'
        authedDescription='你现在可以发起申请、留言并接收组队消息，后续只需补齐审核和私信接口。'
        guestActionText='去登录'
        authedActionText='查看消息'
        onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
        onAuthedAction={() => Taro.navigateTo({ url: PAGE_ROUTES.messages })}
      />

      <View className='surface-card section stack'>
        <View>
          <Text className='section-title__text' style={{ fontSize: '28px' }}>
            急缺角色
          </Text>
          <View className='tag-row' style={{ marginTop: '14px' }}>
            {team.missingRoles.map((role) => (
              <Text key={role} className='tag tag--warn'>
                急缺 {role}
              </Text>
            ))}
          </View>
        </View>

        <View>
          <Text className='section-title__text' style={{ fontSize: '28px' }}>
            招募要求
          </Text>
          <View className='stack' style={{ marginTop: '14px' }}>
            {team.requirements.map((item, index) => (
              <View key={item} className='step-row'>
                <View className='step-row__index'>
                  <Text>{index + 1}</Text>
                </View>
                <Text className='step-row__text'>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='surface-card surface-card--compact'>
          <Text className='section-title__text' style={{ fontSize: '28px' }}>
            发起人
          </Text>
          <View className='menu-row__meta' style={{ marginTop: '14px' }}>
            <View className='avatar'>
              <Text>{team.authorMark}</Text>
            </View>
            <View>
              <Text className='menu-row__title'>{team.authorName}</Text>
              <Text className='menu-row__desc'>
                {team.authorGrade} · {team.authorMajor}
              </Text>
              <Text className='menu-row__desc'>{team.contactHint}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className='bottom-bar'>
        <View
          className='bottom-bar__minor pill-button pill-button--ghost'
          onClick={() => {
            if (!ensureLoggedIn({ message: '登录后才能留言' })) {
              return;
            }

            showPendingToast('留言能力接入中');
          }}
          hoverClass='pressable--hover'
        >
          <Text>{loggedIn ? '留言' : '登录后留言'}</Text>
        </View>
        <View
          className='bottom-bar__major pill-button pill-button--primary'
          onClick={() => void handleApply()}
          hoverClass='pressable--hover'
        >
          <Text>
            {loggedIn
              ? team.viewer?.hasApplied
                ? '已申请，查看消息'
                : '申请加入'
              : '登录后申请加入'}
          </Text>
        </View>
      </View>
    </View>
  );
}
