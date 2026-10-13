// pm2 config shipped inside the standalone package. Start with: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "it-helpdesk",
      script: "server.js",
      cwd: __dirname,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // Linux shells often set HOSTNAME to the machine name, which would make Next listen only on that address.
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
