#!/bin/sh

# Redirect all output to stderr so Railway shows it
exec 1>&2

echo "=== ENTRYPOINT v3 ==="
echo "PORT=${PORT}"
echo "DATABASE_URL length: ${#DATABASE_URL}"

echo "Running migrations..."
alembic upgrade head

echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
