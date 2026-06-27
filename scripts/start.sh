#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="finally"
CONTAINER_NAME="finally"
PORT=8000
VOLUME_NAME="finally-data"

REBUILD=false
for arg in "$@"; do
  case $arg in
    --build) REBUILD=true ;;
  esac
done

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check .env exists
if [ ! -f ".env" ]; then
  echo "Warning: .env file not found. Copying from .env.example..."
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "Created .env from .env.example. Please add your OPENROUTER_API_KEY."
  else
    echo "Error: No .env or .env.example found. Please create a .env file."
    exit 1
  fi
fi

# Stop existing container if running
if docker ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Stopping existing container..."
  docker stop "$CONTAINER_NAME" > /dev/null
  docker rm "$CONTAINER_NAME" > /dev/null
fi

# Build image if needed
if $REBUILD || ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
  echo "Building FinAlly Docker image..."
  docker build -t "$IMAGE_NAME" .
  echo "Build complete."
fi

# Run the container
echo "Starting FinAlly..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -v "${VOLUME_NAME}:/app/db" \
  -p "${PORT}:8000" \
  --env-file .env \
  "$IMAGE_NAME"

# Wait for health check
echo -n "Waiting for FinAlly to start"
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT}/api/health" > /dev/null 2>&1; then
    echo ""
    echo "FinAlly is running at http://localhost:${PORT}"
    # Open browser if possible
    if command -v open > /dev/null 2>&1; then
      open "http://localhost:${PORT}"
    elif command -v xdg-open > /dev/null 2>&1; then
      xdg-open "http://localhost:${PORT}"
    fi
    exit 0
  fi
  echo -n "."
  sleep 1
done
echo ""
echo "Warning: FinAlly may still be starting. Check http://localhost:${PORT}"
echo "View logs with: docker logs -f ${CONTAINER_NAME}"
