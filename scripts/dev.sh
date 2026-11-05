#!/usr/bin/env bash
# Development only: starts the database, Flask API, and Next.js app.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://careflow:careflow_dev@127.0.0.1:5432/careflow}"
export API_URL="${API_URL:-http://127.0.0.1:5000}"

if [[ ! -x backend/.venv/bin/python || ! -d frontend/node_modules ]]; then
  echo 'Install dependencies first: see README.md.' >&2
  exit 1
fi

docker compose up -d --wait db
(
  cd backend
  .venv/bin/python -m flask --app app init-db
  .venv/bin/python -m flask --app app seed
)

api_pid=''
web_pid=''
cleanup() {
  trap - EXIT INT TERM
  [[ -z "$api_pid" ]] || kill "$api_pid" 2>/dev/null || true
  [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  cd backend
  exec .venv/bin/python -m flask --app app run --host 0.0.0.0 --port 5000
) &
api_pid=$!
(
  cd frontend
  exec npm run dev
) &
web_pid=$!
wait -n "$api_pid" "$web_pid"
