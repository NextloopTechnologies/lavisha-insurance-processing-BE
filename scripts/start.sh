#!/bin/bash

export NVM_DIR="/home/ec2-user/.nvm"
source "$NVM_DIR/nvm.sh"

cd /home/ec2-user/workspace/lavisha-dev

npm install
npm run db:setup
npm run db:seed
npm run build

pm2 delete lavisha-dev2>/dev/null
pm2 start dist/src/main.js --name lavisha-dev 