import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Import the actual utils module type for better type safety
import type * as UtilsModule from '../utils.js';

// Test directory state
let testDir: string;
let assetsDir: string;

/**
 * Helper to set up the mock for utils module with test directories.
 */
async function setupUtilsMock(): Promise<void> {
  vi.doMock('../utils.js', async () => {
    const actual = await vi.importActual<typeof UtilsModule>('../utils.js');
    return {
      ...actual,
      ASSETS_DIR: assetsDir,
      BASE_DIR: testDir
    };
  });
}

/**
 * Helper to import assets module after mock setup.
 */
async function importAssetsModule() {
  return await import('./assets.js');
}

// Setup test directory before each test
beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-assets-test-'));
  assetsDir = path.join(testDir, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });
  await setupUtilsMock();
});

// Cleanup after each test
afterEach(async () => {
  vi.resetModules();

  if (testDir) {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Warning: Failed to cleanup test directory ${testDir}:`, error);
    }
  }

  testDir = '';
});

describe('listAssets', () => {
  it('should return empty list for empty assets directory', async () => {
    const { listAssets } = await importAssetsModule();

    const result = await listAssets();

    expect(result.success).toBe(true);
    expect(result.assets).toEqual([]);
  });

  it('should list files and directories', async () => {
    // Create test structure
    await fs.writeFile(path.join(assetsDir, 'test.png'), 'fake image');
    await fs.mkdir(path.join(assetsDir, 'subfolder'));
    await fs.writeFile(path.join(assetsDir, 'subfolder', 'nested.jpg'), 'nested');

    const { listAssets } = await importAssetsModule();

    const result = await listAssets();

    expect(result.success).toBe(true);
    expect(result.assets?.length).toBe(2);

    const file = result.assets?.find(a => a.name === 'test.png');
    expect(file?.type).toBe('file');
    expect(file?.ext).toBe('.png');

    const folder = result.assets?.find(a => a.name === 'subfolder');
    expect(folder?.type).toBe('directory');
    expect(folder?.children?.length).toBe(1);
  });

  it('should filter by subpath', async () => {
    await fs.mkdir(path.join(assetsDir, 'images'));
    await fs.writeFile(path.join(assetsDir, 'images', 'logo.png'), 'logo');
    await fs.writeFile(path.join(assetsDir, 'readme.txt'), 'readme');

    const { listAssets } = await importAssetsModule();

    const result = await listAssets('images');

    expect(result.success).toBe(true);
    expect(result.assets?.length).toBe(1);
    expect(result.assets?.[0].name).toBe('logo.png');
  });

  it('should filter by type', async () => {
    await fs.writeFile(path.join(assetsDir, 'photo.jpg'), 'image');
    await fs.writeFile(path.join(assetsDir, 'video.mp4'), 'video');
    await fs.writeFile(path.join(assetsDir, 'notes.txt'), 'text');

    const { listAssets } = await importAssetsModule();

    const result = await listAssets(undefined, 'image');

    expect(result.success).toBe(true);
    expect(result.assets?.length).toBe(1);
    expect(result.assets?.[0].name).toBe('photo.jpg');
  });

  it('should include directories with matching children when filtering by type', async () => {
    await fs.mkdir(path.join(assetsDir, 'media'));
    await fs.writeFile(path.join(assetsDir, 'media', 'song.mp3'), 'audio');
    await fs.writeFile(path.join(assetsDir, 'doc.txt'), 'text');

    const { listAssets } = await importAssetsModule();

    const result = await listAssets(undefined, 'audio');

    expect(result.success).toBe(true);
    expect(result.assets?.length).toBe(1);
    expect(result.assets?.[0].name).toBe('media');
    expect(result.assets?.[0].children?.length).toBe(1);
    expect(result.assets?.[0].children?.[0].name).toBe('song.mp3');
  });

  it('should reject path traversal attempts', async () => {
    const { listAssets } = await importAssetsModule();

    const result = await listAssets('../etc');

    expect(result.success).toBe(false);
    expect(result.error).toContain('path traversal');
  });

  it('should return error for non-existent path', async () => {
    const { listAssets } = await importAssetsModule();

    const result = await listAssets('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Path not found');
  });
});

describe('getAssetInfo', () => {
  it('should return file info', async () => {
    await fs.writeFile(path.join(assetsDir, 'test.png'), 'test content');

    const { getAssetInfo } = await importAssetsModule();

    const result = await getAssetInfo('test.png');

    expect(result.success).toBe(true);
    expect(result.asset?.name).toBe('test.png');
    expect(result.asset?.type).toBe('file');
    expect(result.asset?.ext).toBe('.png');
    expect(result.asset?.size).toBe(12); // 'test content'.length
  });

  it('should return directory info with children', async () => {
    await fs.mkdir(path.join(assetsDir, 'folder'));
    await fs.writeFile(path.join(assetsDir, 'folder', 'file.txt'), 'content');

    const { getAssetInfo } = await importAssetsModule();

    const result = await getAssetInfo('folder');

    expect(result.success).toBe(true);
    expect(result.asset?.type).toBe('directory');
    expect(result.asset?.children?.length).toBe(1);
  });

  it('should reject empty path', async () => {
    const { getAssetInfo } = await importAssetsModule();

    const result = await getAssetInfo('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Asset path is required');
  });

  it('should reject path traversal', async () => {
    const { getAssetInfo } = await importAssetsModule();

    const result = await getAssetInfo('../../../etc/passwd');

    expect(result.success).toBe(false);
    expect(result.error).toContain('path traversal');
  });
});

describe('createAssetFolder', () => {
  it('should create folder in root', async () => {
    const { createAssetFolder } = await importAssetsModule();

    const result = await createAssetFolder('', 'new-folder');

    expect(result.success).toBe(true);
    expect(result.folder?.name).toBe('new-folder');
    expect(result.folder?.type).toBe('directory');

    // Verify folder exists
    const stats = await fs.stat(path.join(assetsDir, 'new-folder'));
    expect(stats.isDirectory()).toBe(true);
  });

  it('should create nested folder', async () => {
    await fs.mkdir(path.join(assetsDir, 'parent'));

    const { createAssetFolder } = await importAssetsModule();

    const result = await createAssetFolder('parent', 'child');

    expect(result.success).toBe(true);
    expect(result.folder?.path).toBe('parent/child');
  });

  it('should sanitize folder name', async () => {
    const { createAssetFolder } = await importAssetsModule();

    const result = await createAssetFolder('', 'test<>folder');

    expect(result.success).toBe(true);
    expect(result.folder?.name).toBe('testfolder');
  });

  it('should reject empty folder name', async () => {
    const { createAssetFolder } = await importAssetsModule();

    const result = await createAssetFolder('', '');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Folder name is required');
  });

  it('should reject duplicate folder', async () => {
    await fs.mkdir(path.join(assetsDir, 'existing'));

    const { createAssetFolder } = await importAssetsModule();

    const result = await createAssetFolder('', 'existing');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Folder already exists');
  });

  it('should reject path traversal in parent', async () => {
    const { createAssetFolder } = await importAssetsModule();

    const result = await createAssetFolder('../outside', 'folder');

    expect(result.success).toBe(false);
    expect(result.error).toContain('path traversal');
  });
});

describe('moveAsset', () => {
  it('should move file to new location', async () => {
    await fs.writeFile(path.join(assetsDir, 'original.txt'), 'content');

    const { moveAsset } = await importAssetsModule();

    const result = await moveAsset('original.txt', 'moved.txt');

    expect(result.success).toBe(true);
    expect(result.asset?.name).toBe('moved.txt');

    // Verify original is gone
    await expect(fs.access(path.join(assetsDir, 'original.txt'))).rejects.toThrow();
    // Verify new exists
    const content = await fs.readFile(path.join(assetsDir, 'moved.txt'), 'utf8');
    expect(content).toBe('content');
  });

  it('should move file to subdirectory', async () => {
    await fs.writeFile(path.join(assetsDir, 'file.txt'), 'content');
    await fs.mkdir(path.join(assetsDir, 'subdir'));

    const { moveAsset } = await importAssetsModule();

    const result = await moveAsset('file.txt', 'subdir/file.txt');

    expect(result.success).toBe(true);
    expect(result.asset?.path).toBe('subdir/file.txt');
  });

  it('should reject if source not found', async () => {
    const { moveAsset } = await importAssetsModule();

    const result = await moveAsset('nonexistent.txt', 'dest.txt');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Source not found');
  });

  it('should reject if destination exists', async () => {
    await fs.writeFile(path.join(assetsDir, 'source.txt'), 'source');
    await fs.writeFile(path.join(assetsDir, 'dest.txt'), 'dest');

    const { moveAsset } = await importAssetsModule();

    const result = await moveAsset('source.txt', 'dest.txt');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Destination already exists');
  });

  it('should reject path traversal in source', async () => {
    const { moveAsset } = await importAssetsModule();

    const result = await moveAsset('../etc/passwd', 'stolen.txt');

    expect(result.success).toBe(false);
    expect(result.error).toContain('path traversal');
  });

  it('should reject path traversal in destination', async () => {
    await fs.writeFile(path.join(assetsDir, 'file.txt'), 'content');

    const { moveAsset } = await importAssetsModule();

    const result = await moveAsset('file.txt', '../outside.txt');

    expect(result.success).toBe(false);
    expect(result.error).toContain('path traversal');
  });
});

describe('deleteAsset', () => {
  it('should delete a file', async () => {
    await fs.writeFile(path.join(assetsDir, 'to-delete.txt'), 'content');

    const { deleteAsset } = await importAssetsModule();

    const result = await deleteAsset('to-delete.txt');

    expect(result.success).toBe(true);
    await expect(fs.access(path.join(assetsDir, 'to-delete.txt'))).rejects.toThrow();
  });

  it('should delete empty directory', async () => {
    await fs.mkdir(path.join(assetsDir, 'empty-folder'));

    const { deleteAsset } = await importAssetsModule();

    const result = await deleteAsset('empty-folder');

    expect(result.success).toBe(true);
    await expect(fs.access(path.join(assetsDir, 'empty-folder'))).rejects.toThrow();
  });

  it('should reject deleting non-empty directory', async () => {
    await fs.mkdir(path.join(assetsDir, 'non-empty'));
    await fs.writeFile(path.join(assetsDir, 'non-empty', 'file.txt'), 'content');

    const { deleteAsset } = await importAssetsModule();

    const result = await deleteAsset('non-empty');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cannot delete non-empty directory');
  });

  it('should reject deleting assets root', async () => {
    const { deleteAsset } = await importAssetsModule();

    // Empty string is caught by "path required" check
    const resultEmpty = await deleteAsset('');
    expect(resultEmpty.success).toBe(false);
    expect(resultEmpty.error).toBe('Asset path is required');

    // Dot and slash are caught by root directory check
    const resultDot = await deleteAsset('.');
    expect(resultDot.success).toBe(false);
    expect(resultDot.error).toBe('Cannot delete assets root directory');

    const resultSlash = await deleteAsset('/');
    expect(resultSlash.success).toBe(false);
    expect(resultSlash.error).toBe('Cannot delete assets root directory');
  });

  it('should reject path traversal', async () => {
    const { deleteAsset } = await importAssetsModule();

    const result = await deleteAsset('../important-file');

    expect(result.success).toBe(false);
    expect(result.error).toContain('path traversal');
  });

  it('should return error for non-existent asset', async () => {
    const { deleteAsset } = await importAssetsModule();

    const result = await deleteAsset('nonexistent.txt');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Asset not found');
  });
});
