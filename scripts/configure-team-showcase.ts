import { serverConfig } from '../server/config.ts';
import { getAll, getOne, run } from '../server/helpers.ts';
import { ensureTeamExamplesForSchool } from '../server/team-example-service.ts';

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const productionConfirmed = args.has('--confirm-production');

const before = getAll<{ school_name: string; count: number }>(
  `SELECT s.name AS school_name, COUNT(*) AS count
   FROM teams t
   JOIN schools s ON s.id = t.school_id
   WHERE t.is_example = 1
   GROUP BY s.name
   ORDER BY s.name`,
);

if (!shouldApply) {
  console.log(JSON.stringify({ mode: 'dry_run', showcaseSchoolId: serverConfig.teamShowcaseSchoolId, before }, null, 2));
  process.exit(0);
}

if (serverConfig.databaseProvider === 'postgres' && !productionConfirmed) {
  throw new Error('production_confirmation_required');
}

const school = getOne<{ id: string; name: string }>(
  'SELECT id, name FROM schools WHERE id = @schoolId',
  { schoolId: serverConfig.teamShowcaseSchoolId },
);
if (!school || school.name !== '浙江大学') {
  throw new Error('team_showcase_school_mismatch');
}

run(
  `DELETE FROM moderation_tasks
   WHERE target_type = 'team' AND target_id IN (SELECT id FROM teams WHERE is_example = 1)`,
);
run('DELETE FROM notifications WHERE link_type = \'team\' AND link_id IN (SELECT id FROM teams WHERE is_example = 1)');
run('DELETE FROM team_contact_views WHERE team_id IN (SELECT id FROM teams WHERE is_example = 1)');
run('DELETE FROM team_applications WHERE team_id IN (SELECT id FROM teams WHERE is_example = 1)');
run('DELETE FROM teams WHERE is_example = 1');

ensureTeamExamplesForSchool(school.id, true);

const after = getAll<{ school_name: string; listing_type: string; count: number }>(
  `SELECT s.name AS school_name, t.listing_type, COUNT(*) AS count
   FROM teams t
   JOIN schools s ON s.id = t.school_id
   WHERE t.is_example = 1
   GROUP BY s.name, t.listing_type
   ORDER BY s.name, t.listing_type`,
);

console.log(JSON.stringify({ mode: 'applied', showcaseSchoolId: school.id, before, after }, null, 2));
process.exit(0);
