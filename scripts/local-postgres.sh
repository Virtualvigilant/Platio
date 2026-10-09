#!/usr/bin/env bash
# Starts a throwaway Postgres for `npm run test:db` when you don't have one (or Docker) handy.
# Usage: npm run db:test-server   then   DATABASE_URL=... npm run test:db
set -euo pipefail

PORT="${PGPORT:-54329}"
DATA_DIR="${PGDATA_DIR:-$(pwd)/.pgdata}"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"

if [[ -z "${BIN}" || ! -x "${BIN}/postgres" ]]; then
  echo "No Postgres server binaries found. Install PostgreSQL 15+ or set PG_BIN." >&2
  exit 1
fi

# Postgres refuses to run as root; in containers, run it as the postgres OS user instead.
run() {
  if [[ "${EUID}" -eq 0 ]] && id postgres >/dev/null 2>&1; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

if [[ ! -f "${DATA_DIR}/PG_VERSION" ]]; then
  mkdir -p "${DATA_DIR}"
  if [[ "${EUID}" -eq 0 ]]; then chown postgres "${DATA_DIR}"; fi
  run "${BIN}/initdb" -D "${DATA_DIR}" -U postgres --auth=trust >/dev/null
fi

if run "${BIN}/pg_ctl" -D "${DATA_DIR}" status >/dev/null 2>&1; then
  echo "Postgres already running."
else
  run "${BIN}/pg_ctl" -D "${DATA_DIR}" -o "-p ${PORT} -k /tmp" -l "${DATA_DIR}/server.log" start >/dev/null
fi

echo "DATABASE_URL=postgres://postgres@127.0.0.1:${PORT}/postgres"
