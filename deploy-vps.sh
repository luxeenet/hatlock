#!/usr/bin/env bash
set -e

# ==============================================================================
# HatLock VPS Automated Deployment & Update Script
# ==============================================================================

echo "=================================================="
echo "🚀 HatLock Deployment & Container Orchestration"
echo "=================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Ensure .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying .env.example -> .env"
    cp .env.example .env
    echo "❗ Please review and edit .env with your production credentials before continuing."
    exit 1
fi

echo "🏗️  1. Building application containers (API, Web Dashboard, Customer Portal)..."
docker compose build

echo "📦 2. Starting PostgreSQL & Redis databases..."
docker compose up -d postgres redis

echo "⏳ Waiting for PostgreSQL to become healthy..."
docker compose exec -T postgres sh -c 'until pg_isready -U ${POSTGRES_USER:-hatlock} -d ${POSTGRES_DB:-hatlock_db}; do sleep 1; done'

echo "🔄 3. Running production database migrations safely..."
docker compose run --rm api npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

echo "🚀 4. Launching application services..."
docker compose up -d

echo "🩺 5. Verifying service health..."
sleep 5

docker compose ps

echo "=================================================="
echo "✅ HatLock Deployment Complete!"
echo "   - API Gateway (Local):       http://127.0.0.1:3000/health"
echo "   - API Documentation (Local): http://127.0.0.1:3000/docs"
echo "   - Web Admin (Local):         http://127.0.0.1:3002"
echo "   - Customer Portal (Local):   http://127.0.0.1:3001"
echo "=================================================="

