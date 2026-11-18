const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createVisitor(db, name) {
  const token = crypto.randomBytes(32).toString('hex');
  const info = db
    .prepare('INSERT INTO visitors (name, token_hash) VALUES (?, ?)')
    .run(name.trim(), hashToken(token));
  return { visitorId: info.lastInsertRowid, token };
}

function findVisitorByToken(db, token) {
  if (typeof token !== 'string' || token.length === 0) return null;
  const visitor = db
    .prepare('SELECT * FROM visitors WHERE token_hash = ?')
    .get(hashToken(token));
  if (visitor) {
    db.prepare("UPDATE visitors SET last_seen_at = datetime('now') WHERE id = ?")
      .run(visitor.id);
  }
  return visitor || null;
}

function addPhoto(db, { visitorId, filename, originalName, mimeType, sizeBytes, consentAt }) {
  const info = db
    .prepare(`INSERT INTO photos
      (visitor_id, filename, original_name, mime_type, size_bytes, consent_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
    .run(visitorId, filename, originalName, mimeType, sizeBytes, consentAt);
  return info.lastInsertRowid;
}

function getPhotosForVisitor(db, visitorId) {
  return db
    .prepare(`SELECT * FROM photos
              WHERE visitor_id = ? AND status = 'approved'
              ORDER BY created_at, id`)
    .all(visitorId);
}

module.exports = { hashToken, createVisitor, findVisitorByToken, addPhoto, getPhotosForVisitor };