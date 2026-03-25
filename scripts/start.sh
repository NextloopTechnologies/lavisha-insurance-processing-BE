#!/bin/bash
set -e  # Exit on any error immediately

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

cd /home/ec2-user/workspace/lavisha-dev

# ─── Load environment variables ───────────────────────────────────────────────
if [ -f .env ]; then
  echo "Loading .env..."
  set -o allexport
  source .env
  set +o allexport
else
  echo "ERROR: .env file not found at $(pwd)/.env"
  exit 1
fi

# ─── CPU check FIRST (before heavy operations) ────────────────────────────────
cpu_count=$(nproc)
load=$(uptime | awk -F'load average: ' '{ print $2 }' | cut -d, -f1 | xargs)
if (( $(echo "$load > $cpu_count" | bc -l) )); then
  echo "CPU load too high ($load / $cpu_count cores). Aborting deploy."
  exit 1
fi

# ─── Install dependencies ─────────────────────────────────────────────────────
echo "Installing dependencies..."
npm ci

# ─── Build ────────────────────────────────────────────────────────────────────
echo "Building project..."
npm run build

# Verify build output exists
if [ ! -f "dist/src/main.js" ]; then
  echo "ERROR: Build failed — dist/src/main.js not found"
  exit 1
fi

# ─── DB Setup (runs only if SKIP_DB_SETUP is not set) ─────────────────────────
if [ "${SKIP_DB_SETUP}" != "true" ]; then
  echo "Running db:setup..."
  npm run db:setup
else
  echo "Skipping db:setup (SKIP_DB_SETUP=true)"
fi

# ─── DB Seed (runs only if SKIP_SEED is not set) ──────────────────────────────
if [ "${SKIP_SEED}" != "true" ]; then
  echo "Running db:seed..."
  npm run db:seed
else
  echo "Skipping db:seed (SKIP_SEED=true)"
fi

# ─── Restart app ──────────────────────────────────────────────────────────────
echo "Restarting pm2 app..."
pm2 delete lavisha-dev 2>/dev/null || true
pm2 start dist/src/main.js --name lavisha-dev

echo "Deploy complete!"