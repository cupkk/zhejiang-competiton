import type { UserConfigExport } from '@tarojs/cli';
import { runtimeDefineConstants } from './shared';

export default {
  defineConstants: runtimeDefineConstants,
  mini: {},
  h5: {},
} satisfies UserConfigExport<'vite'>;
