const express = require('express');
const { createUploadRouter } = require('./upload');
const { EventHub } = require('./events');

function createApp(db, config = {}, events = new EventHub()) {
  const cfg = {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 5,
    maxFiles: 5,
    slideDurationSeconds: Number(process.env.SLIDE_DURATION_SECONDS) || 10,
    ...config,
  };

  const app = express();
  app.use(express.json());
  app.use(express.static('public'));

  // Uploaded photos: images only, never directory listings, no content sniffing
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
    res.json({ slideDurationSeconds: cfg.slideDurationSeconds })
  );
  app.get('/api/events', events.handler());
  app.use('/api', createUploadRouter(db, cfg, events));

  return app;
}

module.exports = { createApp };