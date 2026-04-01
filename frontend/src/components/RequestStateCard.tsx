import { View, Text } from '@tarojs/components';

type RequestStateMode = 'loading' | 'error' | 'auth_expired';

interface RequestStateCardProps {
  mode: RequestStateMode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

const tagMap: Record<RequestStateMode, string> = {
  loading: '加载中',
  error: '请求失败',
  auth_expired: '登录失效',
};

const markMap: Record<RequestStateMode, string> = {
  loading: '载',
  error: '错',
  auth_expired: '登',
};

export function RequestStateCard({
  mode,
  title,
  description,
  actionText,
  onAction,
  className,
}: RequestStateCardProps) {
  return (
    <View className={`request-state-card surface-card surface-card--soft ${className ?? ''}`.trim()}>
      <View className='request-state-card__head'>
        <View className='request-state-card__mark'>
          <Text>{markMap[mode]}</Text>
        </View>
        <View className='request-state-card__copy'>
          <Text className={`tag ${mode === 'auth_expired' ? 'tag--warn' : 'tag--strong'}`}>
            {tagMap[mode]}
          </Text>
          <Text className='request-state-card__title'>{title}</Text>
          <Text className='request-state-card__desc'>{description}</Text>
        </View>
      </View>

      {mode === 'loading' ? (
        <View className='request-state-card__skeleton'>
          <View className='request-state-card__line request-state-card__line--short' />
          <View className='request-state-card__line' />
          <View className='request-state-card__line request-state-card__line--long' />
        </View>
      ) : actionText && onAction ? (
        <View
          className={`pill-button ${mode === 'auth_expired' ? 'pill-button--primary' : 'pill-button--outline'} request-state-card__action`}
          onClick={onAction}
          hoverClass='pressable--hover'
        >
          <Text>{actionText}</Text>
        </View>
      ) : null}
    </View>
  );
}
