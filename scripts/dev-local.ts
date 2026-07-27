import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const localDb = resolve(root, 'server/data/campus-growth-local-preview.db');
const baselineDb = resolve(root, 'server/data/campus-growth.db');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  DB_PROVIDER: 'sqlite',
  DB_PATH: 'server/data/campus-growth-local-preview.db',
  STORAGE_PROVIDER: 'local',
  WECHAT_LOGIN_MODE: 'mock',
  PAYMENTS_ENABLED: 'false',
  TEAM_SHOWCASE_SCHOOL_ID: 'sch_114',
  VITE_TEAM_SHOWCASE_MODE: 'true',
  API_PUBLIC_ORIGIN: 'http://127.0.0.1:8080',
  API_PORT: '8080',
};

mkdirSync(dirname(localDb), { recursive: true });
if (!existsSync(localDb) && existsSync(baselineDb)) copyFileSync(baselineDb, localDb);

const windowsShell = process.platform === 'win32';

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', (error) => {
      const code = 'code' in error ? error.code : '';
      if (code === 'EADDRINUSE') {
        rejectPort(new Error(`端口 ${port} 已被占用，请先停止现有本地服务后再启动。`));
        return;
      }
      rejectPort(error);
    });
    server.listen(port, () => {
      server.close((error) => (error ? rejectPort(error) : resolvePort()));
    });
  });
}

try {
  await Promise.all([assertPortAvailable(3001), assertPortAvailable(8080)]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const seed = spawnSync(npmCommand, ['run', 'seed:local'], { cwd: root, env, stdio: 'inherit', shell: windowsShell });
if (seed.error) {
  console.error(`Local seed failed: ${seed.error.message}`);
  process.exit(1);
}
if (seed.status !== 0) process.exit(seed.status || 1);

const children: ChildProcess[] = [
  spawn(npmCommand, ['run', 'start:api'], { cwd: root, env, stdio: 'inherit', shell: windowsShell }),
  spawn(npmCommand, ['run', 'dev', '--prefix', 'frontend', '--', '--port', '3001', '--strictPort'], {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: windowsShell,
  }),
];

console.log('Local app: http://127.0.0.1:3001/');
console.log('Local API: http://127.0.0.1:8080/api/health');

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(exitCode), 100).unref();
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping && code && code !== 0) stop(code);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
