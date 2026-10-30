// PM2 config — BLUE slot of the arixcall reskin blue-green pair (port 3000).
//
// script/cwd point at the shared `current` symlink. The deploy does a FRESH
// `pm2 start` of the INACTIVE color each release (never `pm2 reload`), so PM2
// re-resolves `current` -> the new release at start time. This sidesteps
// pm2#5939, where a reloaded/resurrected app keeps the release path it resolved
// and cached at its FIRST start — the bug that made v1.20.25/26 ship nothing.
module.exports = {
  apps: [
    {
      name: 'nuxcall-blue',
      script: '/opt/nuxcall-reskin/current/server.js',
      cwd: '/opt/nuxcall-reskin/current',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
