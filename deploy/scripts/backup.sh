#!/usr/bin/env sh
# Postgres logical backup with rotation. Reads DATABASE_URL from env.
# Runs on the docker-compose "backup" profile. For Lovable Cloud, request
# a managed export via Cloud -> Advanced settings instead.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="/backups/db-${STAMP}.sql.gz"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"

echo "[backup] starting ${STAMP}"
pg_dump --format=plain --no-owner --no-privileges "${DATABASE_URL}" | gzip -9 > "${OUT}"
echo "[backup] wrote ${OUT} ($(du -h "${OUT}" | cut -f1))"

# Rotate
find /backups -type f -name 'db-*.sql.gz' -mtime "+${RETAIN_DAYS}" -print -delete || true

# Optional off-site copy: set S3_BUCKET + AWS creds in env to enable.
if [ -n "${S3_BUCKET:-}" ]; then
  echo "[backup] shipping to s3://${S3_BUCKET}/"
  apk add --no-cache aws-cli >/dev/null 2>&1 || true
  aws s3 cp "${OUT}" "s3://${S3_BUCKET}/$(basename "${OUT}")" --only-show-errors
fi

echo "[backup] done"
