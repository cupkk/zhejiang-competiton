import type { AdminLoginPayload, AdminSession } from '../frontend/src/types/api';
import { hashAdminPassword, verifyAdminPassword } from './admin-security.ts';
import { serverConfig } from './config.ts';
import {
  addDays,
  buildAdminProfile,
  createId,
  getOne,
  makeToken,
  nowIso,
  run,
} from './helpers.ts';
import type { AdminUserRow } from './models.ts';

export function ensureBootstrapAdminUser() {
  const existing = getOne<{ id: string }>(`SELECT id FROM admin_users WHERE username = @username`, {
    username: serverConfig.adminBootstrap.username,
  });

  const now = nowIso();

  if (!existing) {
    run(
      `
        INSERT INTO admin_users (
          id, username, password_hash, display_name, role, permissions_json, school_id, school_name, status, created_at, updated_at
        ) VALUES (
          @id, @username, @passwordHash, @displayName, @role, @permissionsJson, NULL, NULL, 'active', @createdAt, @updatedAt
        )
      `,
      {
        id: createId('adm'),
        username: serverConfig.adminBootstrap.username,
        passwordHash: hashAdminPassword(serverConfig.adminBootstrap.password),
        displayName: serverConfig.adminBootstrap.displayName,
        role: 'super_admin',
        permissionsJson: JSON.stringify(serverConfig.adminPermissions.super_admin),
        createdAt: now,
        updatedAt: now,
      }
    );
    return;
  }

  run(
    `
      UPDATE admin_users
      SET display_name = @displayName,
          role = @role,
          permissions_json = @permissionsJson,
          school_id = NULL,
          school_name = NULL,
          updated_at = @updatedAt
      WHERE username = @username
    `,
    {
      username: serverConfig.adminBootstrap.username,
      displayName: serverConfig.adminBootstrap.displayName,
      role: 'super_admin',
      permissionsJson: JSON.stringify(serverConfig.adminPermissions.super_admin),
      updatedAt: now,
    }
  );
}

export function loginAdminWithPassword(payload: AdminLoginPayload): AdminSession {
  const username = payload.username.trim();
  const password = payload.password.trim();

  if (!username || !password) {
    throw new Error('admin_login_invalid');
  }

  const admin = getOne<AdminUserRow>(
    `
      SELECT id, username, password_hash, display_name, role, permissions_json, school_id, school_name, status, created_at, updated_at
      FROM admin_users
      WHERE username = @username
    `,
    { username }
  );

  if (!admin || admin.status !== 'active' || !verifyAdminPassword(password, admin.password_hash)) {
    throw new Error('admin_login_failed');
  }

  const token = makeToken();
  run(
    `
      INSERT INTO admin_sessions (token, admin_user_id, role, expires_at, created_at)
      VALUES (@token, @adminUserId, @role, @expiresAt, @createdAt)
    `,
    {
      token,
      adminUserId: admin.id,
      role: admin.role,
      expiresAt: addDays(serverConfig.adminSessionTtlDays),
      createdAt: nowIso(),
    }
  );

  return {
    token,
    admin: buildAdminProfile(admin.id),
  };
}

export function getCurrentAdmin(adminUserId: string) {
  return buildAdminProfile(adminUserId);
}

export function logoutAdminByToken(token: string) {
  if (!token) {
    return;
  }

  run(`DELETE FROM admin_sessions WHERE token = @token`, { token });
}
