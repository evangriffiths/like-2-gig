#!/bin/bash
# Pull database from the server to local
set -e

source .env
SERVER=${DEPLOY_HOST:?Set DEPLOY_HOST in .env}
LOCAL_DB=server/data/like2gig.db
REMOTE_DB=/opt/like2gig/server/data/like2gig.db

echo "==> Checkpointing remote WAL..."
ssh "$SERVER" "sqlite3 $REMOTE_DB 'PRAGMA wal_checkpoint(TRUNCATE);'"

echo "==> Copying database from server..."
scp "$SERVER:$REMOTE_DB" "$LOCAL_DB"

echo "==> Cleaning local WAL files..."
rm -f "${LOCAL_DB}-wal" "${LOCAL_DB}-shm"

echo "==> Done!"
