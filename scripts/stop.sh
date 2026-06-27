#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="finally"

if docker ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Stopping FinAlly..."
  docker stop "$CONTAINER_NAME" > /dev/null
  docker rm "$CONTAINER_NAME" > /dev/null
  echo "FinAlly stopped. Data persists in 'finally-data' Docker volume."
  echo "To remove all data: docker volume rm finally-data"
else
  echo "FinAlly is not running."
fi
