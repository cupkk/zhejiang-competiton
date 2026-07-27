import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizeInternalRoute } from '../frontend/src/app/lib/routes.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fallback = '/profile';
const validCases = new Map<string, string>([
  ['/', '/'],
  ['/resources/r1?from=home#download', '/resources/r1?from=home#download'],
  ['/admin%2flogin', '/admin/login'],
]);

for (const [input, expected] of validCases) {
  assert(normalizeInternalRoute(input, fallback) === expected, `valid route was rejected: ${input}`);
}

const unsafeCases = [
  '',
  'https://evil.example/path',
  '//evil.example/path',
  '///evil.example/path',
  '\\evil.example/path',
  '/\\evil.example/path',
  '/%5cevil.example/path',
  '/%255cevil.example/path',
  '/%2f%2fevil.example/path',
  '/%252f%252fevil.example/path',
  '/%00evil.example/path',
  '/%2500evil.example/path',
  '/%2e%2e//evil.example/path',
  ' /profile',
];

for (const input of unsafeCases) {
  assert(normalizeInternalRoute(input, fallback) === fallback, `unsafe route was accepted: ${input}`);
}

const shellSource = readFileSync('wechat-shell/pages/webview/index.js', 'utf8');
let pageDefinition: Record<string, unknown> | undefined;
const shellContext = {
  Page(definition: Record<string, unknown>) {
    pageDefinition = definition;
  },
  getApp() {
    return { globalData: { webOrigin: 'https://campusgrow.top' } };
  },
  wx: {
    login(options: { success: (result: { code: string }) => void }) {
      options.success({ code: 'test-code' });
    },
  },
  Date,
  decodeURIComponent,
  encodeURIComponent,
};
vm.runInNewContext(shellSource, shellContext, { filename: 'wechat-shell/pages/webview/index.js' });
assert(pageDefinition, 'WeChat web-view page did not register');

function resolveShellUrl(path: string) {
  const instance = {
    ...pageDefinition,
    data: { loading: true, webUrl: '' },
    setData(values: { loading: boolean; webUrl: string }) {
      this.data = { ...this.data, ...values };
    },
  } as Record<string, unknown> & {
    data: { loading: boolean; webUrl: string };
    setData: (values: { loading: boolean; webUrl: string }) => void;
  };
  const onLoad = instance.onLoad as (this: typeof instance, options: { path: string }) => void;
  onLoad.call(instance, { path });
  return instance.data.webUrl;
}

assert(resolveShellUrl('/resources/r1').startsWith('https://campusgrow.top/resources/r1?'), 'safe shell path changed');
for (const input of unsafeCases.filter(Boolean)) {
  assert(resolveShellUrl(input).startsWith('https://campusgrow.top/?'), `unsafe shell route was accepted: ${input}`);
}

console.log('Internal route security checks passed for H5, admin login, and WeChat shell entry paths.');
