#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  docker compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT

npm install

docker compose up --build -d

node bin/mcp-facade.js http://127.0.0.1:5000/graphql --listen 7000 &
FACADE_PID=$!

sleep 2

node client/facade_client.js http://127.0.0.1:7000

kill "$FACADE_PID"
