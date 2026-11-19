const express = require('express');
const { createUploadRouter } = require('./upload');
const { createPrivacyRouter } = require('./privacy');
const { EventHub } = require('./events');
const helmet = require('helmet');

function createApp(db, config = {}, events = new EventHub()) {
  const cfg = {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 5,
    maxFiles: 5,
    slideDurationSeconds: Number(process.env.SLIDE_DURATION_SECONDS) || 10,
    adminPassword: process.env.ADMIN_PASSWORD,
    ...config,
  };

  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'blob:', 'data:'], // blob: for upload previews
          'connect-src': ["'self'"],               // fetch + EventSource
          'upgrade-insecure-requests': null,       // would break plain-http LAN use
        },
      },
    })
  );
  app.use(express.json());
  app.use(express.static('public'));

  app.use(
    '/photos',
    express.static(cfg.uploadDir, {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
    })
  );

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/config', (req, res) =>
    res.json({
      slideDurationSeconds: cfg.slideDurationSeconds,
      maxFileSizeMb: cfg.maxFileSizeMb,
      maxFiles: cfg.maxFiles,
    })
  );
  app.get('/api/events', events.handler());
  app.use('/api', createUploadRouter(db, cfg, events));
  app.use('/api', createPrivacyRouter(db, cfg, events));

  return app;
}

module.exports = { createApp };