// PM2 yapılandırması: `pnpm build` sonrası `pnpm start` ile derlenmiş botları başlatır.
// Yeni bir bot eklendiğinde `apps` listesine aynı biçimde bir kayıt eklenir.
module.exports = {
  apps: [
    {
      name: 'moderasyon',
      script: 'dist/bots/moderasyon/index.js',
      node_args: '--env-file=.env',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      time: true,
    },
  ],
};
