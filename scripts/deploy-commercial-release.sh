#!/usr/bin/env bash
set -euo pipefail

release="${1:?release timestamp required}"
base="/opt/campus-growth"
archive="/tmp/campus-growth-${release}.tar.gz"
new="${base}/releases/${release}"
old="$(readlink -f "${base}/current")"

wait_for_health() {
  for _ in {1..15}; do
    if sudo systemctl is-active --quiet campus-growth-api \
      && curl -fsS "http://127.0.0.1:8080/api/health" >/dev/null; then
      return 0
    fi
    sleep 2
  done

  return 1
}

if [[ ! -f "${archive}" ]]; then
  echo "archive not found: ${archive}" >&2
  exit 1
fi

sudo mkdir -p "${new}"
sudo tar -xzf "${archive}" -C "${new}" --strip-components=1
sudo chown -R campus:campus "${new}"

old_node_modules="$(readlink -f "${old}/node_modules" 2>/dev/null || true)"
if [[ -n "${old_node_modules}" && -d "${old_node_modules}" && ! -e "${new}/node_modules" ]]; then
  sudo ln -s "${old_node_modules}" "${new}/node_modules"
fi

if [[ -f "${old}/frontend/.env.production.local" ]]; then
  sudo cp "${old}/frontend/.env.production.local" "${new}/frontend/.env.production.local"
  sudo chown campus:campus "${new}/frontend/.env.production.local"
fi

if [[ -f "${old}/server/data/campus-growth.db" ]]; then
  sudo mkdir -p "${new}/server/data"
  sudo cp "${old}/server/data/campus-growth.db" "${new}/server/data/campus-growth.db"
  sudo chown -R campus:campus "${new}/server/data"
fi

sudo ln -sfn "${new}" "${base}/current"
sudo systemctl restart campus-growth-api

if wait_for_health; then
  sudo systemctl is-active campus-growth-api
  curl -fsS "http://127.0.0.1:8080/api/health"
  exit 0
fi

echo "release ${release} failed health checks" >&2
sudo journalctl -u campus-growth-api -n 80 --no-pager >&2 || true

if [[ -n "${old}" && -d "${old}" && "${old}" != "${new}" ]]; then
  echo "rolling back to ${old}" >&2
  sudo ln -sfn "${old}" "${base}/current"
  sudo systemctl restart campus-growth-api

  if wait_for_health; then
    echo "rollback healthy: ${old}" >&2
  else
    echo "rollback failed health checks: ${old}" >&2
    sudo journalctl -u campus-growth-api -n 80 --no-pager >&2 || true
  fi
fi

exit 1
