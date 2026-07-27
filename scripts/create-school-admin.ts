import 'dotenv/config';
import '../server/db.ts';
import { hashAdminPassword } from '../server/admin-security.ts';
import { serverConfig } from '../server/config.ts';
import { createId, getOne, nowIso, run } from '../server/helpers.ts';
import type { AdminUserRow, SchoolRow } from '../server/models.ts';

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim() || '';
}

const username = readArg('username') || process.env.SCHOOL_ADMIN_USERNAME || '';
const password = readArg('password') || process.env.SCHOOL_ADMIN_PASSWORD || '';
const displayName = readArg('display-name') || process.env.SCHOOL_ADMIN_DISPLAY_NAME || '学校管理员';
const schoolId = readArg('school-id') || process.env.SCHOOL_ADMIN_SCHOOL_ID || '';

if (!username || !password || !schoolId) {
  throw new Error(
    'missing_required_args: npm run create:school-admin -- --username=admin_zju --password=*** --school-id=sch_114 --display-name=浙江大学管理员'
  );
}

const school = getOne<SchoolRow>(
  `
    SELECT id, source_id, code, name, short_name, province, city, logo_url, is_open, is_hot, sort_order, created_at, updated_at
    FROM schools
    WHERE id = @schoolId
  `,
  { schoolId }
);

if (!school) {
  throw new Error(`school_not_found: ${schoolId}`);
}

const now = nowIso();
const permissionsJson = JSON.stringify(serverConfig.adminPermissions.school_admin);
const existing = getOne<AdminUserRow>(
  `
    SELECT id, username, password_hash, display_name, role, permissions_json, school_id, school_name, status, created_at, updated_at
    FROM admin_users
    WHERE username = @username
  `,
  { username }
);

if (existing) {
  run(
    `
      UPDATE admin_users
      SET password_hash = @passwordHash,
          display_name = @displayName,
          role = 'school_admin',
          permissions_json = @permissionsJson,
          school_id = @schoolId,
          school_name = @schoolName,
          status = 'active',
          updated_at = @updatedAt
      WHERE id = @id
    `,
    {
      id: existing.id,
      passwordHash: hashAdminPassword(password),
      displayName,
      permissionsJson,
      schoolId: school.id,
      schoolName: school.name,
      updatedAt: now,
    }
  );
  console.log(`Updated school admin ${username} for ${school.name} (${school.id}).`);
} else {
  run(
    `
      INSERT INTO admin_users (
        id, username, password_hash, display_name, role, permissions_json, school_id, school_name, status, created_at, updated_at
      ) VALUES (
        @id, @username, @passwordHash, @displayName, 'school_admin', @permissionsJson, @schoolId, @schoolName, 'active', @createdAt, @updatedAt
      )
    `,
    {
      id: createId('adm'),
      username,
      passwordHash: hashAdminPassword(password),
      displayName,
      permissionsJson,
      schoolId: school.id,
      schoolName: school.name,
      createdAt: now,
      updatedAt: now,
    }
  );
  console.log(`Created school admin ${username} for ${school.name} (${school.id}).`);
}
