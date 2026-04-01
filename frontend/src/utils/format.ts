import { COMMON_FREE_LABEL } from '../constants/enums';

export function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}w`;
  }

  return `${value}`;
}

export function formatPrice(value: number) {
  return value === 0 ? COMMON_FREE_LABEL : `¥${value}`;
}
