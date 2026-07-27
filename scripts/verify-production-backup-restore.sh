#!/usr/bin/env bash
set -euo pipefail

backup_root="/opt/campus-growth/backups"
backup_path="${1:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

if [[ -z "${backup_path}" ]]; then
  backup_path="$(find "${backup_root}" -maxdepth 1 -type f -name 'predeploy-*.sql.gz' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
fi

resolved_backup="$(readlink -f "${backup_path}")"
case "${resolved_backup}" in
  "${backup_root}"/*.sql.gz) ;;
  *)
    echo "Refusing backup outside ${backup_root}: ${resolved_backup}" >&2
    exit 1
    ;;
esac

if [[ ! -s "${resolved_backup}" ]]; then
  echo "Backup is missing or empty: ${resolved_backup}" >&2
  exit 1
fi

gzip -t "${resolved_backup}"

restore_db="campus_growth_restore_check_$(date +%Y%m%d%H%M%S)"
cleanup() {
  sudo -u postgres dropdb --if-exists "${restore_db}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sudo -u postgres createdb "${restore_db}"
gzip -dc "${resolved_backup}" | sudo -u postgres psql --dbname "${restore_db}" --set ON_ERROR_STOP=1 >/dev/null

table_count="$(sudo -u postgres psql --dbname "${restore_db}" --tuples-only --no-align --command \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")"
core_counts="$(sudo -u postgres psql --dbname "${restore_db}" --tuples-only --no-align --field-separator '|' --command \
  "SELECT (SELECT COUNT(*) FROM schools), (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM competitions), (SELECT COUNT(*) FROM resources), (SELECT COUNT(*) FROM posts), (SELECT COUNT(*) FROM teams), (SELECT COUNT(*) FROM admin_users);")"

if [[ "${table_count}" -lt 10 ]]; then
  echo "Restore verification failed: only ${table_count} public tables." >&2
  exit 1
fi

echo "BACKUP=$(basename "${resolved_backup}")"
echo "PUBLIC_TABLES=${table_count}"
echo "CORE_COUNTS_SCHOOLS_USERS_COMPETITIONS_RESOURCES_POSTS_TEAMS_ADMINS=${core_counts}"
echo "RESTORE_CHECK=passed"
