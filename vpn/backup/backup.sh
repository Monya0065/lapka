#!/bin/bash
# Backup script for Lapka VPN database
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup"
S3_BUCKET="s3://lapka-vpn-backups"
RETENTION_DAYS=30

echo "Starting backup: $TIMESTAMP"

# Database backup
echo "Backing up PostgreSQL..."
pg_dump -h postgres -U vpn -d vpn | gzip > $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz

# Redis backup
echo "Backing up Redis..."
redis-cli -h redis SAVE
cp /data/dump.rdb $BACKUP_DIR/redis_$TIMESTAMP.rdb

# Upload to S3
echo "Uploading to S3..."
aws s3 cp $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz $S3_BUCKET/postgres/
aws s3 cp $BACKUP_DIR/redis_$TIMESTAMP.rdb $S3_BUCKET/redis/

# Cleanup old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete
aws s3 ls $S3_BUCKET/postgres/ | awk '{print $4}' | while read key; do
    DATE=$(echo $key | grep -oP '\d{8}')
    if [ $(date -d "$DATE" +%s) -lt $(date -d "-$RETENTION_DAYS days" +%s) ]; then
        aws s3 rm $S3_BUCKET/postgres/$key
    fi
done

echo "Backup completed: $TIMESTAMP"

# Verify backup integrity
echo "Verifying backup..."
gunzip -t $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz || exit 1

echo "Backup verified successfully"