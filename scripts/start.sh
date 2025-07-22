#!/bin/bash

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

cd /home/ec2-user/workspace/lavisha-dev

#npm install
# Only when new packages are added
if ! cmp -s package-lock.json last-install.lock; then
  echo "Dependencies changed, running install"
  npm ci
  cp package-lock.json last-install.lock
else
  echo "No dependency changes."
fi

# npm run db:setup
# ✅ Run db:setup only if there are new migrations
if git diff --name-only origin/staging -- prisma/migrations | grep -q .; then
  echo "Running DB setup..."
  npm run db:setup
else
  echo "No new migrations. Skipping DB setup."
fi

# use SKIP_SEED FLAG
npm run db:seed

# npm run db:generate
# ✅ Run db:generate if prisma/schema.prisma has changed
if git diff --name-only origin/staging -- prisma/schema.prisma | grep -q .; then
  echo "Running db:generate..."
  npm run db:generate
else
  echo "No schema changes. Skipping db:generate."
fi

load=$(uptime | awk -F'load average: ' '{ print $2 }' | cut -d, -f1 | xargs)
if (( $(echo "$load > 1.0" | bc -l) )); then
  echo "CPU load is high ($load). Skipping build."
  exit 1
fi

if [ ! -d "dist" ]; then
  echo "No dist directory. Running build..."
  npm run build
else
  echo "dist/ already exists. Skipping build."
fi

pm2 delete lavisha-dev 2>/dev/null
pm2 start dist/src/main.js --name lavisha-dev 