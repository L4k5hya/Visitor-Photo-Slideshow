const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = require('./repository');

// Hash first so both buffers are the same length for timingSafeEqual
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const parseId = (s) => (/^\d+$/.test(s) ? Number(s) : null);

function createPrivacyRouter(db, cfg, events) {
  const router = express.Router();

  const removeFile = (filename) =>
    fs.rmSync(path.join(cfg.uploadDir, filename), { force: true });

  function requireVisitor(req, res, next) {
    const visitor = repo.findVisitorByToken(db, req.get('x-visitor-token'));
    if (!visitor) return res.status(401).json({ error: 'Visitor not recognised.' });
    req.visitor = visitor;
    next();
  }

  function requireAdmin(req, res, next) {
    if (!cfg.adminPassword || cfg.adminPassword === 'change-me') {
      return res.status(503).json({ error: 'Admin is disabled. Set ADMIN_PASSWORD.' });
    }
    const ok = crypto.timingSafeEqual(
      digest(req.get('x-admin-password') || ''),
      digest(cfg.adminPassword)
    );
    if (!ok) return res.status(401).json({ error: 'Wrong admin password.' });
    next();
  }

  // Removes the file first (fail safe for privacy), then the DB state, then tells the display
  function removePhoto(photo) {
    removeFile(photo.filename);
    repo.markPhotoRemoved(db, photo.id);
    events.broadcast('remove', { ids: [photo.id] });
  }

  // ---- Visitor routes ----
  router.get('/my-photos', requireVisitor, (req, res) => {
    const photos = repo.getPhotosForVisitor(db, req.visitor.id)
      .map((p) => ({ id: p.id, url: `/photos/${p.filename}` }));
    res.json({ name: req.visitor.name, photos });
  });

  router.delete('/photos/:id', requireVisitor, (req, res) => {
    const id = parseId(req.params.id);
    const photo = id ? repo.getPhotoById(db, id) : null;
    // 404 for "not yours" too, so IDs can't be probed
    if (!photo || photo.visitor_id !== req.visitor.id) {
      return res.status(404).json({ error: 'Photo not found.' });
    }
    removePhoto(photo);
    res.status(204).end();
  });

  // Right to erasure: all photos plus the visitor record
  router.delete('/me', requireVisitor, (req, res) => {
    const photos = repo.getAllPhotosForVisitor(db, req.visitor.id);
    photos.forEach((p) => removeFile(p.filename));
    repo.deleteVisitor(db, req.visitor.id);
    events.broadcast('remove', { ids: photos.map((p) => p.id) });
    res.status(204).end();
  });

  // ---- Admin routes ----
  router.get('/admin/photos', requireAdmin, (req, res) => {
    res.json(repo.listRecentPhotos(db).map((p) => ({
      id: p.id, url: `/photos/${p.filename}`, visitor: p.name, createdAt: p.created_at,
    })));
  });

  router.delete('/admin/photos/:id', requireAdmin, (req, res) => {
    const id = parseId(req.params.id);
    const photo = id ? repo.getPhotoById(db, id) : null;
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    removePhoto(photo);
    res.status(204).end();
  });

  return router;
}

module.exports = { createPrivacyRouter };