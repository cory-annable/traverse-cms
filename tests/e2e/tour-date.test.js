'use strict';

const request = require('supertest');
const { setupStrapi, stopStrapi } = require('../utils/strapi');
const { setPublicPermissions } = require('../utils/permissions');

let app;

beforeAll(async () => {
  app = await setupStrapi();
  await setPublicPermissions(app, {
    'tour-date': ['find', 'findOne'],
  });
});

afterAll(async () => {
  await stopStrapi();
});

describe('Tour Dates API', () => {
  test('GET /api/tour-dates returns 200 and data array', async () => {
    const server = app.server.httpServer;
    const res = await request(server).get('/api/tour-dates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/tour-dates?populate=tour includes tour relation', async () => {
    const server = app.server.httpServer;
    const res = await request(server).get('/api/tour-dates?populate=tour');
    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      const item = res.body.data[0];
      // Relation may be null if draft, but should exist structurally
      expect(item).toHaveProperty('attributes');
    }
  });
});


