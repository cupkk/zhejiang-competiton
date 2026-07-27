import type { LoginSession } from '../frontend/src/types/api';
import { serverConfig } from './config.ts';
import {
  addDays,
  buildCurrentUser,
  createId,
  getOne,
  getUserRowById,
  makeToken,
  nowIso,
  run,
} from './helpers.ts';
import type { UserRow } from './models.ts';
import { resolveWechatIdentity } from './wechat.ts';

function createDefaultProfileSeed(openId: string) {
  const suffix = openId.slice(-4).toUpperCase();
  return {
    id: createId('u'),
    name: `微信用户${suffix}`,
    mark: suffix.slice(0, 1) || '新',
    avatarUrl: '',
    school: '待补充学校',
    major: '待补充专业',
    grade: '待补充年级',
    bio: '',
    focusTags: [],
  };
}

export async function loginWithWechatCode(code: string): Promise<LoginSession> {
  const identity = await resolveWechatIdentity(code);

  let user = getOne<UserRow>(
    `
      SELECT id, open_id, union_id, session_key, name, mark, avatar_url, school, major, grade, bio, focus_tags_json
      FROM users
      WHERE open_id = @openId
    `,
    { openId: identity.openId }
  );

  if (!user) {
    const profile = createDefaultProfileSeed(identity.openId);
    run(
      `
        INSERT INTO users (
          id, open_id, union_id, session_key, name, mark, avatar_url, school, major, grade, bio, focus_tags_json, created_at, updated_at
        ) VALUES (
          @id, @openId, @unionId, @sessionKey, @name, @mark, @avatarUrl, @school, @major, @grade, @bio, @focusTagsJson, @createdAt, @updatedAt
        )
      `,
      {
        id: profile.id,
        openId: identity.openId,
        unionId: identity.unionId || null,
        sessionKey: identity.sessionKey || null,
        name: profile.name,
        mark: profile.mark,
        avatarUrl: profile.avatarUrl,
        school: profile.school,
        major: profile.major,
        grade: profile.grade,
        bio: profile.bio,
        focusTagsJson: JSON.stringify(profile.focusTags),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
    );
    user = getUserRowById(profile.id);
  } else {
    run(
      `
        UPDATE users
        SET union_id = COALESCE(@unionId, union_id),
            session_key = COALESCE(@sessionKey, session_key),
            updated_at = @updatedAt
        WHERE id = @userId
      `,
      {
        unionId: identity.unionId || null,
        sessionKey: identity.sessionKey || null,
        updatedAt: nowIso(),
        userId: user.id,
      }
    );
  }

  const token = makeToken();
  run(
    `
      INSERT INTO sessions (token, user_id, mode, expires_at, created_at)
      VALUES (@token, @userId, 'remote', @expiresAt, @createdAt)
    `,
    {
      token,
      userId: user.id,
      expiresAt: addDays(serverConfig.sessionTtlDays),
      createdAt: nowIso(),
    }
  );

  return {
    token,
    mode: 'remote',
    user: buildCurrentUser(user.id),
  };
}
