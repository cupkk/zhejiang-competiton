import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Client } from 'pg';

type DbProvider = 'sqlite' | 'postgres';
type StorageProvider = 'local' | 's3';

interface ResourceAssetRow {
  id: string;
  storage_provider: StorageProvider;
  storage_key: string;
  local_path: string | null;
  file_name: string;
  content_type: string;
}

interface HomeFeedConfigRow {
  id: string;
  hero_image_url: string | null;
  banners_json: string;
}

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function getBooleanArg(name: string, fallback = false) {
  const value = getArg(name);
  if (!value) {
    return fallback;
  }
  return value === '1' || value === 'true' || value === 'yes';
}

function getRequiredEnv(name: string) {
  const value = process.env[name] || '';
  if (!value) {
    throw new Error(`${name.toLowerCase()}_missing`);
  }
  return value;
}

function getDbProvider(): DbProvider {
  return process.env.DB_PROVIDER === 'postgres' ? 'postgres' : 'sqlite';
}

function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local';
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function buildHomeFeedProxyUrl(fileName: string) {
  const publicOrigin = normalizeBaseUrl(process.env.API_PUBLIC_ORIGIN || 'http://127.0.0.1:8080');
  const basePath = process.env.API_BASE_PATH || '/api';
  return `${publicOrigin}${basePath}/uploads/home-feed/${fileName}`;
}

function createS3Client(config: S3Config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function streamToBuffer(body: unknown) {
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (body && typeof body === 'object' && 'transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  throw new Error('invalid_object_body');
}

async function getObject(client: S3Client, bucket: string, key: string) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return streamToBuffer(response.Body);
}

async function putObject(client: S3Client, bucket: string, key: string, content: Buffer, contentType: string) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    }),
  );
}

function createDb() {
  const provider = getDbProvider();
  if (provider === 'postgres') {
    const connectionString = getRequiredEnv('POSTGRES_URL');
    const client = new Client({ connectionString });
    return {
      provider,
      async connect() {
        await client.connect();
      },
      async end() {
        await client.end();
      },
      async all<T>(sql: string, values: unknown[] = []) {
        const result = await client.query(sql, values);
        return result.rows as T[];
      },
      async run(sql: string, values: unknown[] = []) {
        await client.query(sql, values as any[]);
      },
    };
  }

  const sqlitePath = resolve(process.env.DB_PATH || 'server/data/campus-growth.db');
  const sqlite = new DatabaseSync(sqlitePath);
  return {
    provider,
    async connect() {},
    async end() {
      sqlite.close();
    },
    async all<T>(sql: string, _values: unknown[] = []) {
      return sqlite.prepare(sql).all() as T[];
    },
    async run(sql: string, values: unknown[] = []) {
      sqlite.prepare(sql).run(...(values as any[]));
    },
  };
}

function getTargetConfig(): S3Config {
  return {
    endpoint: getRequiredEnv('TARGET_S3_ENDPOINT'),
    region: getRequiredEnv('TARGET_S3_REGION'),
    bucket: getRequiredEnv('TARGET_S3_BUCKET'),
    accessKeyId: getRequiredEnv('TARGET_S3_ACCESS_KEY_ID'),
    secretAccessKey: getRequiredEnv('TARGET_S3_SECRET_ACCESS_KEY'),
    forcePathStyle: getBooleanArg('target-force-path-style', process.env.TARGET_S3_FORCE_PATH_STYLE === 'true'),
  };
}

function getSourceS3Config(): S3Config {
  return {
    endpoint: getRequiredEnv('S3_ENDPOINT'),
    region: getRequiredEnv('S3_REGION'),
    bucket: getRequiredEnv('S3_BUCKET'),
    accessKeyId: getRequiredEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: getRequiredEnv('S3_SECRET_ACCESS_KEY'),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  };
}

function getStorageRoot() {
  return resolve(process.env.STORAGE_ROOT || 'server/storage');
}

function getLegacyStorageRoot() {
  return resolve(process.cwd(), 'server/storage');
}

async function readSourceFile(params: {
  sourceProvider: StorageProvider;
  sourceClient: S3Client | null;
  sourceBucket: string;
  storageKey: string;
  localPath: string | null;
  fallbackFileName: string;
}) {
  if (params.sourceProvider === 's3') {
    if (!params.sourceClient) {
      throw new Error('source_s3_client_missing');
    }
    return getObject(params.sourceClient, params.sourceBucket, params.storageKey);
  }

  const candidates = [
    params.localPath || '',
    resolve(getStorageRoot(), 'resource-files', params.fallbackFileName),
    resolve(getLegacyStorageRoot(), 'resource-files', params.fallbackFileName),
    params.localPath ? resolve(getStorageRoot(), 'resource-files', basename(params.localPath)) : '',
    params.localPath ? resolve(getLegacyStorageRoot(), 'resource-files', basename(params.localPath)) : '',
  ].filter(Boolean);
  const localPath = candidates.find((candidate) => existsSync(candidate)) || candidates[0] || '';

  if (!existsSync(localPath)) {
    throw new Error(`local_source_missing:${localPath}`);
  }

  return readFileSync(localPath);
}

function extractHomeFeedFileNames(configRows: HomeFeedConfigRow[]) {
  const result = new Set<string>();

  for (const row of configRows) {
    const urls = [row.hero_image_url || ''];
    try {
      const banners = JSON.parse(row.banners_json) as Array<{ imageUrl?: string }>;
      for (const banner of banners) {
        urls.push(banner.imageUrl || '');
      }
    } catch {
      // ignore invalid json
    }

    for (const url of urls) {
      if (!url) {
        continue;
      }
      const matched = url.match(/(?:uploads\/home-feed\/|home-feed-images\/)([^/?#]+)/i);
      if (matched?.[1]) {
        result.add(basename(matched[1]));
      }
    }
  }

  const localDir = resolve(getStorageRoot(), 'home-feed-images');
  const legacyLocalDir = resolve(getLegacyStorageRoot(), 'home-feed-images');
  for (const dir of [localDir, legacyLocalDir]) {
    if (!existsSync(dir)) {
      continue;
    }
    for (const fileName of readdirSync(dir)) {
      result.add(basename(fileName));
    }
  }

  return [...result];
}

async function main() {
  const sourceProvider = getStorageProvider();
  const targetConfig = getTargetConfig();
  const targetClient = createS3Client(targetConfig);
  const sourceClient = sourceProvider === 's3' ? createS3Client(getSourceS3Config()) : null;
  const sourceBucket = sourceProvider === 's3' ? getRequiredEnv('S3_BUCKET') : '';
  const db = createDb();

  try {
    await db.connect();

    const assets = await db.all<ResourceAssetRow>(
      `
        SELECT id, storage_provider, storage_key, local_path, file_name, content_type
        FROM resource_assets
        ORDER BY created_at ASC
      `,
    );

    let migratedAssetCount = 0;
    let skippedAssetCount = 0;
    for (const asset of assets) {
      const storageKey = asset.storage_key || `resource-files/${asset.file_name}`;
      try {
        const content = await readSourceFile({
          sourceProvider: asset.storage_provider,
          sourceClient,
          sourceBucket,
          storageKey,
          localPath: asset.local_path,
          fallbackFileName: asset.file_name,
        });

        await putObject(targetClient, targetConfig.bucket, storageKey, content, asset.content_type || 'application/octet-stream');
        await db.run(
          `
            UPDATE resource_assets
            SET storage_provider = $1,
                storage_key = $2,
                local_path = $3
            WHERE id = $4
          `,
          ['s3', storageKey, null, asset.id],
        );
        migratedAssetCount += 1;
        console.log(`migrated resource asset ${asset.id} -> ${storageKey}`);
      } catch (error) {
        skippedAssetCount += 1;
        console.warn(`skipped resource asset ${asset.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const configRows = await db.all<HomeFeedConfigRow>(
      `
        SELECT id, hero_image_url, banners_json
        FROM home_feed_configs
      `,
    );

    const fileNames = extractHomeFeedFileNames(configRows);
    let migratedHomeImageCount = 0;
    let skippedHomeImageCount = 0;
    for (const fileName of fileNames) {
      const storageKey = `home-feed-images/${fileName}`;
      try {
        let content: Buffer;
        if (sourceProvider === 's3') {
          if (!sourceClient) {
            throw new Error('source_s3_client_missing');
          }
          try {
            content = await getObject(sourceClient, sourceBucket, storageKey);
          } catch {
            const localFallback =
              [
                resolve(getStorageRoot(), 'home-feed-images', fileName),
                resolve(getLegacyStorageRoot(), 'home-feed-images', fileName),
              ].find((item) => existsSync(item)) || '';
            if (!localFallback) {
              throw new Error(`home_feed_image_missing:${fileName}`);
            }
            content = readFileSync(localFallback);
          }
        } else {
          const localPath =
            [
              resolve(getStorageRoot(), 'home-feed-images', fileName),
              resolve(getLegacyStorageRoot(), 'home-feed-images', fileName),
            ].find((item) => existsSync(item)) || '';
          if (!localPath) {
            throw new Error(`home_feed_image_missing:${fileName}`);
          }
          content = readFileSync(localPath);
        }

        await putObject(targetClient, targetConfig.bucket, storageKey, content, 'image/jpeg');
        migratedHomeImageCount += 1;
        console.log(`migrated home image ${fileName}`);
      } catch (error) {
        skippedHomeImageCount += 1;
        console.warn(`skipped home image ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const row of configRows) {
      const nextHeroUrl =
        row.hero_image_url
          ?.replace(
            /https?:\/\/[^/]+\/(?:api\/)?uploads\/home-feed\/([^/?#]+)/i,
            (_value, fileName: string) => buildHomeFeedProxyUrl(fileName),
          )
          .replace(
            /https?:\/\/[^/]+\/home-feed-images\/([^/?#]+)/i,
            (_value, fileName: string) => buildHomeFeedProxyUrl(fileName),
          ) || row.hero_image_url;

      let nextBannersJson = row.banners_json;
      try {
        const banners = JSON.parse(row.banners_json) as Array<Record<string, unknown>>;
        nextBannersJson = JSON.stringify(
          banners.map((banner) => {
            const imageUrl = typeof banner.imageUrl === 'string' ? banner.imageUrl : '';
            const nextImageUrl = imageUrl.replace(
              /https?:\/\/[^/]+\/(?:api\/)?uploads\/home-feed\/([^/?#]+)/i,
              (_value, fileName: string) => buildHomeFeedProxyUrl(fileName),
            ).replace(
              /https?:\/\/[^/]+\/home-feed-images\/([^/?#]+)/i,
              (_value, fileName: string) => buildHomeFeedProxyUrl(fileName),
            );

            return {
              ...banner,
              imageUrl: nextImageUrl,
            };
          }),
        );
      } catch {
        // keep existing json
      }

      await db.run(
        `
          UPDATE home_feed_configs
          SET hero_image_url = $1,
              banners_json = $2
          WHERE id = $3
        `,
        [nextHeroUrl || null, nextBannersJson, row.id],
      );
    }

    console.log(`resource assets migrated: ${migratedAssetCount}`);
    console.log(`resource assets skipped: ${skippedAssetCount}`);
    console.log(`home images migrated: ${migratedHomeImageCount}`);
    console.log(`home images skipped: ${skippedHomeImageCount}`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
