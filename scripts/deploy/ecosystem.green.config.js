// PM2 config — GREEN slot of the arixcall reskin blue-green pair (port 3001).
// See ecosystem.blue.config.js for why each deploy fresh-starts the inactive
// color instead of reloading (pm2#5939 symlink-path caching).
module.exports = {
  apps: [
    {
      name: 'nuxcall-green',
      script: '/opt/nuxcall-reskin/current/server.js',
      cwd: '/opt/nuxcall-reskin/current',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
