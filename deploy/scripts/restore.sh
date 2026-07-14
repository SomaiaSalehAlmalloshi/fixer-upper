#!/usr/bin/env sh
# Restore a gzipped pg_dump into DATABASE_URL. Requires manual invocation.
# Usage: sh deploy/scripts/restore.sh /backups/db-20260713T090000Z.sql.gz
set -eu

FILE="${1:?path to .sql.gz backup required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
[ -f "${FILE}" ] || { echo "not found: ${FILE}" >&2; exit 1; }

echo "[restore] target: ${DATABASE_URL%%@*}@***"
echo "[restore] file:   ${FILE}"
printf "Type 'RESTORE' to proceed: "
read -r CONFIRM
[ "${CONFIRM}" = "RESTORE" ] || { echo "aborted"; exit 1; }

gunzip -c "${FILE}" | psql "${DATABASE_URL}" -v ON_ERROR_STOP=1
echo "[restore] complete"
