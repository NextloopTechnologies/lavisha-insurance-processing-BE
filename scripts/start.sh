#!/bin/bash

set -e

BASE_DIR="/home/ec2-user/workspace"
ENVIRONMENT=${CODEPIPELINE_VARIABLE_DEPLOY_ENV:-dev}

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Invalid DEPLOY_ENV: $ENVIRONMENT"
  exit 1
fi

if [ "$ENVIRONMENT" = "prod" ]; then
  APP_DIR="$BASE_DIR/lavisha-prod"
else
  APP_DIR="$BASE_DIR/lavisha-dev"
fi

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

# cd /home/ec2-user/workspace/lavisha-dev
echo "using app directory: $APP_DIR"
cd $APP_DIR

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

pm2 delete lavisha-$ENVIRONMENT 2>/dev/null
pm2 start dist/src/main.js --name lavisha-$ENVIRONMENT