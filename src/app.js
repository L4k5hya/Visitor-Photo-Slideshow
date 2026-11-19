const express = require('express');
const { createUploadRouter } = require('./upload');
const { createPrivacyRouter } = require('./privacy');
const { EventHub } = require('./events');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

function createApp(db, config = {}, events = new EventHub()) {
  const cfg = {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 5,
    maxFiles: 5,
    slideDurationSeconds: Number(process.env.SLIDE_DURATION_SECONDS) || 10,
    adminPassword: process.env.ADMIN_PASSWORD,
    trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false,
    uploadRateLimit: Number(process.env.UPLOAD_RATE_LIMIT) || 60,
    uploadRateWindowMs: 10 * 60 * 1000,
    adminFailLimit: 10,
    ...config,
  };

  const app = express();
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);
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
  const limiter = (opts) =>
    rateLimit({ standardHeaders: 'draft-7', legacyHeaders: false, ...opts });

  app.use('/api/upload', limiter({
    windowMs: cfg.uploadRateWindowMs,
    limit: cfg.uploadRateLimit,
    message: { error: 'Too many uploads. Please wait a few minutes and try again.' },
  }));

  // Only failed attempts count, so the real admin is never locked out by their own use
  app.use('/api/admin', limiter({
    windowMs: 15 * 60 * 1000,
    limit: cfg.adminFailLimit,
    skipSuccessfulRequests: true,
    message: { error: 'Too many failed admin attempts. Try again later.' },
  }));
  
  app.use('/api', createUploadRouter(db, cfg, events));
  app.use('/api', createPrivacyRouter(db, cfg, events));

  return app;
}

module.exports = { createApp };