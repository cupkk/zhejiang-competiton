import { useState } from 'react';
import { View, Text, Input, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { ChipTabs } from '../../components/ChipTabs';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { PUBLISH_POST_CATEGORY_OPTIONS } from '../../constants/enums';
import { buildPostDetailRoute, PAGE_ROUTES } from '../../constants/routes';
import { useRequestState } from '../../hooks/useRequestState';
import { publishPost } from '../../services/app-service';
import type { PostCategory, PostItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { showSuccessToast } from '../../utils/feedback';

export default function PublishPostPage() {
  const [category, setCategory] = useState<Exclude<PostCategory, '推荐'>>(PUBLISH_POST_CATEGORY_OPTIONS[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const { status: submitStatus, errorMessage: submitError, run: runSubmit } =
    useRequestState<PostItem | null>({
      initialData: null,
      fallbackData: null,
      errorMessage: '发布失败，请稍后重试。',
    });

  const handleSubmit = async () => {
    if (submitStatus === 'loading') {
      return;
    }

    if (!ensureLoggedIn({ message: '登录后才能发布帖子' })) {
      return;
    }

    if (!title.trim() || !content.trim()) {
      Taro.showToast({ title: '请先补全标题和正文', icon: 'none' });
      return;
    }

    const created = await runSubmit(() =>
      publishPost({
        title: title.trim(),
        category,
        content: content.trim(),
        tags: tags
          .split(/[，,\s]/)
          .map((item) => item.trim())
          .filter(Boolean),
      })
    );

    if (!created) {
      return;
    }

    showSuccessToast('帖子已发布');
    setTimeout(() => {
      Taro.navigateTo({ url: buildPostDetailRoute(created.id) });
    }, 300);
  };

  return (
    <View className='page-shell page-shell--detail'>
      <TopBar title='发布帖子' />

      <View className='surface-card stack'>
        <Text className='section-title__text' style={{ fontSize: '28px' }}>
          内容分类
        </Text>
        <ChipTabs
          items={PUBLISH_POST_CATEGORY_OPTIONS}
          active={category}
          onChange={(value) => setCategory(value as typeof category)}
        />
      </View>

      <View className='surface-card section stack'>
        <View className='field-shell'>
          <Text className='field-shell__label'>标题</Text>
          <Input
            className='field-shell__input'
            value={title}
            placeholder='例如：我是怎么在大二拿下挑战杯省奖的'
            onInput={(e) => setTitle(e.detail.value)}
          />
        </View>

        <View className='field-shell'>
          <Text className='field-shell__label'>正文</Text>
          <Textarea
            className='field-shell__textarea field-shell__textarea--tall'
            value={content}
            placeholder='把你的过程、判断、踩坑和建议写清楚，后面会直接沉淀到社区。'
            onInput={(e) => setContent(e.detail.value)}
          />
        </View>

        <View className='field-shell'>
          <Text className='field-shell__label'>标签</Text>
          <Input
            className='field-shell__input'
            value={tags}
            placeholder='挑战杯，经验分享，组队'
            onInput={(e) => setTags(e.detail.value)}
          />
        </View>
      </View>

      {submitStatus === 'loading' ? (
        <RequestStateCard
          mode='loading'
          title='正在发布帖子'
          description='正在同步标题、正文和标签内容。'
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
          description='重新登录后再发布帖子，当前编辑内容仍会保留在页面中。'
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
          <Text>{submitStatus === 'loading' ? '发布中...' : '发布帖子'}</Text>
        </View>
      </View>
    </View>
  );
}
