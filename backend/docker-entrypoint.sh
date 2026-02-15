#!/bin/sh
set -e

# Attendre que PostgreSQL soit prêt
echo "⏳ Waiting for database..."
max=30
n=0
until node scripts/wait-db.mjs 2>/dev/null; do
  n=$((n + 1))
  if [ "$n" -ge "$max" ]; then
    echo "❌ Database not reachable after ${max} attempts"
    exit 1
  fi
  sleep 2
done
echo "✅ Database is ready"

# Migrations
echo "🔄 Running migrations..."
node src/database/migrate.js || true

# Lancer la commande passée (par défaut: node src/server.js)
exec "$@"
