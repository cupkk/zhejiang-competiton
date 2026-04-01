import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { getRuntimeModeLabel } from './config/runtime';
import { syncCurrentUser } from './services/app-service';
import './app.scss';

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log(`校园成长小程序已启动，当前模式：${getRuntimeModeLabel()}`);
    syncCurrentUser().catch((error) => {
      console.warn('启动时同步当前用户失败。', error);
    });
  });

  return children;
}

export default App;
