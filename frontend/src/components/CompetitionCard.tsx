import { View, Text } from '@tarojs/components';
import type { Competition } from '../types/entities';
import { formatCount } from '../utils/format';

interface CompetitionCardProps {
  competition: Competition;
  onClick?: () => void;
  actionText?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

export function CompetitionCard({
  competition,
  onClick,
  actionText,
  onAction,
  actionLoading = false,
}: CompetitionCardProps) {
  const handleActionClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!actionLoading) {
      onAction?.();
    }
  };

  return (
    <View className='competition-list__card interactive-card' onClick={onClick} hoverClass='pressable--hover'>
      <View className='competition-list__hero' style={{ background: competition.coverGradient }}>
        <View className='split-row'>
          <Text className='tag tag--muted'>{competition.status}</Text>
          <Text className='metric-text' style={{ color: 'rgba(255,255,255,0.92)' }}>
            热度 {formatCount(competition.views)}
          </Text>
        </View>
        <Text className='cover-block__title'>{competition.title}</Text>
        <Text className='cover-block__meta'>
          {competition.category} · {competition.host}
        </Text>
      </View>
      <View className='competition-list__body'>
        <View className='tag-row'>
          <Text className='tag'>{competition.level}</Text>
          <Text className='tag'>{competition.difficulty}</Text>
          {competition.tags.slice(0, 2).map((tag) => (
            <Text key={tag} className='tag'>
              {tag}
            </Text>
          ))}
        </View>
        <View className='split-row' style={{ marginTop: '18px' }}>
          <Text className='metric-text'>截止 {competition.deadline}</Text>
          <Text className='metric-text metric-text--strong'>剩余 {competition.daysLeft} 天</Text>
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
