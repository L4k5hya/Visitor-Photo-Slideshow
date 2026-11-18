
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const { createApp } = require('../src/app');
const { openDb } = require('../src/db');

const {
  realJpeg,
  realPng,
  realWebp,
  jpegWithExif
} = require('./helpers');

// Generate real image buffers for testing
let jpegBuf, pngBuf, webpBuf;

beforeAll(async () => {
  [jpegBuf, pngBuf, webpBuf] = await Promise.all([
    realJpeg(),
    realPng(),
    realWebp()
  ]);
});

const jpeg = () => jpegBuf;
const png = () => pngBuf;
const webp = () => webpBuf;

// Test database and application setup
let db, app, dir;

beforeEach(() => {
  db = openDb(':memory:');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));

  app = createApp(db, {
    uploadDir: dir,
    maxFileSizeMb: 1,
    maxFiles: 5
  });
});

afterEach(() => {
  if (db) db.close();

  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Helper function for sending upload requests
function send({ name = 'Priya', consent = 'true', token, files = [] }) {
  const r = request(app).post('/api/upload');

  if (token) r.set('x-visitor-token', token);
  if (name) r.field('name', name);
  if (consent) r.field('consent', consent);

  files.forEach((f) => {
    r.attach('photos', f.buf, f.name);
  });

  return r;
}

// 1. Valid upload
test('valid upload with consent creates visitor, token and file on disk', async () => {
  const res = await send({
    files: [{ buf: jpeg(), name: 'me.jpg' }]
  });

  expect(res.status).toBe(201);
  expect(res.body.returning).toBe(false);
  expect(res.body.token).toHaveLength(64);
  expect(fs.readdirSync(dir)).toHaveLength(1);
});

// 2. Consent validation
test('upload without consent is rejected and nothing is stored', async () => {
  const res = await send({
    consent: null,
    files: [{ buf: jpeg(), name: 'me.jpg' }]
  });

  expect(res.status).toBe(400);
  expect(fs.readdirSync(dir)).toHaveLength(0);
  expect(db.prepare('SELECT COUNT(*) c FROM visitors').get().c).toBe(0);
});

// 3. Reject text file renamed to JPG
test('text file renamed to .jpg is rejected', async () => {
  const res = await send({
    files: [{
      buf: Buffer.from('hello this is not an image'),
      name: 'fake.jpg'
    }]
  });

  expect(res.status).toBe(400);
  expect(fs.readdirSync(dir)).toHaveLength(0);
});

// 4. Reject executable renamed to PNG
test('executable renamed to .png is rejected', async () => {
  const exe = Buffer.concat([
    Buffer.from('MZ'),
    Buffer.alloc(100)
  ]);

  const res = await send({
    files: [{ buf: exe, name: 'evil.png' }]
  });

  expect(res.status).toBe(400);
});

// 5. File size validation
test('file over the size limit gets 413', async () => {
  const big = Buffer.concat([
    jpeg(),
    Buffer.alloc(1024 * 1024 + 10)
  ]);

  const res = await send({
    files: [{ buf: big, name: 'big.jpg' }]
  });

  expect(res.status).toBe(413);
  expect(fs.readdirSync(dir)).toHaveLength(0);
});

// 6. Reject entire batch if one file is invalid
test('one bad file rejects the whole batch', async () => {
  const res = await send({
    files: [
      { buf: jpeg(), name: 'ok.jpg' },
      {
        buf: Buffer.from('not an image at all'),
        name: 'bad.jpg'
      }
    ]
  });

  expect(res.status).toBe(400);
  expect(fs.readdirSync(dir)).toHaveLength(0);
  expect(db.prepare('SELECT COUNT(*) c FROM visitors').get().c).toBe(0);
});

// 7. New visitor must provide a name
test('new visitor must provide a name', async () => {
  const res = await send({
    name: null,
    files: [{ buf: png(), name: 'a.png' }]
  });

  expect(res.status).toBe(400);
});

// 8. Maximum file count validation
test('too many files is rejected', async () => {
  const files = Array.from(
    { length: 6 },
    (_, i) => ({
      buf: jpeg(),
      name: `${i}.jpg`
    })
  );

  const res = await send({ files });

  expect(res.status).toBe(400);
});

// 9. Returning visitor recognition
test('returning visitor with token is recognised, no new token issued', async () => {
  const first = await send({
    files: [{ buf: jpeg(), name: 'a.jpg' }]
  });

  const second = await send({
    name: null,
    token: first.body.token,
    files: [{ buf: webp(), name: 'b.webp' }]
  });

  expect(second.status).toBe(201);
  expect(second.body.returning).toBe(true);
  expect(second.body.token).toBeNull();

  expect(db.prepare('SELECT COUNT(*) c FROM visitors').get().c).toBe(1);
  expect(db.prepare('SELECT COUNT(*) c FROM photos').get().c).toBe(2);
});

// 10. Secure filename generation
test('saved filename ignores the client filename', async () => {
  const res = await send({
    files: [{
      buf: jpeg(),
      name: '../../etc/passwd.jpg'
    }]
  });

  expect(res.status).toBe(201);

  expect(res.body.photos[0].filename).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/
  );
});

// 11. Simultaneous uploads
test('10 simultaneous uploads all succeed with unique files', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      send({
        name: `Visitor ${i}`,
        files: [{ buf: jpeg(), name: `${i}.jpg` }]
      })
    )
  );

  expect(results.every((r) => r.status === 201)).toBe(true);

  expect(
    new Set(results.map((r) => r.body.photos[0].filename)).size
  ).toBe(10);

  expect(fs.readdirSync(dir)).toHaveLength(10);

  expect(db.prepare('SELECT COUNT(*) c FROM photos').get().c).toBe(10);
});

// 12. Unknown token with a name creates a new visitor
test('unknown token plus a name creates a new visitor instead of failing', async () => {
  const res = await send({
    token: 'a'.repeat(64),
    files: [{ buf: jpeg(), name: 'a.jpg' }]
  });

  expect(res.status).toBe(201);
  expect(res.body.returning).toBe(false);
  expect(res.body.token).toHaveLength(64);
});

// 13. Reject JPEG with valid header but invalid body
test('valid JPEG header with garbage body is rejected', async () => {
  const fake = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(100)
  ]);

  const res = await send({
    files: [{ buf: fake, name: 'fake.jpg' }]
  });

  expect(res.status).toBe(400);
  expect(fs.readdirSync(dir)).toHaveLength(0);
  expect(db.prepare('SELECT COUNT(*) c FROM visitors').get().c).toBe(0);
});

// 14. Strip EXIF metadata
test('EXIF metadata is stripped from the saved file', async () => {
  const input = await jpegWithExif();

  expect(input.includes('SECRET-LOCATION')).toBe(true);

  const res = await send({
    files: [{ buf: input, name: 'gps.jpg' }]
  });

  expect(res.status).toBe(201);

  const saved = fs.readFileSync(
    path.join(dir, res.body.photos[0].filename)
  );

  expect(saved.includes('SECRET-LOCATION')).toBe(false);

  const metadata = await sharp(saved).metadata();

  expect(metadata.exif).toBeUndefined();
});

// 15. Downscale large images
test('large images are downscaled', async () => {
  const big = await realJpeg(3000, 2000);

  const res = await send({
    files: [{ buf: big, name: 'big.jpg' }]
  });

  expect(res.status).toBe(201);

  const saved = fs.readFileSync(
    path.join(dir, res.body.photos[0].filename)
  );

  const meta = await sharp(saved).metadata();

  expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1920);
});
