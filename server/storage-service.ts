import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { serverConfig } from './config.ts';
import { createId, getOne, nowIso, run } from './helpers.ts';
import type { ResourceAssetRow } from './models.ts';

const resourceAssetRoot = resolve(serverConfig.storageRoot, 'resource-files');
const homeFeedImageRoot = resolve(serverConfig.storageRoot, 'home-feed-images');
const avatarImageRoot = resolve(serverConfig.storageRoot, 'avatar-images');

if (serverConfig.storageProvider === 'local') {
  mkdirSync(resourceAssetRoot, { recursive: true });
  mkdirSync(homeFeedImageRoot, { recursive: true });
  mkdirSync(avatarImageRoot, { recursive: true });
}

let s3Client: S3Client | null = null;

function getS3Client() {
  if (serverConfig.storageProvider !== 's3') {
    throw new Error('storage_provider_not_s3');
  }

  if (!serverConfig.s3.bucket || !serverConfig.s3.region || !serverConfig.s3.accessKeyId || !serverConfig.s3.secretAccessKey) {
    throw new Error('s3_config_incomplete');
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: serverConfig.s3.region,
      endpoint: serverConfig.s3.endpoint || undefined,
      forcePathStyle: serverConfig.s3.forcePathStyle,
      credentials: {
        accessKeyId: serverConfig.s3.accessKeyId,
        secretAccessKey: serverConfig.s3.secretAccessKey,
      },
    });
  }

  return s3Client;
}

function normalizeExtension(fileName: string) {
  const extension = extname(fileName || '').slice(0, 16);
  if (!extension || /[^a-zA-Z0-9.]/.test(extension)) {
    return '';
  }

  return extension.toLowerCase();
}

function mapResourceAssetSummary(asset: ResourceAssetRow) {
  return {
    assetId: asset.id,
    originalName: asset.original_name,
    fileName: asset.file_name,
    sizeBytes: asset.size_bytes,
    contentType: asset.content_type,
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function buildHomeFeedImageUrl(fileName: string) {
  return `${normalizeBaseUrl(serverConfig.publicOrigin)}${serverConfig.basePath}/uploads/home-feed/${fileName}`;
}

function buildAvatarImageUrl(fileName: string) {
  return `${normalizeBaseUrl(serverConfig.publicOrigin)}${serverConfig.basePath}/uploads/avatars/${fileName}`;
}

function buildS3PublicUrl(storageKey: string) {
  if (serverConfig.s3.publicBaseUrl) {
    return `${normalizeBaseUrl(serverConfig.s3.publicBaseUrl)}/${storageKey}`;
  }

  if (!serverConfig.s3.endpoint) {
    throw new Error('s3_public_base_url_missing');
  }

  const endpoint = new URL(serverConfig.s3.endpoint);
  if (serverConfig.s3.forcePathStyle) {
    return `${normalizeBaseUrl(serverConfig.s3.endpoint)}/${serverConfig.s3.bucket}/${storageKey}`;
  }

  return `${endpoint.protocol}//${serverConfig.s3.bucket}.${endpoint.host}/${storageKey}`;
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
    const array = await body.transformToByteArray();
    return Buffer.from(array);
  }

  throw new Error('s3_object_body_invalid');
}

async function putObject(storageKey: string, buffer: Buffer, contentType: string) {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: serverConfig.s3.bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

async function readObject(storageKey: string) {
  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: serverConfig.s3.bucket,
      Key: storageKey,
    })
  );

  return streamToBuffer(response.Body);
}

function getContentTypeByExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

export async function createResourceAsset(params: {
  userId: string;
  originalName: string;
  contentType?: string;
  buffer: Buffer;
}) {
  if (!params.buffer.length) {
    throw new Error('resource_asset_invalid');
  }

  const assetId = createId('asset');
  const originalName = basename(params.originalName || 'resource-file');
  const extension = normalizeExtension(originalName);
  const fileName = `${assetId}${extension}`;
  const storageKey = `resource-files/${fileName}`;
  const localPath =
    serverConfig.storageProvider === 'local'
      ? resolve(resourceAssetRoot, fileName)
      : serverConfig.databaseProvider === 'sqlite'
        ? ''
        : null;

  if (serverConfig.storageProvider === 'local') {
    writeFileSync(localPath!, params.buffer);
  } else {
    await putObject(storageKey, params.buffer, params.contentType || 'application/octet-stream');
  }

  run(
    `
      INSERT INTO resource_assets (
        id, user_id, storage_provider, storage_key, local_path, original_name, file_name, content_type, size_bytes, created_at
      ) VALUES (
        @id, @userId, @storageProvider, @storageKey, @localPath, @originalName, @fileName, @contentType, @sizeBytes, @createdAt
      )
    `,
    {
      id: assetId,
      userId: params.userId,
      storageProvider: serverConfig.storageProvider,
      storageKey,
      localPath,
      originalName,
      fileName,
      contentType: params.contentType || 'application/octet-stream',
      sizeBytes: params.buffer.length,
      createdAt: nowIso(),
    }
  );

  return mapResourceAssetSummary(getResourceAsset(assetId));
}

export function getResourceAsset(assetId: string) {
  const asset = getOne<ResourceAssetRow>(
    `
      SELECT id, user_id, storage_provider, storage_key, local_path, original_name, file_name, content_type, size_bytes, created_at
      FROM resource_assets
      WHERE id = @assetId
    `,
    { assetId }
  );

  if (!asset) {
    throw new Error('resource_asset_not_found');
  }

  return asset;
}

export async function readResourceAssetContent(assetId: string) {
  const asset = getResourceAsset(assetId);

  if (asset.storage_provider === 'local') {
    if (!asset.local_path || !existsSync(asset.local_path)) {
      throw new Error('resource_asset_not_found');
    }

    return {
      asset,
      content: readFileSync(asset.local_path),
    };
  }

  return {
    asset,
    content: await readObject(asset.storage_key),
  };
}

export async function createHomeFeedImage(params: {
  originalName: string;
  contentType?: string;
  buffer: Buffer;
}) {
  if (!params.buffer.length) {
    throw new Error('home_feed_image_invalid');
  }

  const fileId = createId('hero');
  const originalName = basename(params.originalName || 'home-feed-image');
  const extension = normalizeExtension(originalName);
  const fileName = `${fileId}${extension}`;
  const storageKey = `home-feed-images/${fileName}`;

  if (serverConfig.storageProvider === 'local') {
    const localPath = resolve(homeFeedImageRoot, fileName);
    writeFileSync(localPath, params.buffer);
    return {
      fileName,
      imageUrl: buildHomeFeedImageUrl(fileName),
    };
  }

  await putObject(storageKey, params.buffer, params.contentType || 'image/jpeg');

  return {
    fileName,
    imageUrl: buildHomeFeedImageUrl(fileName),
  };
}

export async function createUserAvatarImage(params: {
  userId: string;
  originalName: string;
  contentType?: string;
  buffer: Buffer;
}) {
  if (!params.buffer.length) {
    throw new Error('avatar_image_invalid');
  }

  const fileId = createId('avatar');
  const originalName = basename(params.originalName || 'avatar-image');
  const extension = normalizeExtension(originalName);
  const fileName = `${fileId}${extension}`;
  const storageKey = `avatar-images/${fileName}`;

  if (serverConfig.storageProvider === 'local') {
    const localPath = resolve(avatarImageRoot, fileName);
    writeFileSync(localPath, params.buffer);
  } else {
    await putObject(storageKey, params.buffer, params.contentType || 'image/jpeg');
  }

  return {
    fileName,
    avatarUrl: buildAvatarImageUrl(fileName),
  };
}

export function getHomeFeedImageRoot() {
  if (serverConfig.storageProvider !== 'local') {
    return '';
  }

  return homeFeedImageRoot;
}

export function getAvatarImageRoot() {
  if (serverConfig.storageProvider !== 'local') {
    return '';
  }

  return avatarImageRoot;
}

export async function readHomeFeedImageContent(fileName: string) {
  const safeFileName = basename(fileName);
  if (!safeFileName) {
    throw new Error('home_feed_image_not_found');
  }

  if (serverConfig.storageProvider === 'local') {
    const localPath = resolve(homeFeedImageRoot, safeFileName);
    if (!existsSync(localPath)) {
      throw new Error('home_feed_image_not_found');
    }

    return {
      fileName: safeFileName,
      contentType: getContentTypeByExtension(safeFileName),
      content: readFileSync(localPath),
    };
  }

  return {
    fileName: safeFileName,
    contentType: getContentTypeByExtension(safeFileName),
    content: await readObject(`home-feed-images/${safeFileName}`),
  };
}

export async function readAvatarImageContent(fileName: string) {
  const safeFileName = basename(fileName);
  if (!safeFileName) {
    throw new Error('avatar_image_not_found');
  }

  if (serverConfig.storageProvider === 'local') {
    const localPath = resolve(avatarImageRoot, safeFileName);
    if (!existsSync(localPath)) {
      throw new Error('avatar_image_not_found');
    }

    return {
      fileName: safeFileName,
      contentType: getContentTypeByExtension(safeFileName),
      content: readFileSync(localPath),
    };
  }

  return {
    fileName: safeFileName,
    contentType: getContentTypeByExtension(safeFileName),
    content: await readObject(`avatar-images/${safeFileName}`),
  };
}
