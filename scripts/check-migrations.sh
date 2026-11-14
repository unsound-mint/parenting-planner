#!/usr/bin/env bash
# Fails if a migration that exists on the base branch was edited, renamed or deleted.
# Applied migrations are history: production has already run them. Add a new file instead.
# Usage: scripts/check-migrations.sh [base-ref]   (default origin/main)
set -euo pipefail
base="${1:-origin/main}"
dir=api/internal/store/migrations
changed=$(git diff --name-status --diff-filter=MDR "$base"...HEAD -- "$dir" || true)
if [[ -n "$changed" ]]; then
  echo "These migrations already exist on $base and must not change:"
  echo "$changed"
  echo "Revert them and add a new migration with the next number instead (see api/AGENTS.md)."
  exit 1
fi
