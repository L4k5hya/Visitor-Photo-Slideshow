const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { openDb } = require('../src/db');

const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
const webp = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)]);

let db, app, dir;
beforeEach(() => {
  db = openDb(':memory:');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  app = createApp(db, { uploadDir: dir, maxFileSizeMb: 1, maxFiles: 5 });
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function send({ name = 'Priya', consent = 'true', token, files = [] }) {
  const r = request(app).post('/api/upload');
  if (token) r.set('x-visitor-token', token);
  if (name) r.field('name', name);
  if (consent) r.field('consent', consent);
  files.forEach((f) => r.attach('photos', f.buf, f.name));
  return r;
}

test('valid upload with consent creates visitor, token and file on disk', async () => {
  const res = await send({ files: [{ buf: jpeg(), name: 'me.jpg' }] });
  expect(res.status).toBe(201);
  expect(res.body.returning).toBe(false);
  expect(res.body.token).toHaveLength(64);
  expect(fs.readdirSync(dir)).toHaveLength(1);
});

test('upload without consent is rejected and nothing is stored', async () => {
  const res = await send({ consent: null, files: [{ buf: jpeg(), name: 'me.jpg' }] });
  expect(res.status).toBe(400);
  expect(fs.readdirSync(dir)).toHaveLength(0);
  expect(db.prepare('SELECT COUNT(*) c FROM visitors').get().c).toBe(0);
});

test('text file renamed to .jpg is rejected', async () => {
  const res = await send({ files: [{ buf: Buffer.from('hello this is not an image'), name: 'fake.jpg' }] });
  expect(res.status).toBe(400);
  expect(fs.readdirSync(dir)).toHaveLength(0);
});

test('executable renamed to .png is rejected', async () => {
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
  const res = await send({ files: [{ buf: exe, name: 'evil.png' }] });
  expect(res.status).toBe(400);
});

test('file over the size limit gets 413', async () => {
  const big = Buffer.concat([jpeg(), Buffer.alloc(1024 * 1024 + 10)]);
  const res = await send({ files: [{ buf: big, name: 'big.jpg' }] });
  expect(res.status).toBe(413);
  expect(fs.readdirSync(dir)).toHaveLength(0);
});

test('one bad file rejects the whole batch', async () => {
  const res = await send({
    files: [
      { buf: jpeg(), name: 'ok.jpg' },
      { buf: Buffer.from('not an image at all'), name: 'bad.jpg' },
    ],
  });
  expect(res.status).toBe(400);
  expect(fs.readdirSync(dir)).toHaveLength(0);
  expect(db.prepare('SELECT COUNT(*) c FROM visitors').get().c).toBe(0);
});

test('new visitor must provide a name', async () => {
  const res = await send({ name: null, files: [{ buf: png(), name: 'a.png' }] });
  expect(res.status).toBe(400);
});

test('too many files is rejected', async () => {
  const files = Array.from({ length: 6 }, (_, i) => ({ buf: jpeg(), name: `${i}.jpg` }));
  const res = await send({ files });
  expect(res.status).toBe(400);
});

test('returning visitor with token is recognised, no new token issued', async () => {
  const first = await send({ files: [{ buf: jpeg(), name: 'a.jpg' }] });
  const second = await send({ name: null, token: first.body.token, files: [{ buf: webp(), name: 'b.webp' }] });
  expect(second.status).toBe(201);
  expect(second.body.returning).toBe(true);
  expect(second.body.token).toBeNull();
  expect(db.prepare('SELECT COUNT(*) c FROM visitors').get().c).toBe(1);
  expect(db.prepare('SELECT COUNT(*) c FROM photos').get().c).toBe(2);
});

test('saved filename ignores the client filename', async () => {
  const res = await send({ files: [{ buf: jpeg(), name: '../../etc/passwd.jpg' }] });
  expect(res.body.photos[0].filename).toMatch(/^[0-9a-f-]{36}\.jpg$/);
});

test('10 simultaneous uploads all succeed with unique files', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      send({ name: `Visitor ${i}`, files: [{ buf: jpeg(), name: `${i}.jpg` }] })
    )
  );
  expect(results.every((r) => r.status === 201)).toBe(true);
  expect(new Set(results.map((r) => r.body.photos[0].filename)).size).toBe(10);
  expect(fs.readdirSync(dir)).toHaveLength(10);
  expect(db.prepare('SELECT COUNT(*) c FROM photos').get().c).toBe(10);
});