#!/bin/sh

echo "=== ENTRYPOINT START ==="
echo "PORT: ${PORT:-8000}"
echo "DATABASE_URL set: $(if [ -n "$DATABASE_URL" ]; then echo 'yes'; else echo 'NO!'; fi)"

echo "Running database migrations..."
alembic upgrade head || { echo "Migration failed!"; exit 1; }

echo "Seeding database..."
python scripts/seed_data.py || echo "Seed skipped or failed (continuing...)"

echo "Starting server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
