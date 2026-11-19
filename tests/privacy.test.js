const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { openDb } = require('../src/db');
const { realJpeg } = require('./helpers');

let db, app, dir, events, jpegBuf;
beforeAll(async () => { jpegBuf = await realJpeg(); });
beforeEach(() => {
  db = openDb(':memory:');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  events = { handler: () => (req, res) => res.end(), broadcast: jest.fn() };
  app = createApp(db, { uploadDir: dir, adminPassword: 'test-admin-secret' }, events);
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function upload(name, token) {
  const r = request(app).post('/api/upload').field('consent', 'true')
    .attach('photos', jpegBuf, 'a.jpg');
  if (name) r.field('name', name);
  if (token) r.set('x-visitor-token', token);
  return r;
}
const count = (table) => db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;

test('owner can delete own photo: file removed, row marked, display told', async () => {
  const up = await upload('Priya');
  const { id, filename } = up.body.photos[0];
  const res = await request(app).delete(`/api/photos/${id}`).set('x-visitor-token', up.body.token);
  expect(res.status).toBe(204);
  expect(fs.existsSync(path.join(dir, filename))).toBe(false);
  expect(db.prepare('SELECT status FROM photos WHERE id = ?').get(id).status).toBe('removed');
  expect(events.broadcast).toHaveBeenLastCalledWith('remove', { ids: [id] });
});

test("a visitor cannot delete someone else's photo", async () => {
  const a = await upload('Priya');
  const b = await upload('Rahul');
  const { id, filename } = a.body.photos[0];
  const res = await request(app).delete(`/api/photos/${id}`).set('x-visitor-token', b.body.token);
  expect(res.status).toBe(404);
  expect(fs.existsSync(path.join(dir, filename))).toBe(true);
});

test('deleting without a token is unauthorised', async () => {
  const a = await upload('Priya');
  const res = await request(app).delete(`/api/photos/${a.body.photos[0].id}`);
  expect(res.status).toBe(401);
});

test('a deleted photo is not replayed on the next visit', async () => {
  const first = await upload('Priya');
  await request(app).delete(`/api/photos/${first.body.photos[0].id}`)
    .set('x-visitor-token', first.body.token);
  events.broadcast.mockClear();
  await upload(null, first.body.token);
  expect(events.broadcast.mock.calls[0][1].previousPhotos).toHaveLength(0);
});

test('delete-me removes all files, photos and the visitor record', async () => {
  const a = await upload('Priya');
  await upload(null, a.body.token);
  expect(fs.readdirSync(dir)).toHaveLength(2);
  const res = await request(app).delete('/api/me').set('x-visitor-token', a.body.token);
  expect(res.status).toBe(204);
  expect(fs.readdirSync(dir)).toHaveLength(0);
  expect(count('visitors')).toBe(0);
  expect(count('photos')).toBe(0);
});

test('admin is disabled when no password is configured', async () => {
  const locked = createApp(db, { uploadDir: dir, adminPassword: undefined }, events);
  const res = await request(locked).get('/api/admin/photos').set('x-admin-password', 'anything');
  expect(res.status).toBe(503);
});

test('admin rejects a wrong password', async () => {
  const res = await request(app).get('/api/admin/photos').set('x-admin-password', 'nope');
  expect(res.status).toBe(401);
});

test('admin can list and remove any photo', async () => {
  const a = await upload('Priya');
  const { id, filename } = a.body.photos[0];
  const list = await request(app).get('/api/admin/photos').set('x-admin-password', 'test-admin-secret');
  expect(list.body).toHaveLength(1);
  const res = await request(app).delete(`/api/admin/photos/${id}`).set('x-admin-password', 'test-admin-secret');
  expect(res.status).toBe(204);
  expect(fs.existsSync(path.join(dir, filename))).toBe(false);
  expect(events.broadcast).toHaveBeenLastCalledWith('remove', { ids: [id] });
});