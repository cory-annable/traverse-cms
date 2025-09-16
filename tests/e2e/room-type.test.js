'use strict';

const request = require('supertest');
const { setupStrapi, stopStrapi } = require('../utils/strapi');
const { setPublicPermissions } = require('../utils/permissions');

let app;

beforeAll(async () => {
  app = await setupStrapi();
  await setPublicPermissions(app, {
    'room-type': ['find', 'findOne'],
  });
});

afterAll(async () => {
  await stopStrapi();
});

describe('Room Types API', () => {
  test('GET /api/room-types returns 200 and data array', async () => {
    const server = app.server.httpServer;
    const res = await request(server).get('/api/room-types');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/room-types?populate=tour includes tour relation', async () => {
    const server = app.server.httpServer;
    const res = await request(server).get('/api/room-types?populate=tour');
    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      const item = res.body.data[0];
      expect(item).toHaveProperty('attributes');
    }
  });
});


