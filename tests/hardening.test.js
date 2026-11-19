const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { openDb } = require('../src/db');
const { realJpeg } = require('./helpers');
const { EventHub } = require('../src/events');

let db, dir, events, jpegBuf;
beforeAll(async () => { jpegBuf = await realJpeg(); });
beforeEach(() => {
  db = openDb(':memory:');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  events = { handler: () => (req, res) => res.end(), broadcast: jest.fn() };
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const make = (cfg = {}) =>
  createApp(db, { uploadDir: dir, adminPassword: 'test-admin-secret', ...cfg }, events);

test('security headers are set and X-Powered-By is hidden', async () => {
  const res = await request(make()).get('/health');
  expect(res.headers['x-powered-by']).toBeUndefined();
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
});

test('pages contain no inline script, which the CSP would block', async () => {
  for (const page of ['/', '/display.html']) {
    const html = (await request(make()).get(page)).text;
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  }
});

const upload = (app) =>
  request(app).post('/api/upload').field('name', 'Priya').field('consent', 'true')
    .attach('photos', jpegBuf, 'a.jpg');

test('uploads beyond the rate limit get 429 with a JSON error', async () => {
  const app = make({ uploadRateLimit: 2 });
  expect((await upload(app)).status).toBe(201);
  expect((await upload(app)).status).toBe(201);
  const third = await upload(app);
  expect(third.status).toBe(429);
  expect(third.body.error).toMatch(/too many/i);
});

test('repeated wrong admin passwords are blocked, even if the next one is right', async () => {
  const app = make({ adminFailLimit: 3 });
  for (let i = 0; i < 3; i++) {
    const r = await request(app).get('/api/admin/photos').set('x-admin-password', 'wrong');
    expect(r.status).toBe(401);
  }
  const res = await request(app).get('/api/admin/photos').set('x-admin-password', 'test-admin-secret');
  expect(res.status).toBe(429);
});

test('successful admin requests do not count toward the limit', async () => {
  const app = make({ adminFailLimit: 2 });
  for (let i = 0; i < 5; i++) {
    const r = await request(app).get('/api/admin/photos').set('x-admin-password', 'test-admin-secret');
    expect(r.status).toBe(200);
  }
});

test('event hub refuses clients beyond its cap', () => {
  const hub = new EventHub(1);
  const handler = hub.handler();
  const fakeRes = () => ({
    set() {}, flushHeaders() {}, write() {},
    status: jest.fn().mockReturnThis(), end: jest.fn(),
  });
  handler({ on: jest.fn() }, fakeRes());          // first client is accepted
  const second = fakeRes();
  handler({ on: jest.fn() }, second);             // second is refused
  expect(second.status).toHaveBeenCalledWith(503);
});