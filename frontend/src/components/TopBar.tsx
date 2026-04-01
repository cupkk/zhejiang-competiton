import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PAGE_ROUTES } from '../constants/routes';
import { statusBarHeight } from '../utils/layout';

interface TopBarProps {
  title: string;
  showBack?: boolean;
  rightText?: string;
  light?: boolean;
  overlay?: boolean;
  onRightClick?: () => void;
}

export function TopBar({
  title,
  showBack = true,
  rightText,
  light = false,
  overlay = false,
  onRightClick,
}: TopBarProps) {
  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack({ delta: 1 });
      return;
    }

    Taro.switchTab({ url: PAGE_ROUTES.home });
  };

  const className = ['top-bar', overlay ? 'top-bar--overlay' : '', light ? 'top-bar--light' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <View className={className} style={{ paddingTop: `${statusBarHeight + 10}px` }}>
      {showBack ? (
        <View className='top-bar__action' onClick={handleBack} hoverClass='pressable--hover'>
          <Text>返回</Text>
        </View>
      ) : (
        <View className='top-bar__placeholder' />
      )}

      <Text className='top-bar__title'>{title}</Text>

      {rightText ? (
        <View className='top-bar__action' onClick={onRightClick} hoverClass='pressable--hover'>
          <Text>{rightText}</Text>
        </View>
      ) : (
        <View className='top-bar__placeholder' />
      )}
    </View>
  );
}
