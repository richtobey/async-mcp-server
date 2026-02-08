#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${LOG_DIR:-./logs}"
FACADE_LOG="${LOG_DIR}/facade.log"
BACKEND_LOG="${LOG_DIR}/backend.log"
DEMO_TIMEOUT="${DEMO_TIMEOUT:-45}"
GRAPHQL_API_TOKEN="${GRAPHQL_API_TOKEN:-dev-token}"
FACADE_PORT="${FACADE_PORT:-}"

mkdir -p "$LOG_DIR"

cleanup() {
  status=$?
  if [[ $status -ne 0 ]]; then
    echo ""
    echo "Demo failed. Collecting diagnostics..."
    docker compose ps || true
    docker compose logs --no-color backend > "$BACKEND_LOG" 2>&1 || true
    echo "Backend logs (last 120 lines):"
    tail -n 120 "$BACKEND_LOG" || true
    if [[ -f "$FACADE_LOG" ]]; then
      echo "Facade logs (last 120 lines):"
      tail -n 120 "$FACADE_LOG" || true
    fi
  fi
  docker compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Installing dependencies..."
npm install

echo "Starting backend..."
docker compose up --build -d backend

echo "Waiting for backend to be ready..."
for _ in {1..20}; do
  if curl -s -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${GRAPHQL_API_TOKEN}" \
    -d '{"query":"{__typename}"}' \
    http://127.0.0.1:5000/graphql | grep -q "200"; then
    break
  fi
  sleep 1
done

echo "Starting facade..."
if [[ -z "${FACADE_PORT}" ]]; then
  FACADE_PORT=$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("", 0))
print(s.getsockname()[1])
s.close()
PY
)
fi
export FACADE_PORT
echo "Facade port: ${FACADE_PORT}"
node bin/mcp-facade.js http://127.0.0.1:5000/graphql --listen "$FACADE_PORT" \
  --header "Authorization: Bearer ${GRAPHQL_API_TOKEN}" \
  >"$FACADE_LOG" 2>&1 &
FACADE_PID=$!

sleep 2

echo "Running client (timeout ${DEMO_TIMEOUT}s)..."
python3 - <<'PY'
import os
import subprocess
import sys

timeout = int(os.environ.get("DEMO_TIMEOUT", "45"))
try:
    subprocess.run(
        ["node", "client/facade_client.js", f"http://127.0.0.1:{os.environ['FACADE_PORT']}"],
        check=True,
        timeout=timeout,
    )
except subprocess.TimeoutExpired:
    print(f"Client timed out after {timeout}s")
    sys.exit(124)
PY

echo "Demo completed."
kill "$FACADE_PID"
