#!/bin/sh

echo "=== ENTRYPOINT v2 ==="
echo "PORT=${PORT}"

# Skip seed for now - just start the server
echo "Running migrations..."
alembic upgrade head

echo "Starting uvicorn..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
