#!/usr/bin/env bash
# Blue-green activator for the arixcall reskin (Next.js standalone + PM2 cluster).
#
# WHY BLUE-GREEN (not `pm2 reload`): PM2 dereferences the `current` symlink and
# caches the RESOLVED release path at first start (pm2#5939). `pm2 reload` — even
# by ecosystem file, even --update-env — then re-execs that cached OLD path, so a
# symlink swap silently ships nothing (this is exactly what stranded v1.20.25/26
# on the previous build). The only reliable way to pick up a new release is a
# FRESH `pm2 start`. So we run the new release as a fresh process on the INACTIVE
# color's port (no traffic there), health-gate it, then flip traffic by rewriting
# ONE nginx upstream file and reloading. The old color stays up until the flip
# succeeds -> automatic rollback on any failure, true zero downtime.
#
# Called by CI (or by hand) AFTER the artifact + ecosystem files are in /tmp.
# The box never builds.
set -euo pipefail

SHA="${1:?usage: activate.sh <git-sha>}"
APP="/opt/nuxcall-reskin"
PM2_DIR="$APP/shared"
UPSTREAM_CONF="/etc/nginx/conf.d/nuxcall-reskin-upstream.conf"
HEALTH_PATH="/login"      # prerendered page — 200 on a healthy standalone server
RUNTIME_HEALTH_PATH="/api/debug-log"  # a ROUTE HANDLER — see health_ok() below
KEEP=5

# Health gate. CRITICAL: probe a ROUTE HANDLER, not just the /login page. A build
# with a broken server runtime (e.g. a Turbopack-compiled build shipped against a
# webpack node_modules) still serves the prerendered /login page 200 while every
# dynamic route handler 500s — exactly how a broken build once reached users. The
# route handler executes the server runtime: any non-5xx proves it loads (/api/
# debug-log is 403 in prod); a broken runtime 500s here, failing the gate so the
# flip never happens and the old color stays live.
health_ok() {  # $1 = port
  curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$1$HEALTH_PATH" || return 1
  local rc
  rc="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1$RUNTIME_HEALTH_PATH")"
  [ -n "$rc" ] && [ "$rc" -lt 500 ]
}

# ---- WRONG-SERVER GUARD ------------------------------------------------------
# Refuse unless the box is stamped as the reskin, so a misconfigured host secret
# can never push the reskin build onto the prod frontend.
if [ "$(cat "$APP/.deploy-target" 2>/dev/null)" != "reskin" ]; then
  echo "[deploy] ABORT: $APP/.deploy-target is not 'reskin' — refusing."
  exit 2
fi
# -----------------------------------------------------------------------------

REL="$APP/releases/$SHA"
mkdir -p "$REL" "$PM2_DIR"

echo "[deploy] unpacking $SHA -> $REL"
tar xzf "/tmp/reskin-$SHA.tgz" -C "$REL"
[ -f "$REL/server.js" ] || { echo "[deploy] ABORT: no server.js in release $SHA"; exit 1; }

# Which color is live now, and which one do we deploy onto?
ACTIVE="$(cat "$APP/.active-color" 2>/dev/null || echo blue)"
if [ "$ACTIVE" = "blue" ]; then
  TARGET=green; TARGET_PORT=3001; ACTIVE_PORT=3000
else
  TARGET=blue;  TARGET_PORT=3000; ACTIVE_PORT=3001
fi
echo "[deploy] active=$ACTIVE(:$ACTIVE_PORT)  ->  target=$TARGET(:$TARGET_PORT)"

# Advance the shared `current` symlink FIRST so the target's fresh start resolves
# to $SHA. (Keep the previous target for rollback bookkeeping.)
PREV_LINK="$(readlink "$APP/current" 2>/dev/null || true)"
# Record the OUTGOING release so rollback.sh can deterministically repoint
# `current` back to it. pm2 re-resolves the `current` symlink on a fresh start,
# so rollback MUST fix the symlink itself rather than rely on a cached path.
[ -n "$PREV_LINK" ] && printf '%s\n' "$PREV_LINK" > "$APP/.prev-release"
ln -sfn "$REL" "$APP/current"

install -m 644 "/tmp/ecosystem.$TARGET.config.js" "$PM2_DIR/ecosystem.$TARGET.config.js"

# Fresh-start the TARGET (inactive) color. delete+start, never reload.
echo "[deploy] fresh-starting nuxcall-$TARGET on :$TARGET_PORT"
pm2 delete "nuxcall-$TARGET" >/dev/null 2>&1 || true
pm2 start "$PM2_DIR/ecosystem.$TARGET.config.js"

# Health-gate the target port. Next's standalone server does NOT emit the pm2
# 'ready' signal, so poll HTTP instead of using --wait-ready.
ok=0
for _ in $(seq 1 30); do
  if health_ok "$TARGET_PORT"; then ok=1; break; fi
  sleep 1
done
if [ "$ok" != 1 ]; then
  echo "[deploy] TARGET unhealthy — aborting. $ACTIVE(:$ACTIVE_PORT) still live (no downtime)."
  pm2 delete "nuxcall-$TARGET" >/dev/null 2>&1 || true
  [ -n "$PREV_LINK" ] && ln -sfn "$PREV_LINK" "$APP/current" || true
  exit 1
fi
echo "[deploy] nuxcall-$TARGET healthy"

# Atomic traffic flip: one upstream file + graceful reload.
write_upstream() { printf 'upstream nuxcall_reskin { server 127.0.0.1:%s; }\n' "$1" > "$UPSTREAM_CONF"; }
write_upstream "$TARGET_PORT"
if ! nginx -t 2>/dev/null; then
  echo "[deploy] nginx -t FAILED — reverting upstream, $ACTIVE still live."
  write_upstream "$ACTIVE_PORT"
  pm2 delete "nuxcall-$TARGET" >/dev/null 2>&1 || true
  exit 1
fi
nginx -s reload
sleep 2

# Confirm the new color actually serves through nginx before retiring the old one.
if ! health_ok "$TARGET_PORT"; then
  echo "[deploy] post-flip healthcheck failed — rolling back to $ACTIVE."
  write_upstream "$ACTIVE_PORT"; nginx -s reload
  exit 1
fi

# Commit the switch.
echo "$TARGET" > "$APP/.active-color"
pm2 stop "nuxcall-$ACTIVE" >/dev/null 2>&1 || true   # keep the entry for instant rollback; frees its memory
pm2 save >/dev/null 2>&1 || true
echo "[deploy] LIVE: nuxcall-$TARGET(:$TARGET_PORT) serving $SHA"

# Prune old releases (keep last $KEEP), tidy the artifact.
ls -1dt "$APP"/releases/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
rm -f "/tmp/reskin-$SHA.tgz"
exit 0
