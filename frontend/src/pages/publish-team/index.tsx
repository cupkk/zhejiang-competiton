import { useState } from 'react';
import { View, Text, Input, Textarea } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { ChipTabs } from '../../components/ChipTabs';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { TEAM_SCHOOL_LIMIT_OPTIONS } from '../../constants/enums';
import { buildTeamDetailRoute, PAGE_ROUTES } from '../../constants/routes';
import { useRequestState } from '../../hooks/useRequestState';
import { publishTeamRecruit } from '../../services/app-service';
import type { TeamItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { showSuccessToast } from '../../utils/feedback';

export default function PublishTeamPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [compName, setCompName] = useState(decodeURIComponent(router.params.compName ?? ''));
  const [target, setTarget] = useState('');
  const [missingRoles, setMissingRoles] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requirements, setRequirements] = useState('');
  const [contactHint, setContactHint] = useState('通过审核后开放联系方式');
  const [schoolLimit, setSchoolLimit] = useState<(typeof TEAM_SCHOOL_LIMIT_OPTIONS)[number]>(
    TEAM_SCHOOL_LIMIT_OPTIONS[0]
  );
  const { status: submitStatus, errorMessage: submitError, run: runSubmit } =
    useRequestState<TeamItem | null>({
      initialData: null,
      fallbackData: null,
      errorMessage: '提交失败，请稍后重试。',
    });

  const handleSubmit = async () => {
    if (submitStatus === 'loading') {
      return;
    }

    if (!ensureLoggedIn({ message: '登录后才能发布组队' })) {
      return;
    }

    if (!title.trim() || !target.trim() || !deadline.trim()) {
      Taro.showToast({ title: '请先补全标题、目标和截止时间', icon: 'none' });
      return;
    }

    const created = await runSubmit(() =>
      publishTeamRecruit({
        title: title.trim(),
        compId: router.params.compId,
        compName: compName.trim() || '未关联竞赛',
        target: target.trim(),
        missingRoles: missingRoles
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean),
        deadline: deadline.trim(),
        requirements: requirements
          .split(/[，,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
        schoolLimit: schoolLimit === '仅限同校',
        contactHint: contactHint.trim(),
      })
    );

    if (!created) {
      return;
    }

    showSuccessToast('已发布招募');
    setTimeout(() => {
      Taro.navigateTo({ url: buildTeamDetailRoute(created.id) });
    }, 300);
  };

  return (
    <View className='page-shell page-shell--detail'>
      <TopBar title='发布组队' />

      <View className='surface-card stack'>
        <Text className='section-title__text' style={{ fontSize: '28px' }}>
          基本信息
        </Text>

        <View className='field-shell'>
          <Text className='field-shell__label'>招募标题</Text>
          <Input
            className='field-shell__input'
            value={title}
            placeholder='例如：挑战杯项目招前端，已有后端和 UI'
            onInput={(e) => setTitle(e.detail.value)}
          />
        </View>

        <View className='field-shell'>
          <Text className='field-shell__label'>关联竞赛</Text>
          <Input
            className='field-shell__input'
            value={compName}
            placeholder='例如：挑战杯创业计划竞赛'
            onInput={(e) => setCompName(e.detail.value)}
          />
        </View>

        <View className='field-shell'>
          <Text className='field-shell__label'>目标说明</Text>
          <Textarea
            className='field-shell__textarea'
            value={target}
            placeholder='描述你们准备做什么、冲什么结果、目前推进到哪一步'
            onInput={(e) => setTarget(e.detail.value)}
          />
        </View>

        <View className='field-shell'>
          <Text className='field-shell__label'>缺失角色</Text>
          <Input
            className='field-shell__input'
            value={missingRoles}
            placeholder='前端开发，PPT 美化，产品策划'
            onInput={(e) => setMissingRoles(e.detail.value)}
          />
        </View>

        <View className='field-shell'>
          <Text className='field-shell__label'>截止日期</Text>
          <Input
            className='field-shell__input'
            value={deadline}
            placeholder='2026-04-10'
            onInput={(e) => setDeadline(e.detail.value)}
          />
        </View>
      </View>

      <View className='surface-card section stack'>
        <Text className='section-title__text' style={{ fontSize: '28px' }}>
          招募条件
        </Text>

        <ChipTabs
          items={[...TEAM_SCHOOL_LIMIT_OPTIONS]}
          active={schoolLimit}
          onChange={(value) => setSchoolLimit(value as (typeof TEAM_SCHOOL_LIMIT_OPTIONS)[number])}
        />

        <View className='field-shell'>
          <Text className='field-shell__label'>团队要求</Text>
          <Textarea
            className='field-shell__textarea'
            value={requirements}
            placeholder='按逗号或换行分隔，例如：稳定同步进度，愿意共享资料，有基础经验'
            onInput={(e) => setRequirements(e.detail.value)}
          />
        </View>

        <View className='field-shell'>
          <Text className='field-shell__label'>联系提示</Text>
          <Input
            className='field-shell__input'
            value={contactHint}
            placeholder='例如：审核通过后开放群二维码'
            onInput={(e) => setContactHint(e.detail.value)}
          />
        </View>
      </View>

      {submitStatus === 'loading' ? (
        <RequestStateCard
          mode='loading'
          title='正在提交组队招募'
          description='正在同步标题、招募条件和队伍信息。'
          className='section'
        />
      ) : null}

      {submitStatus === 'error' ? (
        <RequestStateCard
          mode='error'
          title='发布失败'
          description={submitError}
          actionText='重新提交'
          onAction={() => void handleSubmit()}
          className='section'
        />
      ) : null}

      {submitStatus === 'auth_expired' ? (
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后再提交组队招募，表单内容仍会保留在当前页面。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      ) : null}

      <View className='bottom-bar'>
        <View
          className='bottom-bar__minor pill-button pill-button--ghost'
          onClick={() => Taro.navigateBack()}
          hoverClass='pressable--hover'
        >
          <Text>取消</Text>
        </View>
        <View
          className='bottom-bar__major pill-button pill-button--primary'
          onClick={() => void handleSubmit()}
          hoverClass='pressable--hover'
        >
          <Text>{submitStatus === 'loading' ? '提交中...' : '发布招募'}</Text>
        </View>
      </View>
    </View>
  );
}
