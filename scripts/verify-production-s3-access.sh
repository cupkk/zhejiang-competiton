#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/campus-growth/api.env}"
release_root="${2:-/opt/campus-growth/current}"

if [[ ! -r "${env_file}" ]]; then
  echo "Cannot read production environment file: ${env_file}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

if [[ "${STORAGE_PROVIDER:-}" != "s3" ]]; then
  echo "Production storage provider is not s3." >&2
  exit 1
fi

cd "${release_root}"
node --input-type=module <<'NODE'
import { GetBucketAclCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const required = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`missing_${name.toLowerCase()}`);
}

const client = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
const acl = await client.send(new GetBucketAclCommand({ Bucket: process.env.S3_BUCKET }));
const grants = acl.Grants || [];
const publicGrant = grants.find((grant) => {
  const uri = grant.Grantee?.URI || '';
  return uri.includes('AllUsers') || uri.includes('AuthenticatedUsers');
});

console.log(`S3_HEAD_BUCKET=passed`);
console.log(`S3_ACL_GRANTS=${grants.length}`);
console.log(`S3_PUBLIC_GRANT=${publicGrant ? 'present' : 'absent'}`);
if (publicGrant) process.exitCode = 2;
NODE
