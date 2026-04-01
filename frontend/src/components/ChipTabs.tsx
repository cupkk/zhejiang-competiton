import { View, Text } from '@tarojs/components';

interface ChipTabsProps<T extends string> {
  items: readonly T[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ChipTabs<T extends string>({ items, active, onChange, className }: ChipTabsProps<T>) {
  return (
    <View className={`tab-strip ${className ?? ''}`}>
      {items.map((item) => (
        <View
          key={item}
          className={`tab-strip__item ${active === item ? 'tab-strip__item--active' : ''}`}
          onClick={() => onChange(item)}
        >
          <Text>{item}</Text>
        </View>
      ))}
    </View>
  );
}
