import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getRuntimeModeLabel } from '../../config/runtime';
import { PAGE_ROUTES } from '../../constants/routes';
import { loginWithWechat } from '../../services/app-service';
import { showPendingToast, showSuccessToast } from '../../utils/feedback';
import { pageTopInset } from '../../utils/layout';

const loginHighlights = [
  '登录后开始接微信身份、用户资料与权限链路',
  '登录、首页、竞赛、资源、组队会优先走统一远程接口',
  '当前保留 Mock 回退，便于前后端并行开发',
];

export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    Taro.showLoading({ title: '登录中' });

    try {
      const session = await loginWithWechat();
      Taro.hideLoading();
      showSuccessToast(session.mode === 'remote' ? '微信登录成功' : '远程接口未就绪，已回退到本地会话');
      setTimeout(() => {
        Taro.switchTab({ url: PAGE_ROUTES.profile });
      }, 300);
    } catch (error) {
      Taro.hideLoading();
      showPendingToast(error instanceof Error ? error.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className='page-shell' style={{ paddingTop: `${pageTopInset}px` }}>
      <View className='hero-panel hero-panel--auth' style={{ background: 'linear-gradient(135deg, #0f172a 0%, #2563eb 100%)' }}>
        <Text className='hero-panel__eyebrow'>微信登录</Text>
        <Text className='hero-panel__title'>把前端先跑通，再把真实身份链路接进来。</Text>
        <Text className='hero-panel__desc'>
          当前运行模式：{getRuntimeModeLabel()}。后续只要后端给出真实接口，这里切换开关即可联调。
        </Text>
      </View>

      <View className='surface-card section stack'>
        <Text className='section-title__text' style={{ fontSize: '28px' }}>
          这一步会打通
        </Text>
        {loginHighlights.map((item, index) => (
          <View key={item} className='step-row'>
            <View className='step-row__index'>
              <Text>{index + 1}</Text>
            </View>
            <Text className='step-row__text'>{item}</Text>
          </View>
        ))}
      </View>

      <View
        className='pill-button pill-button--primary section'
        onClick={handleLogin}
        hoverClass='pressable--hover'
      >
        <Text>{submitting ? '登录中...' : '微信一键登录'}</Text>
      </View>
    </View>
  );
}
