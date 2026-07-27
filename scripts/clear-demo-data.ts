import 'dotenv/config';
import { Client } from 'pg';

const competitionIds = ['c1', 'c2', 'c3'];
const resourceIds = ['r1', 'r2', 'r3', 'r4', 'r_0c2b0fd620624b0c', 'r_b7e95ceab3b14ab9', 'r_e71f176f5bb544bc'];
const teamIds = ['t1', 't2', 't3'];
const postIds = ['p1', 'p2', 'p3'];
const notificationIds = ['m1', 'm2', 'm3', 'm4'];
const suggestionIds = ['s1', 's2', 's3', 's4', 's5'];
const favoriteIds = ['fav_competition_c2', 'fav_resource_r1'];
const ownedResourceIds = ['mr1', 'mr2'];
const orderIds = ['o1', 'o2'];

const contentIds = [...resourceIds, ...teamIds, ...postIds];
const mockUserPatterns = ['mock:%', 'mock-%'];
const postgresUrl = process.env.POSTGRES_URL;

if (!postgresUrl) {
  throw new Error('POSTGRES_URL is required');
}

async function deleteByUserPattern(client: Client, sql: string) {
  for (const pattern of mockUserPatterns) {
    await client.query(sql, [pattern]);
  }
}

async function main() {
  const client = new Client({ connectionString: postgresUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE home_feed_configs
       SET competition_ids_json = '[]',
           resource_ids_json = '[]',
           team_ids_json = '[]',
           post_ids_json = '[]'
       WHERE id = 'default'`,
    );

    await client.query(`DELETE FROM payment_events WHERE order_id = ANY($1::text[])`, [orderIds]);
    await client.query(`DELETE FROM refunds WHERE order_id = ANY($1::text[])`, [orderIds]);
    await client.query(`DELETE FROM resource_download_grants WHERE order_id = ANY($1::text[])`, [orderIds]);

    await client.query(
      `DELETE FROM moderation_tasks WHERE target_id = ANY($1::text[]) OR target_id = ANY($2::text[]) OR target_id = ANY($3::text[])`,
      [resourceIds, teamIds, postIds],
    );
    await deleteByUserPattern(
      client,
      `DELETE FROM moderation_tasks
       WHERE target_id IN (
         SELECT id FROM resources WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1)
         UNION
         SELECT id FROM teams WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1)
         UNION
         SELECT id FROM posts WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1)
       )`,
    );
    await client.query(`DELETE FROM reports WHERE target_id = ANY($1::text[])`, [contentIds]);
    await deleteByUserPattern(client, `DELETE FROM reports WHERE reporter_user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);

    await deleteByUserPattern(client, `DELETE FROM comment_likes WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await deleteByUserPattern(client, `DELETE FROM post_likes WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await deleteByUserPattern(client, `DELETE FROM comments WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await client.query(`DELETE FROM comments WHERE post_id = ANY($1::text[])`, [postIds]);
    await deleteByUserPattern(client, `DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1))`);

    await client.query(`DELETE FROM notifications WHERE id = ANY($1::text[])`, [notificationIds]);
    await deleteByUserPattern(client, `DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);

    await client.query(`DELETE FROM favorites WHERE id = ANY($1::text[])`, [favoriteIds]);
    await deleteByUserPattern(client, `DELETE FROM favorites WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);

    await client.query(`DELETE FROM competition_enrollments WHERE competition_id = ANY($1::text[])`, [competitionIds]);
    await deleteByUserPattern(client, `DELETE FROM competition_enrollments WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);

    await client.query(`DELETE FROM team_applications WHERE team_id = ANY($1::text[])`, [teamIds]);
    await deleteByUserPattern(client, `DELETE FROM team_applications WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);

    await client.query(`DELETE FROM orders WHERE id = ANY($1::text[])`, [orderIds]);
    await deleteByUserPattern(client, `DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);

    await client.query(`DELETE FROM owned_resources WHERE id = ANY($1::text[]) OR resource_id = ANY($2::text[])`, [ownedResourceIds, resourceIds]);
    await deleteByUserPattern(client, `DELETE FROM owned_resources WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);

    await client.query(`DELETE FROM resource_download_grants WHERE resource_id = ANY($1::text[])`, [resourceIds]);
    await deleteByUserPattern(client, `DELETE FROM resource_download_grants WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await deleteByUserPattern(
      client,
      `DELETE FROM resource_download_grants
       WHERE resource_id IN (SELECT id FROM resources WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1))`,
    );

    await client.query(`DELETE FROM resource_competitions WHERE resource_id = ANY($1::text[]) OR competition_id = ANY($2::text[])`, [
      resourceIds,
      competitionIds,
    ]);
    await deleteByUserPattern(
      client,
      `DELETE FROM resource_competitions
       WHERE resource_id IN (SELECT id FROM resources WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1))`,
    );

    await client.query(`DELETE FROM posts WHERE id = ANY($1::text[])`, [postIds]);
    await deleteByUserPattern(client, `DELETE FROM posts WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await client.query(`DELETE FROM teams WHERE id = ANY($1::text[])`, [teamIds]);
    await deleteByUserPattern(client, `DELETE FROM teams WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await client.query(`DELETE FROM resources WHERE id = ANY($1::text[])`, [resourceIds]);
    await deleteByUserPattern(client, `DELETE FROM resources WHERE author_user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await client.query(`DELETE FROM competitions WHERE id = ANY($1::text[])`, [competitionIds]);
    await client.query(`DELETE FROM search_suggestions WHERE id = ANY($1::text[])`, [suggestionIds]);

    await client.query(`
      DELETE FROM moderation_tasks mt
      WHERE NOT EXISTS (
        SELECT 1
        FROM resources r
        WHERE mt.target_type = 'resource' AND r.id = mt.target_id
      )
        AND NOT EXISTS (
          SELECT 1
          FROM teams t
          WHERE mt.target_type = 'team' AND t.id = mt.target_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM posts p
          WHERE mt.target_type = 'post' AND p.id = mt.target_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM comments c
          WHERE mt.target_type = 'comment' AND c.id = mt.target_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM reports rp
          WHERE mt.target_type = 'report' AND rp.id = mt.target_id
        )
    `);

    await deleteByUserPattern(client, `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await deleteByUserPattern(client, `DELETE FROM resource_assets WHERE user_id IN (SELECT id FROM users WHERE open_id LIKE $1)`);
    await deleteByUserPattern(client, `DELETE FROM users WHERE open_id LIKE $1`);

    await client.query('COMMIT');
    console.log('Demo data cleared.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
