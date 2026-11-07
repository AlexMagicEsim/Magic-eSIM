#!/usr/bin/env bash
# Runs ON THE WEB HOST (piped over SSH by .github/workflows/deploy-web.yml; also usable by hand).
#
#   activate.sh <release>     switch /srv/magicesim/current to releases/<release>, nginx -t, reload; revert on failure
#   activate.sh --rollback    switch back to the release before the current one, nginx -t, reload
#
# The switch is atomic (a new symlink renamed over the old one). nginx reads its config only on reload, so a release
# whose config fails `nginx -t` is switched back before anything reloads; the few milliseconds in between serve the
# new files under the old (valid) config. Keeps the newest 5 releases, never the current or the previous one.
# Needs (sudoers, nothing more): deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx
set -euo pipefail
BASE="${WEB_BASE:-/srv/magicesim}"
KEEP=5
cd "$BASE"

switch_to() { ln -sfn "releases/$1" current.next && mv -T current.next current; }
current_release() { basename "$(readlink current 2>/dev/null || echo none)"; }

if [ "${1:-}" = "--rollback" ]; then
  cur="$(current_release)"
  prev="$(ls -1 releases | sort | awk -v c="$cur" '$0 < c' | tail -n 1)"
  [ -n "$prev" ] || { echo "no release older than $cur to roll back to" >&2; exit 1; }
  target="$prev"
else
  target="${1:?usage: activate.sh <release> | --rollback}"
  [[ "$target" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$ ]] || { echo "not a release name: $target" >&2; exit 1; }
fi
[ -f "releases/$target/site/index.html" ] && [ -f "releases/$target/site/404.html" ] || { echo "releases/$target has no site" >&2; exit 1; }
[ -f "releases/$target/nginx/site.conf" ] && [ -f "releases/$target/nginx/redirects.conf" ] && [ -f "releases/$target/nginx/country-map.conf" ] \
  || { echo "releases/$target has no nginx config" >&2; exit 1; }

before="$(current_release)"
switch_to "$target"
if ! sudo /usr/sbin/nginx -t; then
  echo "nginx -t refused releases/$target — switching back to $before" >&2
  [ "$before" != none ] && switch_to "$before"
  exit 1
fi
sudo /usr/bin/systemctl reload nginx
echo "live: releases/$target (was: $before)"

# prune: keep the newest $KEEP, and always the current and the previous one
cur="$(current_release)"
ls -1 releases | sort -r | tail -n +$((KEEP + 1)) | while read -r old; do
  [ "$old" = "$cur" ] || [ "$old" = "$before" ] || rm -rf -- "releases/$old"
done
