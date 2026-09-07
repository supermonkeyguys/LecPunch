#!/usr/bin/env bash
set -euo pipefail

# Restores only the LecPunch business database from a mongodump --archive --gzip
# file. It always creates a timestamped backup of the current production data
# before using --drop, and refuses to run without an explicit --apply flag.

if [[ $# -ne 2 || "$2" != "--apply" ]]; then
  echo "Usage: bash deploy/restore-mongo-archive.sh /absolute/path/lecpunch-mongo.archive.gz --apply" >&2
  echo "No data has been changed." >&2
  exit 2
fi

archive_path="$1"
compose_file="docker-compose.prod.yml"

if [[ ! -f "$archive_path" ]]; then
  echo "Archive not found: $archive_path" >&2
  exit 1
fi

gzip -t "$archive_path"
mkdir -p backups
backup_path="backups/lecpunch-before-restore-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"

echo "Creating a rollback backup at $backup_path"
docker compose -f "$compose_file" exec -T mongo sh -ceu '
  mongodump \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --nsInclude="lecpunch.*" \
    --gzip --archive
' > "$backup_path"

echo "Restoring lecpunch collections from $archive_path"
cat "$archive_path" | docker compose -f "$compose_file" exec -T mongo sh -ceu '
  mongorestore \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --nsInclude="lecpunch.*" \
    --drop --gzip --archive
'

echo "Restore finished. Before starting the API, run the active-session reconciliation command in deploy/README.md."
