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

    test('episodes contain metadata structure for calendar', async () => {
      const { status, data } = await apiRequest('/api/episodes');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);

      // Check that episodes have the structure calendar needs
      if (data.episodes.length > 0) {
        for (const episode of data.episodes) {
          // Each episode should have path, series, and episode identifiers
          assert.ok(episode.path, 'episode should have path');
          assert.ok(episode.series, 'episode should have series');
          assert.ok(episode.episode, 'episode should have episode name');

          // metadata should exist
          assert.ok(episode.metadata, 'episode should have metadata');

          // If release info exists, validate structure used by calendar
          if (episode.metadata.release) {
            const release = episode.metadata.release;

            // target_date should be string if present (YYYY-MM-DD format)
            if (release.target_date !== undefined && release.target_date !== null && release.target_date !== '') {
              assert.ok(typeof release.target_date === 'string', 'target_date should be string');
            }

            // release_group should be string if present
            if (release.release_group !== undefined && release.release_group !== null && release.release_group !== '') {
              assert.ok(typeof release.release_group === 'string', 'release_group should be string');
            }
          }

          // If analytics info exists, validate publish_date used by calendar
          if (episode.metadata.analytics) {
            const analytics = episode.metadata.analytics;

            // publish_date is used to show released episodes on calendar
            if (analytics.publish_date !== undefined && analytics.publish_date !== null && analytics.publish_date !== '') {
              assert.ok(typeof analytics.publish_date === 'string', 'publish_date should be string');
            }
          }
        }
      }
    });

    test('episode date format is consistent for calendar parsing', async () => {
      const { status, data } = await apiRequest('/api/episodes');

      assert.strictEqual(status, 200);

      // The calendar parseDate function expects dates in ISO format or YYYY-MM-DD
      // Validate any dates in episodes match expected formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T[\d:.-]+)?$/;

      for (const episode of data.episodes) {
        if (episode.metadata?.release?.target_date) {
          const targetDate = episode.metadata.release.target_date;
          if (targetDate) {
            assert.ok(
              dateRegex.test(targetDate),
              `target_date "${targetDate}" should match YYYY-MM-DD or ISO format`
            );
          }
        }

        if (episode.metadata?.analytics?.publish_date) {
          const publishDate = episode.metadata.analytics.publish_date;
          if (publishDate) {
            assert.ok(
              dateRegex.test(publishDate),
              `publish_date "${publishDate}" should match YYYY-MM-DD or ISO format`
            );
          }
        }
      }
    });
  });

  describe('GET /api/releases', () => {
    test('returns release queue data', async () => {
      const { status, data } = await apiRequest('/api/releases');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data, 'should have data field');
    });

    test('release queue contains expected sections for calendar', async () => {
      const { status, data } = await apiRequest('/api/releases');

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);

      // Calendar view expects these sections to exist (may be empty arrays/objects)
      // The release queue YAML structure includes: release_groups, staged, blocked, released
      const releaseQueue = data.data;

      // release_groups should be an object (can be empty or contain release groups)
      if (releaseQueue.release_groups !== undefined) {
        assert.strictEqual(typeof releaseQueue.release_groups, 'object', 'release_groups should be an object');
      }

      // staged should be an array if present
      if (releaseQueue.staged !== undefined) {
        assert.ok(Array.isArray(releaseQueue.staged), 'staged should be an array');
      }

      // blocked should be an array if present
      if (releaseQueue.blocked !== undefined) {
        assert.ok(Array.isArray(releaseQueue.blocked), 'blocked should be an array');
      }

      // released should be an array if present
      if (releaseQueue.released !== undefined) {
        assert.ok(Array.isArray(releaseQueue.released), 'released should be an array');
      }
    });

    test('release groups have required fields for calendar display', async () => {
      const { status, data } = await apiRequest('/api/releases');

      assert.strictEqual(status, 200);
      const releaseQueue = data.data;

      if (releaseQueue.release_groups) {
        for (const [groupId, group] of Object.entries(releaseQueue.release_groups)) {
          // Each release group should have name and status for calendar display
          assert.ok(group.name, `release group ${groupId} should have name`);
          assert.ok(group.status, `release group ${groupId} should have status`);

          // target_date is used by calendar for scheduling
          // Can be undefined but if present should be a valid date string
          if (group.target_date) {
            assert.ok(typeof group.target_date === 'string', `release group ${groupId} target_date should be string`);
          }

          // items array contains content to be released
          if (group.items) {
            assert.ok(Array.isArray(group.items), `release group ${groupId} items should be array`);
          }
        }
      }
    });

    test('staged items have required fields for calendar display', async () => {
      const { status, data } = await apiRequest('/api/releases');

      assert.strictEqual(status, 200);
      const releaseQueue = data.data;

      if (releaseQueue.staged && releaseQueue.staged.length > 0) {
        for (const item of releaseQueue.staged) {
          // path is required to identify the content
          assert.ok(item.path, 'staged item should have path');

          // status helps calendar categorize items
          if (item.status) {
            assert.ok(typeof item.status === 'string', 'staged item status should be string');
          }

          // target_date is used for calendar positioning
          if (item.target_date) {
            assert.ok(typeof item.target_date === 'string', 'staged item target_date should be string');
          }
        }
      }
    });

    test('blocked items have required fields', async () => {
      const { status, data } = await apiRequest('/api/releases');

      assert.strictEqual(status, 200);
      const releaseQueue = data.data;

      if (releaseQueue.blocked && releaseQueue.blocked.length > 0) {
        for (const item of releaseQueue.blocked) {
          // path identifies the blocked content
          assert.ok(item.path, 'blocked item should have path');

          // blocked_by explains why content is blocked
          if (item.blocked_by) {
            assert.ok(typeof item.blocked_by === 'string', 'blocked_by should be string');
          }
        }
      }
    });

    test('released items have release_date for calendar history', async () => {
      const { status, data } = await apiRequest('/api/releases');

      assert.strictEqual(status, 200);
      const releaseQueue = data.data;

      if (releaseQueue.released && releaseQueue.released.length > 0) {
        for (const item of releaseQueue.released) {
          // path identifies the released content
          assert.ok(item.path, 'released item should have path');

          // release_date is essential for showing when content was released
          if (item.release_date) {
            assert.ok(typeof item.release_date === 'string', 'release_date should be string');
          }
        }
      }
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

    test('returns 400 when request body is an array', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify([{ series: 'test' }])
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Invalid request body'), 'error should mention invalid request body');
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

  describe('PATCH /api/episodes/:series/:episode', () => {
    const patchTestSeries = 'patch-test-series';
    let patchTestEpisode = null;

    // Create a test episode before running PATCH tests
    before(async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({
          series: patchTestSeries,
          topic: 'patch-test',
          title: 'PATCH Test Episode',
          description: 'Episode for testing PATCH endpoint'
        })
      });

      if (status === 201 && data.episode) {
        patchTestEpisode = data.episode.episode;
      }
    });

    after(async () => {
      // Clean up test series
      try {
        await fs.rm(path.join(testSeriesDir, patchTestSeries), { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    test('returns 404 for non-existent episode', async () => {
      const { status, data } = await apiRequest('/api/episodes/nonexistent/nope', {
        method: 'PATCH',
        body: JSON.stringify({ content_status: 'ready' })
      });

      assert.strictEqual(status, 404);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('not found'), 'error should mention not found');
    });

    test('returns 400 for path traversal in series param', async () => {
      // Use encoded dots to prevent URL normalization
      const { status, data } = await apiRequest('/api/episodes/..%2Fetc/nope', {
        method: 'PATCH',
        body: JSON.stringify({ content_status: 'ready' })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
    });

    test('returns 400 for path traversal in episode param', async () => {
      const { status, data } = await apiRequest('/api/episodes/test-series/..%2F..%2Fetc', {
        method: 'PATCH',
        body: JSON.stringify({ content_status: 'ready' })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
    });

    test('returns 400 for invalid content_status', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(`/api/episodes/${patchTestSeries}/${patchTestEpisode}`, {
        method: 'PATCH',
        body: JSON.stringify({ content_status: 'invalid_status' })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.errors.some(e => e.includes('Content status')), 'should have content_status error');
    });

    test('returns 400 for title exceeding max length', async () => {
      if (!patchTestEpisode) return;

      const longTitle = 'a'.repeat(201);
      const { status, data } = await apiRequest(`/api/episodes/${patchTestSeries}/${patchTestEpisode}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: longTitle })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.errors.some(e => e.includes('200')), 'should mention 200 char limit');
    });

    test('returns 400 for no valid fields to update', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(`/api/episodes/${patchTestSeries}/${patchTestEpisode}`, {
        method: 'PATCH',
        body: JSON.stringify({ unknown_field: 'value' })
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      // Should have some error indication
      assert.ok(data.error || data.errors, 'should have error response');
    });

    test('updates content_status successfully', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(`/api/episodes/${patchTestSeries}/${patchTestEpisode}`, {
        method: 'PATCH',
        body: JSON.stringify({ content_status: 'ready' })
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.metadata, 'should return updated metadata');
      assert.strictEqual(data.metadata.content_status, 'ready');
    });

    test('updates title successfully', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(`/api/episodes/${patchTestSeries}/${patchTestEpisode}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Title' })
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.metadata.title, 'Updated Title');
    });

    test('updates workflow fields successfully', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(`/api/episodes/${patchTestSeries}/${patchTestEpisode}`, {
        method: 'PATCH',
        body: JSON.stringify({
          workflow: {
            scripted: true,
            recorded: true
          }
        })
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.metadata.workflow.scripted, true);
      assert.strictEqual(data.metadata.workflow.recorded, true);
    });

    test('sanitizes control characters from title', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(`/api/episodes/${patchTestSeries}/${patchTestEpisode}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Title\x00With\x1FControl\x7FChars' })
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(!data.metadata.title.includes('\x00'), 'should not contain null character');
      assert.ok(!data.metadata.title.includes('\x1F'), 'should not contain control character');
    });

    test('returns 400 when request body is an array', async () => {
      const response = await fetch(`${baseUrl}/api/episodes/test-series/test-episode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ content_status: 'ready' }])
      });
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Invalid request body'), 'error should mention invalid request body');
    });
  });

  describe('Security Tests', () => {
    describe('Path Traversal Prevention', () => {
      test('rejects series name with ../', async () => {
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: '../etc',
            topic: 'test',
            title: 'Test'
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects series name with ..\\', async () => {
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: '..\\etc',
            topic: 'test',
            title: 'Test'
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('sanitizes topic with path traversal via slugify', async () => {
        // Path traversal chars are stripped by slugify, making it safe
        // ../../../etc/passwd becomes etcpasswd
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: 'path-traversal-test',
            topic: '../../../etc/passwd',
            title: 'Test'
          })
        });

        // Should succeed because slugify strips dangerous chars
        if (status === 201) {
          assert.strictEqual(data.success, true);
          // The slug should not contain any path traversal characters
          assert.ok(!data.episode.episode.includes('..'), 'slug should not contain ..');
          assert.ok(!data.episode.episode.includes('/'), 'slug should not contain /');

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'path-traversal-test'), { recursive: true, force: true });
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      });

      test('rejects series with absolute path', async () => {
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: '/etc/passwd',
            topic: 'test',
            title: 'Test'
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects series with encoded path traversal', async () => {
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: '..%2F..%2Fetc',
            topic: 'test',
            title: 'Test'
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });
    });

    describe('XSS Prevention', () => {
      test('strips HTML tags from title', async () => {
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: 'xss-test-series',
            topic: 'xss-test',
            title: '<script>alert("xss")</script>Clean Title'
          })
        });

        // Should succeed but with sanitized title
        if (status === 201) {
          assert.strictEqual(data.success, true);
          assert.ok(!data.episode.title.includes('<script>'), 'title should not contain script tags');
          assert.ok(data.episode.title.includes('Clean Title'), 'title should contain clean text');

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-test-series'), { recursive: true, force: true });
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      });

      test('strips HTML tags from description', async () => {
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: 'xss-test-series-2',
            topic: 'xss-desc-test',
            title: 'Normal Title',
            description: '<img src=x onerror=alert("xss")>Safe description'
          })
        });

        if (status === 201) {
          assert.strictEqual(data.success, true);
          assert.ok(!data.episode.description.includes('<img'), 'description should not contain img tags');
          assert.ok(data.episode.description.includes('Safe description'), 'description should contain clean text');

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-test-series-2'), { recursive: true, force: true });
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      });

      test('rejects title that becomes empty after HTML stripping', async () => {
        // Only tags, no text content - should become empty after stripping
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: 'test-series',
            topic: 'empty-title-test',
            title: '<script></script><div></div>'
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
        assert.ok(data.error.includes('empty'), 'error should mention empty');
      });

      test('preserves text content when stripping HTML tags', async () => {
        // Text inside tags should be preserved
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: 'xss-preserve-test',
            topic: 'preserve-text',
            title: '<script>alert("xss")</script>'
          })
        });

        if (status === 201) {
          // The text content is preserved, just tags stripped
          assert.strictEqual(data.episode.title, 'alert("xss")');

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-preserve-test'), { recursive: true, force: true });
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      });

      test('handles nested HTML tags in title', async () => {
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: 'xss-test-series-3',
            topic: 'nested-tags',
            title: '<div><script>evil()</script><b>Bold</b></div>Text'
          })
        });

        if (status === 201) {
          assert.ok(!data.episode.title.includes('<'), 'title should not contain any HTML');

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-test-series-3'), { recursive: true, force: true });
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      });
    });
  });

  describe('Asset Management Tests', () => {
    const testAssetsDir = path.join(__dirname, '../../assets');
    const testFolderName = 'api-test-folder';
    const testSubFolder = 'api-test-subfolder';

    after(async () => {
      // Clean up test folders
      try {
        await fs.rm(path.join(testAssetsDir, testFolderName), { recursive: true, force: true });
        await fs.rm(path.join(testAssetsDir, testSubFolder), { recursive: true, force: true });
        await fs.rm(path.join(testAssetsDir, 'renamed-folder'), { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    describe('POST /api/assets/folder', () => {
      test('creates folder successfully', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: testFolderName })
        });

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.folder, 'should return folder data');
        assert.strictEqual(data.folder.name, testFolderName);
      });

      test('returns 400 for duplicate folder', async () => {
        // Try to create the same folder again
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: testFolderName })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
        assert.ok(data.error.includes('exists'), 'error should mention exists');
      });

      test('returns 400 for empty folder name', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: '' })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('sanitizes folder name with special characters', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: 'test<script>alert(1)</script>folder' })
        });

        if (status === 200) {
          assert.ok(!data.folder.name.includes('<'), 'folder name should not contain special chars');
          // Clean up
          await fs.rm(path.join(testAssetsDir, data.folder.name), { recursive: true, force: true }).catch(() => {});
        }
      });

      test('rejects path traversal in folder name', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: '../../../etc' })
        });

        // Should either be rejected or sanitized to safe name
        if (status === 200) {
          assert.ok(!data.folder.name.includes('..'), 'folder name should not contain ..');
          await fs.rm(path.join(testAssetsDir, data.folder.name), { recursive: true, force: true }).catch(() => {});
        } else {
          assert.strictEqual(status, 400);
        }
      });

      test('rejects path traversal in parent path', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({
            path: '../../../etc',
            name: 'evil'
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('returns 400 when request body is an array', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify([{ name: 'test-folder' }])
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
        assert.ok(data.error.includes('Invalid request body'), 'error should mention invalid request body');
      });
    });

    describe('DELETE /api/assets/*', () => {
      before(async () => {
        // Create a folder to delete
        await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: testSubFolder })
        });
      });

      test('deletes folder successfully', async () => {
        const { status, data } = await apiRequest(`/api/assets/${testSubFolder}`, {
          method: 'DELETE'
        });

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
      });

      test('returns 404 for non-existent path', async () => {
        const { status, data } = await apiRequest('/api/assets/nonexistent-folder-12345', {
          method: 'DELETE'
        });

        assert.strictEqual(status, 404);
        assert.strictEqual(data.success, false);
      });

      test('returns 400 for missing path', async () => {
        const { status, data } = await apiRequest('/api/assets/', {
          method: 'DELETE'
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects path traversal attempt', async () => {
        const { status, data } = await apiRequest('/api/assets/..%2F..%2Fetc', {
          method: 'DELETE'
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('prevents deleting assets root', async () => {
        const { status, data } = await apiRequest('/api/assets/.', {
          method: 'DELETE'
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });
    });

    describe('PATCH /api/assets/* (rename)', () => {
      before(async () => {
        // Create a folder to rename
        await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: 'rename-test-folder' })
        });
      });

      after(async () => {
        // Clean up
        await fs.rm(path.join(testAssetsDir, 'rename-test-folder'), { recursive: true, force: true }).catch(() => {});
        await fs.rm(path.join(testAssetsDir, 'renamed-folder'), { recursive: true, force: true }).catch(() => {});
      });

      test('renames folder successfully', async () => {
        const { status, data } = await apiRequest('/api/assets/rename-test-folder', {
          method: 'PATCH',
          body: JSON.stringify({ newPath: 'renamed-folder' })
        });

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.newPath, 'should return new path');
      });

      test('returns 404 for non-existent source', async () => {
        const { status, data } = await apiRequest('/api/assets/nonexistent-folder-xyz', {
          method: 'PATCH',
          body: JSON.stringify({ newPath: 'new-name' })
        });

        assert.strictEqual(status, 404);
        assert.strictEqual(data.success, false);
      });

      test('returns 400 for missing newPath', async () => {
        const { status, data } = await apiRequest('/api/assets/renamed-folder', {
          method: 'PATCH',
          body: JSON.stringify({})
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects path traversal in current path', async () => {
        const { status, data } = await apiRequest('/api/assets/..%2F..%2Fetc', {
          method: 'PATCH',
          body: JSON.stringify({ newPath: 'new-name' })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects path traversal in new path', async () => {
        const { status, data } = await apiRequest('/api/assets/renamed-folder', {
          method: 'PATCH',
          body: JSON.stringify({ newPath: '../../../etc/evil' })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('sanitizes filename with special characters', async () => {
        // Create a test folder first
        await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: 'sanitize-test-folder' })
        });

        const { status, data } = await apiRequest('/api/assets/sanitize-test-folder', {
          method: 'PATCH',
          body: JSON.stringify({ newPath: 'test<script>name' })
        });

        if (status === 200) {
          assert.ok(!data.newPath.includes('<'), 'new path should not contain special chars');
          await fs.rm(path.join(testAssetsDir, data.newPath), { recursive: true, force: true }).catch(() => {});
        }
        // Clean up original if rename failed
        await fs.rm(path.join(testAssetsDir, 'sanitize-test-folder'), { recursive: true, force: true }).catch(() => {});
      });

      test('returns 400 when request body is an array', async () => {
        const { status, data } = await apiRequest('/api/assets/some-folder', {
          method: 'PATCH',
          body: JSON.stringify([{ newPath: 'test' }])
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
        assert.ok(data.error.includes('Invalid request body'), 'error should mention invalid request body');
      });
    });
  });

  describe('Calendar Feature Tests', () => {
    const calendarTestSeries = 'calendar-test-series';
    let calendarTestEpisode = null;

    after(async () => {
      // Clean up calendar test series
      try {
        await fs.rm(path.join(testSeriesDir, calendarTestSeries), { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    describe('Episode creation with target date', () => {
      test('creates episode with valid target date for calendar', async () => {
        const futureDate = '2025-06-15';
        const { status, data } = await apiRequest('/api/episodes', {
          method: 'POST',
          body: JSON.stringify({
            series: calendarTestSeries,
            topic: 'calendar-target-date',
            title: 'Calendar Target Date Test',
            description: 'Episode with target date for calendar display',
            targetDate: futureDate
          })
        });

        assert.strictEqual(status, 201);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.episode.targetDate, futureDate);

        calendarTestEpisode = data.episode.episode;
      });

      test('created episode appears in episodes list with target date', async () => {
        if (!calendarTestEpisode) return;

        const { status, data } = await apiRequest('/api/episodes');

        assert.strictEqual(status, 200);

        // Find the created episode
        const createdEpisode = data.episodes.find(
          ep => ep.series === calendarTestSeries && ep.episode === calendarTestEpisode
        );

        assert.ok(createdEpisode, 'created episode should appear in list');
        assert.ok(createdEpisode.metadata.release, 'episode should have release metadata');
        assert.strictEqual(createdEpisode.metadata.release.target_date, '2025-06-15');
      });
    });

    describe('Updating release dates via PATCH', () => {
      test('updates target_date for calendar scheduling', async () => {
        if (!calendarTestEpisode) return;

        const newDate = '2025-07-20';
        const { status, data } = await apiRequest(`/api/episodes/${calendarTestSeries}/${calendarTestEpisode}`, {
          method: 'PATCH',
          body: JSON.stringify({
            release: {
              target_date: newDate
            }
          })
        });

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.metadata.release.target_date, newDate);
      });

      test('clears target_date when set to empty string', async () => {
        if (!calendarTestEpisode) return;

        const { status, data } = await apiRequest(`/api/episodes/${calendarTestSeries}/${calendarTestEpisode}`, {
          method: 'PATCH',
          body: JSON.stringify({
            release: {
              target_date: ''
            }
          })
        });

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.metadata.release.target_date, '');
      });

      test('sets release_group for calendar grouping', async () => {
        if (!calendarTestEpisode) return;

        const { status, data } = await apiRequest(`/api/episodes/${calendarTestSeries}/${calendarTestEpisode}`, {
          method: 'PATCH',
          body: JSON.stringify({
            release: {
              target_date: '2025-08-01',
              release_group: 'calendar-test-group'
            }
          })
        });

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.metadata.release.release_group, 'calendar-test-group');
      });

      test('rejects invalid date format for target_date', async () => {
        if (!calendarTestEpisode) return;

        const { status, data } = await apiRequest(`/api/episodes/${calendarTestSeries}/${calendarTestEpisode}`, {
          method: 'PATCH',
          body: JSON.stringify({
            release: {
              target_date: 'not-a-date'
            }
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
        assert.ok(data.errors.some(e => e.includes('date')), 'should have date format error');
      });

      test('rejects impossible date in target_date', async () => {
        if (!calendarTestEpisode) return;

        const { status, data } = await apiRequest(`/api/episodes/${calendarTestSeries}/${calendarTestEpisode}`, {
          method: 'PATCH',
          body: JSON.stringify({
            release: {
              target_date: '2025-02-30'  // February 30 doesn't exist
            }
          })
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });
    });

    describe('Distribution profiles for calendar', () => {
      test('distribution endpoint returns profiles for calendar release options', async () => {
        const { status, data } = await apiRequest('/api/distribution');

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.data, 'should have data field');

        // Calendar uses distribution profiles for release planning
        if (data.data.profiles) {
          assert.strictEqual(typeof data.data.profiles, 'object', 'profiles should be an object');

          // Each profile should have description and platforms for calendar display
          for (const [profileId, profile] of Object.entries(data.data.profiles)) {
            // Profiles use 'description' field (not 'name')
            assert.ok(profile.description, `profile ${profileId} should have description`);
            if (profile.platforms) {
              assert.ok(Array.isArray(profile.platforms), `profile ${profileId} platforms should be array`);
            }
          }
        }
      });
    });

    describe('Combined calendar data consistency', () => {
      test('release queue dates match expected ISO or YYYY-MM-DD format', async () => {
        const { status, data } = await apiRequest('/api/releases');

        assert.strictEqual(status, 200);

        const releaseQueue = data.data;
        // Date formats: YYYY-MM-DD or ISO 8601 (js-yaml converts datetime to ISO format like 2025-01-15T17:00:00.000Z)
        const dateRegex = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

        // Check release_groups target_date
        if (releaseQueue.release_groups) {
          for (const [id, group] of Object.entries(releaseQueue.release_groups)) {
            if (group.target_date) {
              assert.ok(
                dateRegex.test(group.target_date),
                `release_group ${id} target_date should match date format`
              );
            }
          }
        }

        // Check staged items target_date
        if (releaseQueue.staged) {
          for (const item of releaseQueue.staged) {
            if (item.target_date) {
              assert.ok(
                dateRegex.test(item.target_date),
                `staged item target_date should match date format`
              );
            }
          }
        }

        // Check released items release_date
        if (releaseQueue.released) {
          for (const item of releaseQueue.released) {
            if (item.release_date) {
              assert.ok(
                dateRegex.test(item.release_date),
                `released item release_date should match date format`
              );
            }
          }
        }
      });

      test('episode target dates in metadata are parseable for calendar', async () => {
        const { status, data } = await apiRequest('/api/episodes');

        assert.strictEqual(status, 200);

        for (const episode of data.episodes) {
          const targetDate = episode.metadata?.release?.target_date;

          if (targetDate && targetDate !== '') {
            // Verify the date is parseable by JavaScript Date
            const parsed = new Date(targetDate);
            assert.ok(!isNaN(parsed.getTime()), `target_date "${targetDate}" should be parseable`);
          }
        }
      });
    });
  });
});
