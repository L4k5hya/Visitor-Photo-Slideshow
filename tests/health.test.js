const request = require('supertest');
const { createApp } = require('../src/app');
const { openDb } = require('../src/db');

test('GET /health returns ok', async () => {
  const app = createApp(openDb(':memory:'), { uploadDir: require('os').tmpdir() });
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});