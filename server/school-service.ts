import { createHash, randomInt } from 'node:crypto';
import type {
  School,
  SchoolMembership,
  SchoolVerificationCodeResult,
  SchoolVerificationResult,
} from '../frontend/src/types/entities';
import type {
  SchoolQuery,
  SchoolVerificationCodePayload,
  SchoolVerificationVerifyPayload,
  SelectSchoolPayload,
} from '../frontend/src/types/api';
import { serverConfig } from './config.ts';
import {
  buildCurrentUser,
  createId,
  getActiveSchoolMembership,
  getAll,
  getOne,
  getSchoolRowById,
  getSchoolRowByName,
  nowIso,
  run,
} from './helpers.ts';
import type { SchoolRow, UserSchoolMembershipRow } from './models.ts';

function mapSchool(row: SchoolRow): School {
  return {
    id: row.id,
    sourceId: row.source_id || undefined,
    code: row.code || undefined,
    name: row.name,
    shortName: row.short_name || row.name,
    province: row.province || undefined,
    city: row.city || undefined,
    logoUrl: row.logo_url || undefined,
    isOpen: Boolean(row.is_open),
    isHot: Boolean(row.is_hot),
  };
}

function mapMembership(row: UserSchoolMembershipRow): SchoolMembership {
  return {
    id: row.id,
    schoolId: row.school_id,
    schoolName: row.school_name,
    role: row.role,
    certificationStatus: row.certification_status,
    educationEmail: row.education_email || undefined,
    phone: row.phone || undefined,
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    active: Boolean(row.active),
    verifiedAt: row.verified_at || undefined,
  };
}

function normalizeSearch(value: unknown) {
  return String(value || '').trim();
}

function getSchoolForSelection(payload: SelectSchoolPayload) {
  if (payload.schoolId) {
    return getSchoolRowById(payload.schoolId);
  }

  if (payload.school) {
    const school = getSchoolRowByName(payload.school);
    if (school) {
      return school;
    }
  }

  throw new Error('school_not_found');
}

function ensureMembership(userId: string, school: SchoolRow) {
  const now = nowIso();
  const existing = getOne<UserSchoolMembershipRow>(
    `
      SELECT id, user_id, school_id, school_name, role, certification_status, education_email, phone,
             email_verified, phone_verified, active, verified_at, created_at, updated_at
      FROM user_school_memberships
      WHERE user_id = @userId AND school_id = @schoolId
    `,
    { userId, schoolId: school.id }
  );

  run(`UPDATE user_school_memberships SET active = 0, updated_at = @updatedAt WHERE user_id = @userId`, {
    userId,
    updatedAt: now,
  });

  if (existing) {
    run(
      `
        UPDATE user_school_memberships
        SET school_name = @schoolName,
            active = 1,
            updated_at = @updatedAt
        WHERE id = @id
      `,
      {
        id: existing.id,
        schoolName: school.name,
        updatedAt: now,
      }
    );
    return existing.id;
  }

  const id = createId('usm');
  run(
    `
      INSERT INTO user_school_memberships (
        id, user_id, school_id, school_name, role, certification_status,
        education_email, phone, email_verified, phone_verified, active, verified_at, created_at, updated_at
      ) VALUES (
        @id, @userId, @schoolId, @schoolName, 'student', 'unverified',
        NULL, NULL, 0, 0, 1, NULL, @createdAt, @updatedAt
      )
    `,
    {
      id,
      userId,
      schoolId: school.id,
      schoolName: school.name,
      createdAt: now,
      updatedAt: now,
    }
  );
  return id;
}

function hashVerificationCode(params: { userId: string; schoolId: string; channel: string; target: string; code: string }) {
  return createHash('sha256')
    .update(`${params.userId}:${params.schoolId}:${params.channel}:${params.target}:${params.code}`)
    .digest('hex');
}

function normalizeChannel(value: unknown) {
  const channel = String(value || '').trim();
  if (channel === 'email' || channel === 'phone') {
    return channel;
  }
  throw new Error('verification_channel_invalid');
}

function normalizeTarget(channel: 'email' | 'phone', value: unknown) {
  const target = String(value || '').trim();

  if (channel === 'email') {
    const normalized = target.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !normalized.split('@')[1]?.includes('.edu')) {
      throw new Error('education_email_invalid');
    }
    return normalized;
  }

  const normalized = target.replace(/\s+/g, '');
  if (!/^1[3-9]\d{9}$/.test(normalized)) {
    throw new Error('phone_invalid');
  }
  return normalized;
}

function getCurrentSchoolOrThrow(userId: string, schoolId?: string) {
  if (schoolId) {
    return getSchoolRowById(schoolId);
  }

  const membership = getActiveSchoolMembership(userId);
  if (!membership) {
    throw new Error('user_school_required');
  }

  return getSchoolRowById(membership.school_id);
}

function getLatestVerificationCode(params: { userId: string; schoolId: string; channel: string; target: string }) {
  return getOne<{
    id: string;
    code_hash: string;
    attempts: number;
    expires_at: string;
    consumed_at: string | null;
  }>(
    `
      SELECT id, code_hash, attempts, expires_at, consumed_at
      FROM school_verification_codes
      WHERE user_id = @userId
        AND school_id = @schoolId
        AND channel = @channel
        AND target = @target
      ORDER BY created_at DESC
      LIMIT 1
    `,
    params
  );
}

export function listSchools(query: SchoolQuery = {}) {
  const keyword = normalizeSearch(query.keyword);
  const hotOnly = query.hotOnly === true || String(query.hotOnly) === 'true';
  const limit = Math.max(1, Math.min(Number(query.limit || (keyword ? 80 : hotOnly ? 32 : 80)), 200));
  const queryLimit = Math.min(limit * 2, 400);

  const rows = getAll<SchoolRow>(
    `
      SELECT id, source_id, code, name, short_name, province, city, logo_url, is_open, is_hot, sort_order, created_at, updated_at
      FROM schools
      WHERE is_open = 1
        AND (@hotOnly = 0 OR is_hot = 1)
        AND (
          @keyword = ''
          OR name LIKE @search
          OR short_name LIKE @search
          OR province LIKE @search
          OR city LIKE @search
          OR code LIKE @search
        )
      ORDER BY is_hot DESC,
               CASE WHEN id LIKE 'sch_%' THEN 0 ELSE 1 END,
               sort_order ASC,
               name ASC
      LIMIT @limit
    `,
    {
      keyword,
      search: `%${keyword}%`,
      hotOnly: hotOnly ? 1 : 0,
      limit: queryLimit,
    }
  );

  const seenNames = new Set<string>();
  const schools: School[] = [];
  for (const row of rows) {
    const nameKey = row.name.trim();
    if (seenNames.has(nameKey)) {
      continue;
    }
    seenNames.add(nameKey);
    schools.push(mapSchool(row));
    if (schools.length >= limit) {
      break;
    }
  }
  return schools;
}

export function getSchoolLogoSource(schoolId: string) {
  const school = getSchoolRowById(schoolId);
  if (!school) {
    throw new Error('school_not_found');
  }

  return school.logo_url || null;
}

export function selectCurrentUserSchool(userId: string, payload: SelectSchoolPayload) {
  const school = getSchoolForSelection(payload);
  ensureMembership(userId, school);
  run(
    `
      UPDATE users
      SET school_id = @schoolId,
          school = @schoolName,
          updated_at = @updatedAt
      WHERE id = @userId
    `,
    {
      userId,
      schoolId: school.id,
      schoolName: school.name,
      updatedAt: nowIso(),
    }
  );

  return buildCurrentUser(userId);
}

export function listCurrentUserSchoolMemberships(userId: string) {
  return getAll<UserSchoolMembershipRow>(
    `
      SELECT id, user_id, school_id, school_name, role, certification_status, education_email, phone,
             email_verified, phone_verified, active, verified_at, created_at, updated_at
      FROM user_school_memberships
      WHERE user_id = @userId
      ORDER BY active DESC, updated_at DESC
    `,
    { userId }
  ).map(mapMembership);
}

export function requestSchoolVerificationCode(
  userId: string,
  payload: SchoolVerificationCodePayload
): SchoolVerificationCodeResult {
  const channel = normalizeChannel(payload.channel);
  const school = getCurrentSchoolOrThrow(userId, payload.schoolId);
  const target = normalizeTarget(channel, payload.target);
  ensureMembership(userId, school);

  const code = String(randomInt(100000, 1000000));
  const createdAt = nowIso();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  run(
    `
      INSERT INTO school_verification_codes (
        id, user_id, school_id, channel, target, code_hash, attempts, expires_at, consumed_at, created_at
      ) VALUES (
        @id, @userId, @schoolId, @channel, @target, @codeHash, 0, @expiresAt, NULL, @createdAt
      )
    `,
    {
      id: createId('svc'),
      userId,
      schoolId: school.id,
      channel,
      target,
      codeHash: hashVerificationCode({ userId, schoolId: school.id, channel, target, code }),
      expiresAt: expires,
      createdAt,
    }
  );

  return {
    channel,
    target,
    expiresAt: expires,
    debugCode: serverConfig.verificationDebugCodeVisible ? code : undefined,
  };
}

export function verifySchoolVerificationCode(
  userId: string,
  payload: SchoolVerificationVerifyPayload
): SchoolVerificationResult {
  const channel = normalizeChannel(payload.channel);
  const school = getCurrentSchoolOrThrow(userId, payload.schoolId);
  const target = normalizeTarget(channel, payload.target);
  const code = String(payload.code || '').trim();

  if (!/^\d{6}$/.test(code)) {
    throw new Error('verification_code_invalid');
  }

  const row = getLatestVerificationCode({ userId, schoolId: school.id, channel, target });
  if (!row || row.consumed_at) {
    throw new Error('verification_code_invalid');
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    throw new Error('verification_code_expired');
  }

  if (row.attempts >= 5) {
    throw new Error('verification_code_locked');
  }

  const codeHash = hashVerificationCode({ userId, schoolId: school.id, channel, target, code });
  if (codeHash !== row.code_hash) {
    run(`UPDATE school_verification_codes SET attempts = attempts + 1 WHERE id = @id`, { id: row.id });
    throw new Error('verification_code_invalid');
  }

  const now = nowIso();
  run(`UPDATE school_verification_codes SET consumed_at = @consumedAt WHERE id = @id`, {
    id: row.id,
    consumedAt: now,
  });

  ensureMembership(userId, school);
  run(
    `
      UPDATE user_school_memberships
      SET education_email = CASE WHEN @channel = 'email' THEN @target ELSE education_email END,
          phone = CASE WHEN @channel = 'phone' THEN @target ELSE phone END,
          email_verified = CASE WHEN @channel = 'email' THEN 1 ELSE email_verified END,
          phone_verified = CASE WHEN @channel = 'phone' THEN 1 ELSE phone_verified END,
          certification_status = CASE
            WHEN (CASE WHEN @channel = 'email' THEN 1 ELSE email_verified END) = 1
             AND (CASE WHEN @channel = 'phone' THEN 1 ELSE phone_verified END) = 1
            THEN 'verified'
            ELSE 'pending'
          END,
          verified_at = CASE
            WHEN (CASE WHEN @channel = 'email' THEN 1 ELSE email_verified END) = 1
             AND (CASE WHEN @channel = 'phone' THEN 1 ELSE phone_verified END) = 1
            THEN @verifiedAt
            ELSE verified_at
          END,
          updated_at = @updatedAt
      WHERE user_id = @userId AND school_id = @schoolId
    `,
    {
      userId,
      schoolId: school.id,
      channel,
      target,
      verifiedAt: now,
      updatedAt: now,
    }
  );

  const membership = getActiveSchoolMembership(userId);
  if (!membership) {
    throw new Error('user_school_required');
  }

  return {
    membership: mapMembership(membership),
    user: buildCurrentUser(userId),
  };
}
