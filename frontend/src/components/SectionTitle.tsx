import { View, Text } from '@tarojs/components';

interface SectionTitleProps {
  title: string;
  actionText?: string;
  onAction?: () => void;
}

export function SectionTitle({ title, actionText, onAction }: SectionTitleProps) {
  return (
    <View className='section-title'>
      <Text className='section-title__text'>{title}</Text>
      {actionText ? (
        <Text className='section-title__action' onClick={onAction}>
          {actionText}
        </Text>
      ) : null}
    </View>
  );
}
