import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  DB_PROVIDER: 'sqlite',
  DB_PATH: 'server/data/campus-growth-local-preview.db',
  STORAGE_PROVIDER: 'local',
  WECHAT_LOGIN_MODE: 'mock',
  PAYMENTS_ENABLED: 'false',
  TEAM_SHOWCASE_SCHOOL_ID: 'sch_114',
};

for (const args of [
  ['tsx', 'scripts/seed-local-preview.ts'],
  ['tsx', 'scripts/enrich-official-content.ts', '--apply'],
  ['tsx', 'scripts/configure-team-showcase.ts', '--apply'],
]) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
