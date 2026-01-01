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
    ...options,
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
          await fs.rm(path.join(testSeriesDir, testEpisodeSeries), {
            recursive: true,
            force: true,
          });
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });

    test('returns 400 when series is missing', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({ topic: 'test', title: 'Test' }),
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Series'), 'error should mention series');
    });

    test('returns 400 when topic is missing', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({ series: 'test', title: 'Test' }),
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Topic'), 'error should mention topic');
    });

    test('returns 400 when title is missing', async () => {
      const { status, data } = await apiRequest('/api/episodes', {
        method: 'POST',
        body: JSON.stringify({ series: 'test', topic: 'test' }),
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
          targetDate: 'invalid-date',
        }),
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
          targetDate: '2025-02-30',
        }),
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
          title: longTitle,
        }),
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
          description: 'Created by functional tests',
        }),
      });

      assert.strictEqual(status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.episode, 'should return episode data');
      assert.strictEqual(data.episode.series, testEpisodeSeries);
      assert.strictEqual(data.episode.title, 'Functional Test Episode');

      createdEpisodePath = data.episode.path;

      // Verify files were created
      const episodeDir = path.join(
        testSeriesDir,
        testEpisodeSeries,
        data.episode.episode
      );
      const metadataExists = await fs
        .access(path.join(episodeDir, 'metadata.yml'))
        .then(() => true)
        .catch(() => false);
      const scriptExists = await fs
        .access(path.join(episodeDir, 'script.md'))
        .then(() => true)
        .catch(() => false);
      const notesExists = await fs
        .access(path.join(episodeDir, 'notes.md'))
        .then(() => true)
        .catch(() => false);

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
          topic: 'functional-test', // Same topic, same day = same folder
          title: 'Duplicate Test',
        }),
      });

      assert.strictEqual(status, 409);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('exists'), 'error should mention exists');
    });
  });

  describe('GET /api/episodes/:series/:episode', () => {
    test('returns 404 for non-existent episode', async () => {
      const { status, data } = await apiRequest(
        '/api/episodes/nonexistent/nope'
      );

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
          description: 'Episode for testing PATCH endpoint',
        }),
      });

      if (status === 201 && data.episode) {
        patchTestEpisode = data.episode.episode;
      }
    });

    after(async () => {
      // Clean up test series
      try {
        await fs.rm(path.join(testSeriesDir, patchTestSeries), {
          recursive: true,
          force: true,
        });
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    test('returns 404 for non-existent episode', async () => {
      const { status, data } = await apiRequest(
        '/api/episodes/nonexistent/nope',
        {
          method: 'PATCH',
          body: JSON.stringify({ content_status: 'ready' }),
        }
      );

      assert.strictEqual(status, 404);
      assert.strictEqual(data.success, false);
      assert.ok(
        data.error.includes('not found'),
        'error should mention not found'
      );
    });

    test('returns 400 for path traversal in series param', async () => {
      // Use encoded dots to prevent URL normalization
      const { status, data } = await apiRequest('/api/episodes/..%2Fetc/nope', {
        method: 'PATCH',
        body: JSON.stringify({ content_status: 'ready' }),
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
    });

    test('returns 400 for path traversal in episode param', async () => {
      const { status, data } = await apiRequest(
        '/api/episodes/test-series/..%2F..%2Fetc',
        {
          method: 'PATCH',
          body: JSON.stringify({ content_status: 'ready' }),
        }
      );

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
    });

    test('returns 400 for invalid content_status', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(
        `/api/episodes/${patchTestSeries}/${patchTestEpisode}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ content_status: 'invalid_status' }),
        }
      );

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(
        data.errors.some((e) => e.includes('Content status')),
        'should have content_status error'
      );
    });

    test('returns 400 for title exceeding max length', async () => {
      if (!patchTestEpisode) return;

      const longTitle = 'a'.repeat(201);
      const { status, data } = await apiRequest(
        `/api/episodes/${patchTestSeries}/${patchTestEpisode}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title: longTitle }),
        }
      );

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(
        data.errors.some((e) => e.includes('200')),
        'should mention 200 char limit'
      );
    });

    test('returns 400 for no valid fields to update', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(
        `/api/episodes/${patchTestSeries}/${patchTestEpisode}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ unknown_field: 'value' }),
        }
      );

      assert.strictEqual(status, 400);
      assert.strictEqual(data.success, false);
      // Should have some error indication
      assert.ok(data.error || data.errors, 'should have error response');
    });

    test('updates content_status successfully', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(
        `/api/episodes/${patchTestSeries}/${patchTestEpisode}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ content_status: 'ready' }),
        }
      );

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.metadata, 'should return updated metadata');
      assert.strictEqual(data.metadata.content_status, 'ready');
    });

    test('updates title successfully', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(
        `/api/episodes/${patchTestSeries}/${patchTestEpisode}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title: 'Updated Title' }),
        }
      );

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.metadata.title, 'Updated Title');
    });

    test('updates workflow fields successfully', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(
        `/api/episodes/${patchTestSeries}/${patchTestEpisode}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            workflow: {
              scripted: true,
              recorded: true,
            },
          }),
        }
      );

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.metadata.workflow.scripted, true);
      assert.strictEqual(data.metadata.workflow.recorded, true);
    });

    test('sanitizes control characters from title', async () => {
      if (!patchTestEpisode) return;

      const { status, data } = await apiRequest(
        `/api/episodes/${patchTestSeries}/${patchTestEpisode}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title: 'Title\x00With\x1FControl\x7FChars' }),
        }
      );

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(
        !data.metadata.title.includes('\x00'),
        'should not contain null character'
      );
      assert.ok(
        !data.metadata.title.includes('\x1F'),
        'should not contain control character'
      );
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
            title: 'Test',
          }),
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
            title: 'Test',
          }),
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
            title: 'Test',
          }),
        });

        // Should succeed because slugify strips dangerous chars
        if (status === 201) {
          assert.strictEqual(data.success, true);
          // The slug should not contain any path traversal characters
          assert.ok(
            !data.episode.episode.includes('..'),
            'slug should not contain ..'
          );
          assert.ok(
            !data.episode.episode.includes('/'),
            'slug should not contain /'
          );

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'path-traversal-test'), {
              recursive: true,
              force: true,
            });
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
            title: 'Test',
          }),
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
            title: 'Test',
          }),
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
            title: '<script>alert("xss")</script>Clean Title',
          }),
        });

        // Should succeed but with sanitized title
        if (status === 201) {
          assert.strictEqual(data.success, true);
          assert.ok(
            !data.episode.title.includes('<script>'),
            'title should not contain script tags'
          );
          assert.ok(
            data.episode.title.includes('Clean Title'),
            'title should contain clean text'
          );

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-test-series'), {
              recursive: true,
              force: true,
            });
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
            description: '<img src=x onerror=alert("xss")>Safe description',
          }),
        });

        if (status === 201) {
          assert.strictEqual(data.success, true);
          assert.ok(
            !data.episode.description.includes('<img'),
            'description should not contain img tags'
          );
          assert.ok(
            data.episode.description.includes('Safe description'),
            'description should contain clean text'
          );

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-test-series-2'), {
              recursive: true,
              force: true,
            });
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
            title: '<script></script><div></div>',
          }),
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
            title: '<script>alert("xss")</script>',
          }),
        });

        if (status === 201) {
          // The text content is preserved, just tags stripped
          assert.strictEqual(data.episode.title, 'alert("xss")');

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-preserve-test'), {
              recursive: true,
              force: true,
            });
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
            title: '<div><script>evil()</script><b>Bold</b></div>Text',
          }),
        });

        if (status === 201) {
          assert.ok(
            !data.episode.title.includes('<'),
            'title should not contain any HTML'
          );

          // Clean up
          try {
            await fs.rm(path.join(testSeriesDir, 'xss-test-series-3'), {
              recursive: true,
              force: true,
            });
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
        await fs.rm(path.join(testAssetsDir, testFolderName), {
          recursive: true,
          force: true,
        });
        await fs.rm(path.join(testAssetsDir, testSubFolder), {
          recursive: true,
          force: true,
        });
        await fs.rm(path.join(testAssetsDir, 'renamed-folder'), {
          recursive: true,
          force: true,
        });
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    describe('POST /api/assets/folder', () => {
      test('creates folder successfully', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: testFolderName }),
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
          body: JSON.stringify({ name: testFolderName }),
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
        assert.ok(data.error.includes('exists'), 'error should mention exists');
      });

      test('returns 400 for empty folder name', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: '' }),
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('sanitizes folder name with special characters', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: 'test<script>alert(1)</script>folder' }),
        });

        if (status === 200) {
          assert.ok(
            !data.folder.name.includes('<'),
            'folder name should not contain special chars'
          );
          // Clean up
          await fs
            .rm(path.join(testAssetsDir, data.folder.name), {
              recursive: true,
              force: true,
            })
            .catch(() => {});
        }
      });

      test('rejects path traversal in folder name', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: '../../../etc' }),
        });

        // Should either be rejected or sanitized to safe name
        if (status === 200) {
          assert.ok(
            !data.folder.name.includes('..'),
            'folder name should not contain ..'
          );
          await fs
            .rm(path.join(testAssetsDir, data.folder.name), {
              recursive: true,
              force: true,
            })
            .catch(() => {});
        } else {
          assert.strictEqual(status, 400);
        }
      });

      test('rejects path traversal in parent path', async () => {
        const { status, data } = await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({
            path: '../../../etc',
            name: 'evil',
          }),
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });
    });

    describe('DELETE /api/assets/*', () => {
      before(async () => {
        // Create a folder to delete
        await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: testSubFolder }),
        });
      });

      test('deletes folder successfully', async () => {
        const { status, data } = await apiRequest(
          `/api/assets/${testSubFolder}`,
          {
            method: 'DELETE',
          }
        );

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
      });

      test('returns 404 for non-existent path', async () => {
        const { status, data } = await apiRequest(
          '/api/assets/nonexistent-folder-12345',
          {
            method: 'DELETE',
          }
        );

        assert.strictEqual(status, 404);
        assert.strictEqual(data.success, false);
      });

      test('returns 400 for missing path', async () => {
        const { status, data } = await apiRequest('/api/assets/', {
          method: 'DELETE',
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects path traversal attempt', async () => {
        const { status, data } = await apiRequest('/api/assets/..%2F..%2Fetc', {
          method: 'DELETE',
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('prevents deleting assets root', async () => {
        const { status, data } = await apiRequest('/api/assets/.', {
          method: 'DELETE',
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
          body: JSON.stringify({ name: 'rename-test-folder' }),
        });
      });

      after(async () => {
        // Clean up
        await fs
          .rm(path.join(testAssetsDir, 'rename-test-folder'), {
            recursive: true,
            force: true,
          })
          .catch(() => {});
        await fs
          .rm(path.join(testAssetsDir, 'renamed-folder'), {
            recursive: true,
            force: true,
          })
          .catch(() => {});
      });

      test('renames folder successfully', async () => {
        const { status, data } = await apiRequest(
          '/api/assets/rename-test-folder',
          {
            method: 'PATCH',
            body: JSON.stringify({ newPath: 'renamed-folder' }),
          }
        );

        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.newPath, 'should return new path');
      });

      test('returns 404 for non-existent source', async () => {
        const { status, data } = await apiRequest(
          '/api/assets/nonexistent-folder-xyz',
          {
            method: 'PATCH',
            body: JSON.stringify({ newPath: 'new-name' }),
          }
        );

        assert.strictEqual(status, 404);
        assert.strictEqual(data.success, false);
      });

      test('returns 400 for missing newPath', async () => {
        const { status, data } = await apiRequest(
          '/api/assets/renamed-folder',
          {
            method: 'PATCH',
            body: JSON.stringify({}),
          }
        );

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects path traversal in current path', async () => {
        const { status, data } = await apiRequest('/api/assets/..%2F..%2Fetc', {
          method: 'PATCH',
          body: JSON.stringify({ newPath: 'new-name' }),
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('rejects path traversal in new path', async () => {
        const { status, data } = await apiRequest(
          '/api/assets/renamed-folder',
          {
            method: 'PATCH',
            body: JSON.stringify({ newPath: '../../../etc/evil' }),
          }
        );

        assert.strictEqual(status, 400);
        assert.strictEqual(data.success, false);
      });

      test('sanitizes filename with special characters', async () => {
        // Create a test folder first
        await apiRequest('/api/assets/folder', {
          method: 'POST',
          body: JSON.stringify({ name: 'sanitize-test-folder' }),
        });

        const { status, data } = await apiRequest(
          '/api/assets/sanitize-test-folder',
          {
            method: 'PATCH',
            body: JSON.stringify({ newPath: 'test<script>name' }),
          }
        );

        if (status === 200) {
          assert.ok(
            !data.newPath.includes('<'),
            'new path should not contain special chars'
          );
          await fs
            .rm(path.join(testAssetsDir, data.newPath), {
              recursive: true,
              force: true,
            })
            .catch(() => {});
        }
        // Clean up original if rename failed
        await fs
          .rm(path.join(testAssetsDir, 'sanitize-test-folder'), {
            recursive: true,
            force: true,
          })
          .catch(() => {});
      });
    });
  });
});
