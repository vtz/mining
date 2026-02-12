#!/bin/sh

echo "=== STARTING UVICORN DIRECTLY ===" >&2
echo "PORT=${PORT}" >&2

# Skip alembic for now - just start server
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
