# Backend Dockerfile - v3 force rebuild
FROM python:3.11-slim

# Force rebuild timestamp: 2026-02-12-v1
ENV BUILD_VERSION=3

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Ensure app module is importable by scripts
ENV PYTHONPATH=/app

# Expose port (Railway uses dynamic PORT)
EXPOSE 8000

# Run migrations, seed demo data (non-blocking), and start server
CMD ["sh", "-c", "alembic upgrade head && python scripts/seed_snapshots.py || echo 'Seed script failed, continuing...' && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
