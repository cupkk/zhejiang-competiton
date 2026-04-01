import { View, Text } from '@tarojs/components';
import type { ResourceItem } from '../types/entities';
import { formatPrice } from '../utils/format';

interface ResourceCardProps {
  resource: ResourceItem;
  onClick?: () => void;
  actionText?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

export function ResourceCard({
  resource,
  onClick,
  actionText,
  onAction,
  actionLoading = false,
}: ResourceCardProps) {
  const handleActionClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!actionLoading) {
      onAction?.();
    }
  };

  return (
    <View className='resource-list__card interactive-card' onClick={onClick} hoverClass='pressable--hover'>
      <View className='resource-list__cover' style={{ background: resource.coverGradient }}>
        <Text className='resource-list__cover-label'>{resource.type}</Text>
        <Text className='resource-list__cover-title'>{resource.coverLabel}</Text>
      </View>
      <View className='resource-list__body' style={{ padding: 0, flex: 1 }}>
        <Text className='resource-list__title'>{resource.title}</Text>
        <Text className='menu-row__desc' style={{ marginTop: '10px' }}>
          {resource.category} · {resource.authorName}
        </Text>
        <View className='tag-row' style={{ marginTop: '14px' }}>
          {resource.tags.slice(0, 3).map((tag) => (
            <Text key={tag} className='tag'>
              {tag}
            </Text>
          ))}
        </View>
        <View className='split-row' style={{ marginTop: '18px' }}>
          <Text className='metric-text'>
            {resource.downloads} 次下载 · {resource.rating} 分
          </Text>
          <Text className='metric-text metric-text--strong'>{formatPrice(resource.price)}</Text>
        </View>
        {onAction ? (
          <View style={{ marginTop: '18px' }}>
            <View
              className='pill-button pill-button--ghost'
              onClick={handleActionClick}
              hoverClass='pressable--hover'
            >
              <Text>{actionLoading ? '处理中...' : actionText || '执行操作'}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
