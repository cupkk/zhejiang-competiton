import { View, Text } from '@tarojs/components';

interface AuthStatusCardProps {
  loggedIn: boolean;
  userName?: string;
  guestTitle: string;
  guestDescription: string;
  authedTitle: string;
  authedDescription: string;
  guestActionText: string;
  authedActionText: string;
  onGuestAction: () => void;
  onAuthedAction: () => void;
  className?: string;
}

export function AuthStatusCard({
  loggedIn,
  userName,
  guestTitle,
  guestDescription,
  authedTitle,
  authedDescription,
  guestActionText,
  authedActionText,
  onGuestAction,
  onAuthedAction,
  className = '',
}: AuthStatusCardProps) {
  return (
    <View className={`auth-status-card surface-card surface-card--soft ${className}`.trim()}>
      <View className='split-row auth-status-card__head'>
        <View>
          <Text className={`tag ${loggedIn ? 'tag--strong' : 'tag--warn'}`}>
            {loggedIn ? '已登录' : '未登录'}
          </Text>
          <Text className='auth-status-card__title'>
            {loggedIn ? authedTitle : guestTitle}
          </Text>
          <Text className='auth-status-card__desc'>
            {loggedIn ? authedDescription : guestDescription}
          </Text>
        </View>

        {loggedIn && userName ? (
          <View className='auth-status-card__user'>
            <Text>{userName}</Text>
          </View>
        ) : null}
      </View>

      <View
        className={`pill-button ${loggedIn ? 'pill-button--ghost' : 'pill-button--primary'} auth-status-card__action`}
        onClick={loggedIn ? onAuthedAction : onGuestAction}
        hoverClass='pressable--hover'
      >
        <Text>{loggedIn ? authedActionText : guestActionText}</Text>
      </View>
    </View>
  );
}
