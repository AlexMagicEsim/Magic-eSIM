#!/usr/bin/env bash
# Builds today's Pages artifact, generates the nginx config, starts the pinned nginx in Docker with the real site.conf,
# runs `nginx -t`, then scripts/verify-web-redirects.mjs against it. Touches nothing outside a temp dir and Docker.
#
#   infra/web/test/run.sh [--report <file.json>]        (from anywhere; needs node 22, docker compose, openssl)
#
# The new tree (/ru/..., /destinations/..., /guides/...) does not exist yet, so the verifier runs with
# --allow-missing-targets: a moved path must still answer exactly one 301 to its target, and the target must not be a
# redirect; a target absent from the tree is reported as `target-missing`, not a failure.
# WEB_TEST_STRICT=1 (deploy-web.yml) drops that allowance: a release whose moved paths land on a 404 never deploys.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
report=""
allow="--allow-missing-targets"
[ "${WEB_TEST_STRICT:-}" = 1 ] && allow=""
if [ "${1:-}" = "--report" ]; then report="$2"; fi

export WEB_TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/web-test.XXXXXX")"
export WEB_TEST_HTTP_PORT="${WEB_TEST_HTTP_PORT:-18080}" WEB_TEST_HTTPS_PORT="${WEB_TEST_HTTPS_PORT:-18443}"
compose=(docker compose -f "$here/compose.yml")
cleanup() { "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf "$WEB_TEST_ROOT"; }
trap cleanup EXIT

node "$repo/scripts/build-web-server-config.mjs" --check
node "$repo/scripts/build-pages-artifact.mjs" --out "$WEB_TEST_ROOT/current/site" >/dev/null
mkdir -p "$WEB_TEST_ROOT/current/nginx" "$WEB_TEST_ROOT/certs"
cp "$repo"/infra/web/nginx/*.conf "$WEB_TEST_ROOT/current/nginx/"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=magicesim.store" \
  -addext "subjectAltName=DNS:magicesim.store,DNS:www.magicesim.store" \
  -keyout "$WEB_TEST_ROOT/certs/privkey.pem" -out "$WEB_TEST_ROOT/certs/fullchain.pem" >/dev/null 2>&1
chmod -R a+rX "$WEB_TEST_ROOT"

"${compose[@]}" run --rm --no-deps -T nginx nginx -t
"${compose[@]}" up -d --wait --wait-timeout 60
for _ in $(seq 1 30); do
  curl -sk -o /dev/null --resolve "magicesim.store:$WEB_TEST_HTTPS_PORT:127.0.0.1" "https://magicesim.store:$WEB_TEST_HTTPS_PORT/" && break
  sleep 1
done

node "$repo/scripts/verify-web-redirects.mjs" \
  --base "https://127.0.0.1:$WEB_TEST_HTTPS_PORT" --host magicesim.store --insecure \
  --http-base "http://127.0.0.1:$WEB_TEST_HTTP_PORT" \
  --docroot "$WEB_TEST_ROOT/current/site" ${allow:+$allow} ${report:+--report "$report"} \
  || { "${compose[@]}" logs --tail 20 nginx; exit 1; }
