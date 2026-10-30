#!/usr/bin/env bash
# Instant rollback for the arixcall reskin blue-green pair.
#
# The previous release keeps running as the STOPPED standby color (activate.sh
# `pm2 stop`s it rather than deleting it), so rollback is just: start it back up
# and flip the nginx upstream to its port. Zero build, zero rebuild, seconds.
set -euo pipefail

APP="/opt/nuxcall-reskin"
UPSTREAM_CONF="/etc/nginx/conf.d/nuxcall-reskin-upstream.conf"
HEALTH_PATH="/login"
RUNTIME_HEALTH_PATH="/api/debug-log"

# Gate on a route handler too (not just the prerendered /login page) — a build
# with a broken server runtime serves /login 200 but 500s on dynamic routes.
health_ok() {  # $1 = port
  curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$1$HEALTH_PATH" || return 1
  local rc
  rc="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1$RUNTIME_HEALTH_PATH")"
  [ -n "$rc" ] && [ "$rc" -lt 500 ]
}

[ "$(cat "$APP/.deploy-target" 2>/dev/null)" = "reskin" ] || { echo "[rollback] ABORT: not the reskin box"; exit 2; }

ACTIVE="$(cat "$APP/.active-color" 2>/dev/null || echo blue)"
if [ "$ACTIVE" = "blue" ]; then STANDBY=green; STANDBY_PORT=3001; else STANDBY=blue; STANDBY_PORT=3000; fi

# DETERMINISTIC: repoint `current` to the recorded previous release BEFORE starting
# the standby. activate.sh advances `current` to the NEW release, and pm2 re-resolves
# `current` on a fresh start — so without this the standby would start on the SAME
# broken release we are trying to roll back FROM (this is a real incident we hit).
PREV_REL="$(cat "$APP/.prev-release" 2>/dev/null || true)"
echo "[rollback] active=$ACTIVE -> restoring standby=$STANDBY(:$STANDBY_PORT)  prev-release=${PREV_REL:-<unknown>}"
if [ -n "$PREV_REL" ] && [ -f "$PREV_REL/server.js" ]; then
  ln -sfn "$PREV_REL" "$APP/current"
else
  echo "[rollback] WARN: no valid .prev-release recorded — restarting standby on its current symlink target."
fi

pm2 describe "nuxcall-$STANDBY" >/dev/null 2>&1 || { echo "[rollback] ABORT: no standby '$STANDBY' to roll back to"; exit 1; }
# delete+start (NOT plain start) so the fresh process re-resolves the fixed `current`.
pm2 delete "nuxcall-$STANDBY" >/dev/null 2>&1 || true
pm2 start "$APP/shared/ecosystem.$STANDBY.config.js" >/dev/null 2>&1 || true

ok=0
for _ in $(seq 1 20); do
  if health_ok "$STANDBY_PORT"; then ok=1; break; fi
  sleep 1
done
[ "$ok" = 1 ] || { echo "[rollback] ABORT: standby unhealthy, leaving $ACTIVE live"; exit 1; }

printf 'upstream nuxcall_reskin { server 127.0.0.1:%s; }\n' "$STANDBY_PORT" > "$UPSTREAM_CONF"
nginx -t && nginx -s reload
echo "$STANDBY" > "$APP/.active-color"
pm2 stop "nuxcall-$ACTIVE" >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true
echo "[rollback] LIVE: nuxcall-$STANDBY(:$STANDBY_PORT)"
