#!/bin/sh

# Redirect all output to stderr so Railway shows it
exec 1>&2

echo "=== ENTRYPOINT v4 ==="
echo "PORT=${PORT}"
echo "DATABASE_URL=${DATABASE_URL}"

echo "Running migrations..."
alembic upgrade head
echo "Migrations done with exit code: $?"

echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level debug
