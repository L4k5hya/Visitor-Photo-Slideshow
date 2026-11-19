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