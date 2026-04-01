import { APP_PAGE_LIST, TAB_BAR_ITEMS } from './constants/routes';

export default defineAppConfig({
  pages: [...APP_PAGE_LIST],
  window: {
    backgroundTextStyle: 'light',
    backgroundColor: '#f8fafc',
    navigationStyle: 'custom'
  },
  tabBar: {
    color: '#94a3b8',
    selectedColor: '#2563eb',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [...TAB_BAR_ITEMS]
  }
});
