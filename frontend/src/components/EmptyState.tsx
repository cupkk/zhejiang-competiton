import { View, Text } from '@tarojs/components';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionText,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <View className={`empty-state ${className ?? ''}`.trim()}>
      <View className='empty-state__badge'>
        <Text>空</Text>
      </View>
      <Text className='empty-state__title'>{title}</Text>
      <Text className='empty-state__desc'>{description}</Text>
      {actionText && onAction ? (
        <View
          className='pill-button pill-button--outline empty-state__action'
          onClick={onAction}
          hoverClass='pressable--hover'
        >
          <Text>{actionText}</Text>
        </View>
      ) : null}
    </View>
  );
}
