#!/bin/sh

echo "=== ENTRYPOINT v5 ===" >&2
echo "PORT=${PORT}" >&2

echo "Running migrations..." >&2
alembic upgrade head 2>&1
echo "Migration exit code: $?" >&2

echo "Starting uvicorn..." >&2
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
