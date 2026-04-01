import { View, Text, Input } from '@tarojs/components';

interface SearchBarProps {
  placeholder: string;
  value?: string;
  readonly?: boolean;
  actionText?: string;
  onChange?: (value: string) => void;
  onClick?: () => void;
  onConfirm?: () => void;
  onAction?: () => void;
}

export function SearchBar({
  placeholder,
  value,
  readonly = false,
  actionText,
  onChange,
  onClick,
  onConfirm,
  onAction,
}: SearchBarProps) {
  return (
    <View className={`search-shell ${readonly ? 'search-shell--readonly' : ''}`} onClick={readonly ? onClick : undefined}>
      <View className='search-shell__icon'>
        <Text>搜</Text>
      </View>
      {readonly ? (
        <Text className='search-shell__placeholder'>{value || placeholder}</Text>
      ) : (
        <Input
          className='search-shell__input'
          value={value}
          placeholder={placeholder}
          onInput={(event) => onChange?.(event.detail.value)}
          onConfirm={onConfirm}
        />
      )}
      {actionText ? (
        <View className='search-shell__action' onClick={onAction}>
          <Text>{actionText}</Text>
        </View>
      ) : null}
    </View>
  );
}
