#!/usr/bin/env bash
set -euo pipefail

# Commit only generated data; preserve source commits made during collection.
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add site/data/prices.json site/data/county-cache.json site/data/terminal.json
if ! git diff --cached --quiet; then
  git commit -m 'Update fuel reports and collection status'
fi

# A source push may arrive during collection or between fetch and push.
# Rebase rather than force-push, and stop safely on overlapping edits.
for attempt in 1 2 3; do
  git fetch origin main
  if ! git rebase origin/main; then
    git rebase --abort
    echo 'Cannot publish reports: concurrent edits conflict. No remote files were overwritten.' >&2
    exit 1
  fi
  if git push origin HEAD:main; then
    exit 0
  fi
  echo "Push attempt $attempt failed; checking for newer commits." >&2
done
echo 'Could not publish reports after three attempts. No force-push was attempted.' >&2
exit 1
