#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/campus-growth/api.env}"
backup_root="${2:-/opt/campus-growth/backups}"
label="${3:-manual}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi
if [[ ! -r "${env_file}" ]]; then
  echo "Cannot read production environment file: ${env_file}" >&2
  exit 1
fi
if [[ ! "${label}" =~ ^[a-z0-9-]+$ ]]; then
  echo "Backup label may contain only lowercase letters, digits, and hyphens." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

if [[ "${DB_PROVIDER:-}" != "postgres" || -z "${POSTGRES_URL:-}" ]]; then
  echo "Production PostgreSQL configuration is incomplete." >&2
  exit 1
fi

timestamp="$(date +%Y%m%d%H%M%S)"
mkdir -p "${backup_root}"
backup_path="${backup_root}/${label}-${timestamp}.sql.gz"
temporary_path="${backup_path}.tmp"
trap 'rm -f "${temporary_path}"' EXIT

pg_dump "${POSTGRES_URL}" | gzip -9 >"${temporary_path}"
gzip -t "${temporary_path}"
mv "${temporary_path}" "${backup_path}"
chown campus:campus "${backup_path}"
chmod 0640 "${backup_path}"

echo "BACKUP=$(basename "${backup_path}")"
echo "BYTES=$(stat -c %s "${backup_path}")"
echo "SHA256=$(sha256sum "${backup_path}" | awk '{print $1}')"
echo "BACKUP_CHECK=passed"
