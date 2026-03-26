#!/bin/bash

set -e

ENVIRONMENT=${CODEPIPELINE_VARIABLE_DEPLOY_ENV:-dev}

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "stg" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Invalid DEPLOY_ENV: $ENVIRONMENT"
  exit 1
fi

APP_DIR="/home/ec2-user/workspace/lavisha"

# export NVM_DIR="/home/ec2-user/.nvm"
# source "$NVM_DIR/nvm.sh"

export NVM_DIR="/home/ec2-user/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh"
else
  echo "NVM not found!"
  exit 1
fi

# cd /home/ec2-user/workspace/lavisha-dev
echo "Using app directory: $APP_DIR"

if [ ! -d "$APP_DIR" ]; then
  echo "App directory does not exist: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

#npm install
# Only when new packages are added
# if ! cmp -s package-lock.json last-install.lock; then
echo "Dependencies changed, running install"
npm ci
cp package-lock.json last-install.lock
# else
#   echo "No dependency changes."
# fi

# use SKIP_DB_SETUP
echo "Running db:setup..."
npm run db:setup

# use SKIP_SEED FLAG
echo "Running db:seed..."
npm run db:seed

cpu_count=$(nproc)
load=$(uptime | awk -F'load average: ' '{ print $2 }' | cut -d, -f1 | xargs)

if (( $(echo "$load > $cpu_count" | bc -l) )); then
  echo "CPU load is high ($load). Skipping build."
  exit 1
fi

 npm run build
# if [ ! -d "dist" ]; then
#   echo "No dist directory. Running build..."
#   npm run build
# else
#   echo "dist/ already exists. Skipping build."
# fi

pm2 delete lavisha-$ENVIRONMENT 2>/dev/null || true
pm2 start dist/src/main.js --name lavisha-$ENVIRONMENT 