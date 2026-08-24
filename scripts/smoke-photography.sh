#!/usr/bin/env bash
# Local smoke for photography portfolio. Usage: ./scripts/smoke-photography.sh [base-url]
set -euo pipefail
BASE="${1:-http://127.0.0.1:8090}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Checking $BASE/photography.html"
curl -fsS "$BASE/photography.html" -o /tmp/photography-smoke.html
grep -q 'id="photo-gallery"' /tmp/photography-smoke.html
grep -q 'photography.js' /tmp/photography-smoke.html
grep -q 'id="retry-load"' /tmp/photography-smoke.html
grep -q 'id="last-updated"' /tmp/photography-smoke.html

curl -fsS "$BASE/content/photography/albums.json" -o /tmp/photography-albums.json
curl -fsS "$BASE/content/photography/album-photos/all.json" -o /tmp/photography-all-shard.json
grep -q '"slug"' /tmp/photography-albums.json
grep -q '"server"' /tmp/photography-all-shard.json

if grep -q 'api.flickr.com' "$ROOT/photography.js"; then
  echo "FAIL: photography.js still references api.flickr.com" >&2
  exit 1
fi
if grep -q 'api_key' "$ROOT/photography.js"; then
  echo "FAIL: photography.js still references api_key" >&2
  exit 1
fi

node "$ROOT/scripts/validate-photography-manifests.js"

echo "OK: photography page + manifests; no runtime Flickr API in photography.js"
