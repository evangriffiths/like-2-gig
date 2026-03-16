#!/bin/bash
# Push local database to the server
set -e

source .env
SERVER=${DEPLOY_HOST:?Set DEPLOY_HOST in .env}
LOCAL_DB=server/data/like2gig.db
REMOTE_DB=/opt/like2gig/server/data/like2gig.db

echo "==> Checkpointing local WAL..."
sqlite3 "$LOCAL_DB" "PRAGMA wal_checkpoint(TRUNCATE);"

echo "==> Stopping remote app..."
ssh "$SERVER" 'systemctl stop like2gig'

echo "==> Copying database to server..."
scp "$LOCAL_DB" "$SERVER:$REMOTE_DB"

echo "==> Cleaning WAL files and restarting..."
ssh "$SERVER" "rm -f ${REMOTE_DB}-wal ${REMOTE_DB}-shm && systemctl start like2gig"

echo "==> Done!"
