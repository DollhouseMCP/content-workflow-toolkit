import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import apiRoutes from '../api/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test server setup
let server;
let baseUrl;

// Test data directory
const testSeriesDir = path.join(__dirname, '../../series');

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
}

// Helper for making requests
async function apiRequest(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  return { status: response.status, data };
}

describe('API Functional Tests', () => {
  before(async () => {
    await startServer();
  });

  after(async () => {
    await stopServer();
  });

  describe('GET /api/health', () => {
    test('returns success and ok status', async () => {
      const { status, data } = await apiRequest('/api/health');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'ok');
      assert.ok(data.timestamp, 'should have timestamp');
    });
  });

  describe('GET /api/series', () => {
    test('returns list of series folders', async () => {
      const { status, data } = await apiRequest('/api/series');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.series), 'series should be an array');
    });
  });

  describe('GET /api/episodes', () => {
    test('returns list of episodes', async () => {
      const { status, data } = await apiRequest('/api/episodes');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.episodes), 'episodes should be an array');
      assert.ok(typeof data.count === 'number', 'count should be a number');
    });
  });

  describe('GET /api/releases', () => {
    test('returns release queue data', async () => {
      const { status, data } = await apiRequest('/api/releases');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data, 'should have data field');
    });
  });

  describe('GET /api/distribution', () => {
    test('returns distribution profiles', async () => {
      const { status, data } = await apiRequest('/api/distribution');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data, 'should have data field');
      assert.ok(data.data.profiles, 'should have profiles');
    });
  });

  describe('GET /api/assets', () => {
    test('returns asset folder structure', async () => {
      const { status, data } = await apiRequest('/api/assets');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data, 'should have data field');
      assert.strictEqual(data.data.type, 'directory');
    });
  });

  describe('POST /api/episodes', () => {
    const testEpisodeSeries = 'test-series';
    let createdEpisodePath = null;

    after(async () => {
      // Clean up test episode if created
      if (createdEpisodePath) {
        try {
          await fs.rm(path.join(testSeriesDir, testEpisodeSeries), { recursive: true, force: true });
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });

    test('returns 400 when series is missing', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({ topic: 'test', title: 'Test' })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Series'), 'error should mention series');
    });

    test('returns 400 when topic is missing', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({ series: 'test', title: 'Test' })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Topic'), 'error should mention topic');
    });

    test('returns 400 when title is missing', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({ series: 'test', topic: 'test' })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Title'), 'error should mention title');
    });

    test('returns 400 for invalid date format', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({
          series: testEpisodeSeries,
          topic: 'test-date',
          title: 'Test Date',
          targetDate: 'invalid-date'
        })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('date'), 'error should mention date');
    });

    test('returns 400 for impossible date like Feb 30', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({
          series: testEpisodeSeries,
          topic: 'test-impossible-date',
          title: 'Test Impossible Date',
          targetDate: '2025-02-30'
        })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('date'), 'error should mention date');
    });

    test('returns 400 for title exceeding max length', async () => {
      const longTitle = 'a'.repeat(201);
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({
          series: testEpisodeSeries,
          topic: 'test-long',
          title: longTitle
        })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('200'), 'error should mention limit');
    });

    test('creates episode successfully with valid data', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({
          series: testEpisodeSeries,
          topic: 'functional-test',
          title: 'Functional Test Episode',
          description: 'Created by functional tests'
        })
      });

      assert.strictEqual(status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.episode, 'should return episode data');
      assert.strictEqual(data.episode.series, testEpisodeSeries);
      assert.strictEqual(data.episode.title, 'Functional Test Episode');

      createdEpisodePath = data.episode.path;

      // Verify files were created
      const episodeDir = path.join(testSeriesDir, testEpisodeSeries, data.episode.episode);
      const metadataExists = await fs.access(path.join(episodeDir, 'metadata.yml')).then(() => true).catch(() => false);
      const scriptExists = await fs.access(path.join(episodeDir, 'script.md')).then(() => true).catch(() => false);
      const notesExists = await fs.access(path.join(episodeDir, 'notes.md')).then(() => true).catch(() => false);

      assert.ok(metadataExists, 'metadata.yml should exist');
      assert.ok(scriptExists, 'script.md should exist');
      assert.ok(notesExists, 'notes.md should exist');
    });

    test('returns 409 when creating duplicate episode', async () => {
      // This relies on the previous test having created the episode
      if (!createdEpisodePath) {
        // Skip if previous test didn't create episode
        return;
      }

      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({
          series: testEpisodeSeries,
          topic: 'functional-test',  // Same topic, same day = same folder
          title: 'Duplicate Test'
        })
      });

      assert.strictEqual(status, 409);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('exists'), 'error should mention exists');
    });
  });

  describe('GET /api/episodes/:series/:episode', () => {
    test('returns 404 for non-existent episode', async () => {
      const { status, data } = await apiRequest('/api/episodes/nonexistent/nope');

      assert.strictEqual(status, 404);
      assert.strictEqual(data.success, false);
    });
  });
});
