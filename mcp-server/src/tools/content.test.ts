import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// We need to mock the utils module before importing content
let testDir: string;
let seriesDir: string;

// Setup test directory before each test
beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
  seriesDir = path.join(testDir, 'series');
  await fs.mkdir(seriesDir, { recursive: true });
});

// Cleanup after each test
afterEach(async () => {
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
  vi.resetModules();
});

describe('createSeries', () => {
  it('should create a new series with required fields', async () => {
    // Mock the utils module to use our test directory
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const result = await createSeries('Test Series');

    expect(result.success).toBe(true);
    expect(result.series).toBeDefined();
    expect(result.series?.name).toBe('Test Series');
    expect(result.series?.slug).toBe('test-series');

    // Verify files were created
    const seriesPath = path.join(seriesDir, 'test-series');
    const metadataExists = await fs.access(path.join(seriesPath, 'series.yml')).then(() => true).catch(() => false);
    const readmeExists = await fs.access(path.join(seriesPath, 'README.md')).then(() => true).catch(() => false);

    expect(metadataExists).toBe(true);
    expect(readmeExists).toBe(true);
  });

  it('should create series with description', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const result = await createSeries('My Series', 'A great series about coding');

    expect(result.success).toBe(true);
    expect(result.series?.metadata.description).toBe('A great series about coding');
  });

  it('should reject empty series name', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const result = await createSeries('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Series name is required');
  });

  it('should reject series name that is too long', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const longName = 'a'.repeat(101);
    const result = await createSeries(longName);

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });

  it('should reject description that is too long', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const longDescription = 'a'.repeat(5001);
    const result = await createSeries('Test Series', longDescription);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Description exceeds maximum length');
  });

  it('should reject invalid series name with special characters', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const result = await createSeries('Test@Series!');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid series name');
  });

  it('should reject duplicate series name', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    // Create first series
    await createSeries('Duplicate Test');

    // Try to create same series again
    const result = await createSeries('Duplicate Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('should strip HTML tags from description', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const result = await createSeries('HTML Test', '<script>alert("xss")</script>Safe content');

    expect(result.success).toBe(true);
    expect(result.series?.metadata.description).toBe('alert("xss")Safe content');
  });

  it('should prevent path traversal attacks', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries } = await import('./content.js');

    const result = await createSeries('../../../malicious');

    expect(result.success).toBe(false);
    // Should fail due to invalid name pattern
    expect(result.error).toBeDefined();
  });
});

describe('listSeries', () => {
  it('should return empty list when no series exist', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { listSeries } = await import('./content.js');

    const result = await listSeries();

    expect(result.success).toBe(true);
    expect(result.series).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('should list created series', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    const { createSeries, listSeries } = await import('./content.js');

    await createSeries('Series One', 'First series');
    await createSeries('Series Two', 'Second series');

    const result = await listSeries();

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.series?.map(s => s.name)).toContain('Series One');
    expect(result.series?.map(s => s.name)).toContain('Series Two');
  });

  it('should include series without metadata file', async () => {
    vi.doMock('../utils.js', async () => {
      const actual = await vi.importActual('../utils.js') as object;
      return {
        ...actual,
        SERIES_DIR: seriesDir,
        BASE_DIR: testDir
      };
    });

    // Create a series folder without metadata
    await fs.mkdir(path.join(seriesDir, 'orphan-series'), { recursive: true });

    const { listSeries } = await import('./content.js');

    const result = await listSeries();

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.series?.[0].slug).toBe('orphan-series');
  });
});
