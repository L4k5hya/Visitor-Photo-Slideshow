
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createApp } = require('../src/app');
const { openDb } = require('../src/db');

const { realJpeg, realPng, realWebp } = require('./helpers');

// Generate real image buffers
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

// Test database, application and event setup
let db, app, dir, events;

beforeEach(() => {
  db = openDb(':memory:');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));

  events = {
    handler: () => (req, res) => res.end(),
    broadcast: jest.fn()
  };

  app = createApp(
    db,
    {
      uploadDir: dir,
      slideDurationSeconds: 7
    },
    events
  );
});

afterEach(() => {
  if (db) db.close();

  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 1. Successful upload broadcasts new photos
test('successful upload broadcasts new photos to the display', async () => {
  const res = await request(app)
    .post('/api/upload')
    .field('name', 'Priya')
    .field('consent', 'true')
    .attach('photos', jpeg(), 'a.jpg');

  expect(res.status).toBe(201);

  expect(events.broadcast).toHaveBeenCalledTimes(1);

  const [event, data] = events.broadcast.mock.calls[0];

  expect(event).toBe('slideshow');
  expect(data.name).toBe('Priya');
  expect(data.newPhotos).toHaveLength(1);
  expect(data.previousPhotos).toHaveLength(0);
});

// 2. Returning visitor broadcast
test('returning visitor broadcast includes earlier photos but not the new ones', async () => {
  const first = await request(app)
    .post('/api/upload')
    .field('name', 'Priya')
    .field('consent', 'true')
    .attach('photos', jpeg(), 'a.jpg');

  expect(first.status).toBe(201);

  const second = await request(app)
    .post('/api/upload')
    .set('x-visitor-token', first.body.token)
    .field('consent', 'true')
    .attach('photos', jpeg(), 'b.jpg');

  expect(second.status).toBe(201);

  const data = events.broadcast.mock.calls[1][1];

  expect(data.returning).toBe(true);
  expect(data.newPhotos).toHaveLength(1);
  expect(data.previousPhotos).toHaveLength(1);

  expect(data.previousPhotos[0].id).not.toBe(
    data.newPhotos[0].id
  );
});

// 3. Rejected uploads should not broadcast
test('rejected upload broadcasts nothing', async () => {
  const res = await request(app)
    .post('/api/upload')
    .field('name', 'Priya')
    .attach('photos', jpeg(), 'a.jpg');

  expect(res.status).toBe(400);
  expect(events.broadcast).not.toHaveBeenCalled();
});

// 4. Configuration endpoint
test('config endpoint exposes the slide duration', async () => {
  const res = await request(app).get('/api/config');

  expect(res.status).toBe(200);
  expect(res.body.slideDurationSeconds).toBe(7);
});

// 5. Uploaded photos should be served securely
test('uploaded photo is served with nosniff and no directory listing', async () => {
  const up = await request(app)
    .post('/api/upload')
    .field('name', 'Priya')
    .field('consent', 'true')
    .attach('photos', jpeg(), 'a.jpg');

  expect(up.status).toBe(201);

  const photo = up.body.photos[0];

  const file = await request(app).get(
    photo.url ?? `/photos/${photo.filename}`
  );

  expect(file.status).toBe(200);

  expect(file.headers['x-content-type-options']).toBe('nosniff');

  const directory = await request(app).get('/photos/');

  expect(directory.status).toBe(404);
});
