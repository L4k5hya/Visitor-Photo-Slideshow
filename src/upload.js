const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = require('./repository');
const { detectImageType } = require('./validate');

const MAX_NAME_LENGTH = 50;

function createUploadRouter(db, cfg, events) {
  const router = express.Router();
  fs.mkdirSync(cfg.uploadDir, { recursive: true });

  const parseUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: cfg.maxFileSizeMb * 1024 * 1024,
      files: cfg.maxFiles,
      fields: 10,
    },
  }).array('photos', cfg.maxFiles);

  router.post('/upload', (req, res) => {
    parseUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `Each photo must be ${cfg.maxFileSizeMb} MB or smaller.` });
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: `You can upload at most ${cfg.maxFiles} photos at once.` });
        }
        return res.status(400).json({ error: 'Invalid upload.' });
      }
      if (err) return res.status(500).json({ error: 'Upload failed.' });
      handleUpload(req, res);
    });
  });

  function handleUpload(req, res) {
    // 1. Consent is mandatory (checked on the server, not just in the UI)
    if (req.body.consent !== 'true') {
      return res.status(400).json({ error: 'You must consent to your photo being displayed publicly.' });
    }

    // 2. At least one file
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Please choose at least one photo.' });
    }

    // 3. Validate every file by magic bytes; reject the whole request if any fail
    const checked = [];
    for (const f of files) {
      const type = detectImageType(f.buffer);
      if (!type) {
        return res.status(400).json({ error: 'Only real JPEG, PNG or WebP images are allowed.' });
      }
      checked.push({ file: f, type });
    }

    // 4. Identify returning visitor by token; otherwise a name is required
    let visitor = repo.findVisitorByToken(db, req.get('x-visitor-token'));
    const name = (req.body.name || '').trim();
    if (!visitor && (name.length === 0 || name.length > MAX_NAME_LENGTH)) {
      return res.status(400).json({ error: `Please enter your name (1-${MAX_NAME_LENGTH} characters).` });
    }
    const previous = visitor
      ? repo.getPhotosForVisitor(db, visitor.id).map((p) => ({
          id: p.id,
          url: `/photos/${p.filename}`,
        }))
      : [];

    // 5. Write files and DB rows together; clean up files if anything fails
    const written = [];
    let visitorId = visitor ? visitor.id : null;
    let newToken = null;
    const consentAt = new Date().toISOString();
    const photos = [];

    try {
      db.transaction(() => {
        if (!visitor) {
          const created = repo.createVisitor(db, name);
          visitorId = created.visitorId;
          newToken = created.token;
        }
        for (const { file, type } of checked) {
          const filename = `${crypto.randomUUID()}.${type.ext}`;
          fs.writeFileSync(path.join(cfg.uploadDir, filename), file.buffer, { flag: 'wx' });
          written.push(filename);
          const id = repo.addPhoto(db, {
            visitorId,
            filename,
            originalName: path.basename(file.originalname || '').slice(0, 100),
            mimeType: type.mime,
            sizeBytes: file.size,
            consentAt,
          });
          photos.push({ id, filename });
        }
      })();
    } catch (e) {
      written.forEach((fn) => fs.rmSync(path.join(cfg.uploadDir, fn), { force: true }));
      return res.status(500).json({ error: 'Could not save your photos.' });
    }
    events.broadcast('slideshow', {
      name: visitor ? visitor.name : name,
      returning: Boolean(visitor),
      newPhotos: photos.map((p) => ({ id: p.id, url: `/photos/${p.filename}` })),
      previousPhotos: previous,
    });

    res.status(201).json({
      returning: Boolean(visitor),
      token: newToken, // only sent the first time
      photos,
    });
  }

  return router;
}

module.exports = { createUploadRouter };