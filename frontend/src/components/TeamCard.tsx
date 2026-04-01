import { View, Text } from '@tarojs/components';
import type { TeamItem } from '../types/entities';

interface TeamCardProps {
  team: TeamItem;
  onClick?: () => void;
}

export function TeamCard({ team, onClick }: TeamCardProps) {
  return (
    <View className='team-card interactive-card' onClick={onClick} hoverClass='pressable--hover'>
      <View className='team-card__body'>
        <View className='split-row'>
          <View className='menu-row__meta'>
            <View className='avatar avatar--small'>
              <Text>{team.authorMark}</Text>
            </View>
            <View>
              <Text className='menu-row__title'>{team.authorName} · 招募队友</Text>
              <Text className='menu-row__desc'>{team.compName}</Text>
            </View>
          </View>
          <Text className='tag tag--strong'>缺 {team.max - team.current} 人</Text>
        </View>
        <Text className='team-card__title' style={{ marginTop: '18px' }}>
          {team.title}
        </Text>
        <Text className='page-subtitle' style={{ marginTop: '10px', fontSize: '22px' }}>
          目标：{team.target}
        </Text>
        <View className='tag-row' style={{ marginTop: '16px' }}>
          {team.missingRoles.map((role) => (
            <Text key={role} className='tag'>
              {role}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}
