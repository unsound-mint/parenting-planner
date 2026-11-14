#!/usr/bin/env bash
# Runs on the server. Triggered by .github/workflows/deploy.yml through a
# forced-command SSH key, so the key can do nothing except run this script.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch --quiet origin main
git reset --hard --quiet origin/main
docker compose -f deploy/compose.yml up -d --build --remove-orphans
docker image prune -f >/dev/null
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:8790/; then echo "deployed $(git rev-parse --short HEAD)"; exit 0; fi
  sleep 2
done
echo "app did not answer on :8790 after deploy" >&2
docker compose -f deploy/compose.yml logs --tail 50 web >&2
exit 1
