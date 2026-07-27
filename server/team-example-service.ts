import { getAll, getOne, getVerifiedActiveSchoolId, nowIso, run } from './helpers.ts';
import { teamExampleTemplates } from './team-example-templates.ts';
import { serverConfig } from './config.ts';

const EXAMPLE_LIFETIME_DAYS = 45;

function shanghaiDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(value);
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function ensureTeamExamplesForSchool(schoolId: string, ignoreRealTeamThreshold = false) {
  if (!schoolId) return;

  const today = shanghaiDate();
  const realTeamCount = Number(
    getOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM teams
       WHERE school_id = @schoolId AND moderation_status = 'approved' AND is_example = 0
         AND (deadline = '' OR deadline >= @today)`,
      { schoolId, today },
    )?.count ?? 0,
  );
  if (!ignoreRealTeamThreshold && realTeamCount >= 3) return;

  const existingIds = new Set(
    getAll<{ id: string }>('SELECT id FROM teams WHERE school_id = @schoolId AND is_example = 1', { schoolId })
      .map((row) => row.id),
  );
  const createdAt = nowIso();
  const expiresAt = addDays(new Date(), EXAMPLE_LIFETIME_DAYS);
  const deadline = shanghaiDate(expiresAt);

  for (const item of teamExampleTemplates) {
    const id = `example_team_${schoolId}_${item.key}`;
    if (existingIds.has(id)) continue;
    run(
      `INSERT INTO teams (
         id, school_id, content_scope, listing_type, title, comp_id, comp_name, status, target, full_description,
         current_count, max_count, missing_roles_json, deadline, author_user_id, author_name, author_mark,
         author_grade, author_major, school_limit, requirements_json, goal_tags_json, capabilities_json,
         collaboration_mode, weekly_commitment, contact_hint, contact_email, visibility_scope, is_example, example_expires_at,
         moderation_status, created_at, updated_at
       ) VALUES (
         @id, @schoolId, 'school', @listingType, @title, @competitionId, @competitionName, '招募中', @target, @fullDescription,
         @currentCount, @maxCount, @missingRolesJson, @deadline, NULL, '校园成长内测示例', '例',
         '', '平台示例', 1, @requirementsJson, @goalsJson, @capabilitiesJson,
         @collaborationMode, @weeklyCommitment, '内测示例不提供真实联系方式', NULL, 'cross_school', 1, @exampleExpiresAt,
         'approved', @createdAt, @createdAt
       )`,
      {
        id,
        schoolId,
        listingType: item.listingType,
        title: item.title,
        competitionId: item.competitionId,
        competitionName: item.competitionName,
        target: item.target,
        fullDescription: item.fullDescription,
        currentCount: item.currentCount,
        maxCount: item.maxCount,
        missingRolesJson: JSON.stringify(item.missingRoles),
        deadline,
        requirementsJson: JSON.stringify(item.requirements),
        goalsJson: JSON.stringify(item.goals),
        capabilitiesJson: JSON.stringify(item.capabilities),
        collaborationMode: item.collaborationMode,
        weeklyCommitment: item.weeklyCommitment,
        exampleExpiresAt: expiresAt.toISOString(),
        createdAt,
      },
    );
  }
}

export function ensureTeamExamplesForVerifiedSchool(userId?: string) {
  const schoolId = getVerifiedActiveSchoolId(userId);
  if (!schoolId || schoolId !== serverConfig.teamShowcaseSchoolId) return;
  ensureTeamExamplesForSchool(schoolId);
}
