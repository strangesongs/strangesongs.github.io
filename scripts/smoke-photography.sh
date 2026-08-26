#!/usr/bin/env bash
# Smoke for photography placeholder. Usage: ./scripts/smoke-photography.sh [base-url]
set -euo pipefail
BASE="${1:-http://127.0.0.1:8090}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Checking $BASE/photography.html"
curl -fsS "$BASE/photography.html" -o /tmp/photography-smoke.html
grep -qi 'coming soon' /tmp/photography-smoke.html
grep -q 'what we see is what we are' /tmp/photography-smoke.html

if [[ -f "$ROOT/photography.js" ]]; then
  if grep -q 'api.flickr.com' "$ROOT/photography.js"; then
    echo "FAIL: photography.js still references api.flickr.com" >&2
    exit 1
  fi
  if grep -q 'live.staticflickr.com' "$ROOT/photography.js"; then
    echo "FAIL: photography.js still references live.staticflickr.com" >&2
    exit 1
  fi
fi

echo "OK: photography coming-soon page"
