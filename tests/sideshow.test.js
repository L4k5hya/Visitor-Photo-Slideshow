const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { openDb } = require('../src/db');

const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);

let db, app, dir, events;
beforeEach(() => {
  db = openDb(':memory:');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  events = { handler: () => (req, res) => res.end(), broadcast: jest.fn() };
  app = createApp(db, { uploadDir: dir, slideDurationSeconds: 7 }, events);
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('successful upload broadcasts new photos to the display', async () => {
  const res = await request(app).post('/api/upload')
    .field('name', 'Priya').field('consent', 'true')
    .attach('photos', jpeg(), 'a.jpg');
  expect(res.status).toBe(201);
  expect(events.broadcast).toHaveBeenCalledTimes(1);
  const [event, data] = events.broadcast.mock.calls[0];
  expect(event).toBe('slideshow');
  expect(data.name).toBe('Priya');
  expect(data.newPhotos).toHaveLength(1);
  expect(data.previousPhotos).toHaveLength(0);
});

test('returning visitor broadcast includes earlier photos but not the new ones', async () => {
  const first = await request(app).post('/api/upload')
    .field('name', 'Priya').field('consent', 'true')
    .attach('photos', jpeg(), 'a.jpg');
  await request(app).post('/api/upload')
    .set('x-visitor-token', first.body.token).field('consent', 'true')
    .attach('photos', jpeg(), 'b.jpg');
  const data = events.broadcast.mock.calls[1][1];
  expect(data.returning).toBe(true);
  expect(data.newPhotos).toHaveLength(1);
  expect(data.previousPhotos).toHaveLength(1);
  expect(data.previousPhotos[0].id).not.toBe(data.newPhotos[0].id);
});

test('rejected upload broadcasts nothing', async () => {
  await request(app).post('/api/upload')
    .field('name', 'Priya')            // no consent
    .attach('photos', jpeg(), 'a.jpg');
  expect(events.broadcast).not.toHaveBeenCalled();
});

test('config endpoint exposes the slide duration', async () => {
  const res = await request(app).get('/api/config');
  expect(res.body.slideDurationSeconds).toBe(7);
});

test('uploaded photo is served with nosniff and no directory listing', async () => {
  const up = await request(app).post('/api/upload')
    .field('name', 'Priya').field('consent', 'true')
    .attach('photos', jpeg(), 'a.jpg');
  const file = await request(app).get(up.body.photos[0].url ?? `/photos/${up.body.photos[0].filename}`);
  expect(file.status).toBe(200);
  expect(file.headers['x-content-type-options']).toBe('nosniff');
  expect((await request(app).get('/photos/')).status).toBe(404);
});