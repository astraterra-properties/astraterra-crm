#!/bin/bash
# Astraterra CRM — Encrypted Database Backup
# Creates an AES-256-CBC encrypted backup of the SQLite database.
# Backup files are unreadable without the ENCRYPTION_KEY.

set -e

DB_PATH="/data/.openclaw/workspace/data/astraterra-crm.db"
BACKUP_DIR="/data/.openclaw/workspace/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm-encrypted-$TIMESTAMP.db.enc"

# Load encryption key from .env
ENCRYPTION_KEY=$(grep '^ENCRYPTION_KEY=' /data/.openclaw/workspace/astraterra-crm/backend/.env | cut -d '=' -f2)

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "❌ ENCRYPTION_KEY not found in .env"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Create encrypted backup using AES-256-CBC
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$DB_PATH" \
  -out "$BACKUP_FILE" \
  -pass "pass:$ENCRYPTION_KEY"

echo "✅ Encrypted backup created: $BACKUP_FILE"
echo "   Size: $(du -sh "$BACKUP_FILE" | cut -f1)"
echo ""
echo "To restore:"
echo "  openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in $BACKUP_FILE -out restored.db -pass pass:<ENCRYPTION_KEY>"

# Keep only last 7 encrypted backups
ls -t "$BACKUP_DIR"/crm-encrypted-*.db.enc 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true

echo "✅ Old backups cleaned (kept last 7)"
