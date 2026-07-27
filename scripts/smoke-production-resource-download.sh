#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/campus-growth/api.env}"
api_base="${2:-http://127.0.0.1:8080/api}"
mode="${3:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a
export PATH=/usr/local/bin:/usr/bin:/bin

if [[ "${DB_PROVIDER:-}" != "postgres" || -z "${POSTGRES_URL:-}" ]]; then
  echo "Production PostgreSQL configuration is incomplete." >&2
  exit 1
fi

if [[ "${mode}" == "--cleanup-only" ]]; then
  psql "${POSTGRES_URL}" --set ON_ERROR_STOP=1 <<'SQL'
DELETE FROM users WHERE id LIKE 'production_resource_smoke_%';
SQL
  remaining="$(psql "${POSTGRES_URL}" --tuples-only --no-align --command \
    "SELECT COUNT(*) FROM users WHERE id LIKE 'production_resource_smoke_%';")"
  echo "REMAINING_PRODUCTION_RESOURCE_SMOKE_USERS=${remaining}"
  [[ "${remaining}" == "0" ]]
  exit
fi

timestamp="$(date +%Y%m%d%H%M%S)"
user_id="production_resource_smoke_${timestamp}"
open_id="system:production-resource-smoke:${timestamp}"
token="$(openssl rand -hex 32)"
download_file="/tmp/production-resource-smoke-${timestamp}.bin"
header_file="/tmp/production-resource-smoke-${timestamp}.headers"

cleanup() {
  psql "${POSTGRES_URL}" --set ON_ERROR_STOP=1 --quiet --variable user_id="${user_id}" >/dev/null 2>&1 <<'SQL' || true
DELETE FROM users WHERE id = :'user_id';
SQL
  rm -f "${download_file}" "${header_file}"
}
trap cleanup EXIT

resource_id="$(psql "${POSTGRES_URL}" --tuples-only --no-align --command \
  "SELECT id FROM resources WHERE content_scope = 'platform' AND moderation_status = 'approved' AND price = 0 AND file_asset_id IS NOT NULL ORDER BY created_at DESC LIMIT 1;")"
if [[ -z "${resource_id}" ]]; then
  echo "No downloadable platform resource found." >&2
  exit 1
fi

psql "${POSTGRES_URL}" --set ON_ERROR_STOP=1 --quiet \
  --variable user_id="${user_id}" \
  --variable open_id="${open_id}" \
  --variable token="${token}" <<'SQL'
INSERT INTO users (
  id, open_id, union_id, session_key, name, mark, avatar_url, school_id, school, major, grade, bio,
  focus_tags_json, points, checkin_streak, last_checkin_date, created_at, updated_at
) VALUES (
  :'user_id', :'open_id', NULL, NULL, '生产资源验收', '验', NULL, NULL, '未选择', '', '',
  '临时自动化用户，验收结束后删除。', '[]', 0, 0, NULL, NOW()::text, NOW()::text
);
INSERT INTO sessions (token, user_id, mode, expires_at, created_at)
VALUES (:'token', :'user_id', 'real', (NOW() + INTERVAL '10 minutes')::text, NOW()::text);
SQL

acquisition_json="$(curl -fsS -X POST "${api_base}/resources/${resource_id}/acquisitions" \
  -H "Authorization: Bearer ${token}" \
  -H 'Content-Type: application/json' \
  --data '{"mode":"free"}')"
acquisition_status="$(node -e "const p=JSON.parse(process.argv[1]); if(p.code!==0) process.exit(2); process.stdout.write(p.data?.accessStatus||'');" "${acquisition_json}")"
if [[ "${acquisition_status}" != "owned" ]]; then
  echo "Free acquisition did not produce owned access." >&2
  exit 1
fi

download_json="$(curl -fsS -X POST "${api_base}/resources/${resource_id}/downloads" \
  -H "Authorization: Bearer ${token}")"
grant_id="$(node -e "const p=JSON.parse(process.argv[1]); if(p.code!==0||!p.data?.grantId) process.exit(2); process.stdout.write(p.data.grantId);" "${download_json}")"

http_status="$(curl -sS -D "${header_file}" -o "${download_file}" -w '%{http_code}' \
  "${api_base}/downloads/${grant_id}/file" \
  -H "Authorization: Bearer ${token}")"
content_type="$(awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{gsub(/\r/,""); print $2; exit}' "${header_file}")"
cache_control="$(awk 'BEGIN{IGNORECASE=1} /^Cache-Control:/{gsub(/\r/,""); $1=""; sub(/^ /,""); print; exit}' "${header_file}")"
file_bytes="$(stat -c %s "${download_file}")"

if [[ "${http_status}" != "200" || "${file_bytes}" -le 0 ]]; then
  echo "Resource file download failed." >&2
  exit 1
fi

echo "RESOURCE_ID=${resource_id}"
echo "ACQUISITION_STATUS=${acquisition_status}"
echo "DOWNLOAD_HTTP=${http_status}"
echo "DOWNLOAD_CONTENT_TYPE=${content_type}"
echo "DOWNLOAD_CACHE_CONTROL=${cache_control}"
echo "DOWNLOAD_BYTES=${file_bytes}"
echo "PRODUCTION_RESOURCE_SMOKE=passed"
