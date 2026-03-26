#!/bin/bash
set -e

ENVIRONMENT=${CODEPIPELINE_VARIABLE_DEPLOY_ENV:-dev}
APP_DIR="/home/ec2-user/workspace/lavisha-$ENVIRONMENT"

echo "Preparing directory: $APP_DIR"

mkdir -p "$APP_DIR"

echo "Fixing ownership..."
chown -R ec2-user:ec2-user "$APP_DIR"

echo "Ensuring correct permissions..."
chmod -R 755 "$APP_DIR"