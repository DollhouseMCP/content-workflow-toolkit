// Asset Management Tools for the MCP Server

import fs from 'fs/promises';
import path from 'path';
import { ASSETS_DIR, BASE_DIR, slugify } from '../utils.js';

/**
 * Asset file/folder info
 */
interface AssetInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  ext?: string;
  children?: AssetInfo[];
}

/**
 * Validate that a path is within the assets directory
 */
function isPathWithinAssets(targetPath: string): boolean {
  const resolvedPath = path.resolve(ASSETS_DIR, targetPath);
  const normalizedAssetsDir = path.resolve(ASSETS_DIR);

  return resolvedPath.startsWith(normalizedAssetsDir + path.sep) ||
         resolvedPath === normalizedAssetsDir;
}

/**
 * Sanitize folder/file name
 */
function sanitizeName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\.{2,}/g, '.')
    .trim();
}

/**
 * Build asset tree recursively
 */
async function buildAssetTree(dirPath: string, relativePath: string = ''): Promise<AssetInfo[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const assets: AssetInfo[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const assetRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await buildAssetTree(fullPath, assetRelativePath);
      assets.push({
        name: entry.name,
        path: assetRelativePath,
        type: 'directory',
        children
      });
    } else {
      const stats = await fs.stat(fullPath);
      assets.push({
        name: entry.name,
        path: assetRelativePath,
        type: 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        ext: path.extname(entry.name).toLowerCase()
      });
    }
  }

  return assets;
}

/**
 * Filter assets by type
 */
function filterAssetsByType(assets: AssetInfo[], type: string): AssetInfo[] {
  const typeExtensions: Record<string, string[]> = {
    image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'],
    video: ['.mp4', '.mov', '.webm', '.avi', '.mkv'],
    audio: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'],
    document: ['.md', '.txt', '.pdf', '.doc', '.docx']
  };

  const extensions = typeExtensions[type];
  if (!extensions) return assets;

  return assets.filter(asset => {
    if (asset.type === 'directory') {
      // Recursively filter children
      const filteredChildren = filterAssetsByType(asset.children || [], type);
      if (filteredChildren.length > 0) {
        return { ...asset, children: filteredChildren };
      }
      return false;
    }
    return extensions.includes(asset.ext || '');
  });
}

/**
 * List assets in the assets directory
 */
export async function listAssets(
  subPath?: string,
  type?: string
): Promise<{ success: boolean; assets?: AssetInfo[]; error?: string }> {
  try {
    let targetPath = ASSETS_DIR;

    if (subPath) {
      // Validate path
      if (subPath.includes('..')) {
        return { success: false, error: 'Invalid path: path traversal not allowed' };
      }
      targetPath = path.join(ASSETS_DIR, subPath);

      if (!isPathWithinAssets(subPath)) {
        return { success: false, error: 'Invalid path: outside assets directory' };
      }
    }

    // Check if path exists
    try {
      await fs.access(targetPath);
    } catch {
      return { success: false, error: 'Path not found' };
    }

    let assets = await buildAssetTree(targetPath, subPath || '');

    // Filter by type if specified
    if (type) {
      assets = filterAssetsByType(assets, type);
    }

    return { success: true, assets };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list assets: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get detailed info about a specific asset
 */
export async function getAssetInfo(
  assetPath: string
): Promise<{ success: boolean; asset?: AssetInfo; error?: string }> {
  try {
    if (!assetPath) {
      return { success: false, error: 'Asset path is required' };
    }

    if (assetPath.includes('..')) {
      return { success: false, error: 'Invalid path: path traversal not allowed' };
    }

    if (!isPathWithinAssets(assetPath)) {
      return { success: false, error: 'Invalid path: outside assets directory' };
    }

    const fullPath = path.join(ASSETS_DIR, assetPath);

    try {
      await fs.access(fullPath);
    } catch {
      return { success: false, error: 'Asset not found' };
    }

    const stats = await fs.stat(fullPath);

    const asset: AssetInfo = {
      name: path.basename(assetPath),
      path: assetPath,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
      ext: stats.isFile() ? path.extname(assetPath).toLowerCase() : undefined
    };

    // If directory, include children
    if (stats.isDirectory()) {
      asset.children = await buildAssetTree(fullPath, assetPath);
    }

    return { success: true, asset };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get asset info: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Create a new folder in assets
 */
export async function createAssetFolder(
  parentPath: string,
  name: string
): Promise<{ success: boolean; folder?: AssetInfo; error?: string }> {
  try {
    if (!name) {
      return { success: false, error: 'Folder name is required' };
    }

    // Sanitize name
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      return { success: false, error: 'Invalid folder name' };
    }

    // Validate parent path
    const cleanParentPath = parentPath || '';
    if (cleanParentPath.includes('..')) {
      return { success: false, error: 'Invalid path: path traversal not allowed' };
    }

    const fullParentPath = cleanParentPath
      ? path.join(ASSETS_DIR, cleanParentPath)
      : ASSETS_DIR;

    if (!isPathWithinAssets(cleanParentPath || '.')) {
      return { success: false, error: 'Invalid path: outside assets directory' };
    }

    // Check parent exists
    try {
      await fs.access(fullParentPath);
    } catch {
      return { success: false, error: 'Parent folder not found' };
    }

    const newFolderPath = path.join(fullParentPath, sanitizedName);
    const relativePath = cleanParentPath
      ? `${cleanParentPath}/${sanitizedName}`
      : sanitizedName;

    // Check if folder already exists
    try {
      await fs.access(newFolderPath);
      return { success: false, error: 'Folder already exists' };
    } catch {
      // Good - doesn't exist
    }

    await fs.mkdir(newFolderPath);

    return {
      success: true,
      folder: {
        name: sanitizedName,
        path: relativePath,
        type: 'directory',
        children: []
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Move or rename an asset
 */
export async function moveAsset(
  sourcePath: string,
  destinationPath: string
): Promise<{ success: boolean; asset?: AssetInfo; error?: string }> {
  try {
    if (!sourcePath || !destinationPath) {
      return { success: false, error: 'Source and destination paths are required' };
    }

    if (sourcePath.includes('..') || destinationPath.includes('..')) {
      return { success: false, error: 'Invalid path: path traversal not allowed' };
    }

    if (!isPathWithinAssets(sourcePath) || !isPathWithinAssets(destinationPath)) {
      return { success: false, error: 'Invalid path: outside assets directory' };
    }

    const fullSourcePath = path.join(ASSETS_DIR, sourcePath);
    const fullDestPath = path.join(ASSETS_DIR, destinationPath);

    // Check source exists
    try {
      await fs.access(fullSourcePath);
    } catch {
      return { success: false, error: 'Source not found' };
    }

    // Check destination doesn't exist
    try {
      await fs.access(fullDestPath);
      return { success: false, error: 'Destination already exists' };
    } catch {
      // Good - doesn't exist
    }

    // Ensure destination parent exists
    const destParent = path.dirname(fullDestPath);
    try {
      await fs.access(destParent);
    } catch {
      return { success: false, error: 'Destination parent folder not found' };
    }

    await fs.rename(fullSourcePath, fullDestPath);

    const stats = await fs.stat(fullDestPath);
    return {
      success: true,
      asset: {
        name: path.basename(destinationPath),
        path: destinationPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        ext: stats.isFile() ? path.extname(destinationPath).toLowerCase() : undefined
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to move asset: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Delete an asset or empty folder
 */
export async function deleteAsset(
  assetPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!assetPath) {
      return { success: false, error: 'Asset path is required' };
    }

    if (assetPath.includes('..')) {
      return { success: false, error: 'Invalid path: path traversal not allowed' };
    }

    // Don't allow deleting the assets root
    if (assetPath === '' || assetPath === '.' || assetPath === '/') {
      return { success: false, error: 'Cannot delete assets root directory' };
    }

    if (!isPathWithinAssets(assetPath)) {
      return { success: false, error: 'Invalid path: outside assets directory' };
    }

    const fullPath = path.join(ASSETS_DIR, assetPath);

    // Check exists
    try {
      await fs.access(fullPath);
    } catch {
      return { success: false, error: 'Asset not found' };
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      // Only delete empty directories
      const entries = await fs.readdir(fullPath);
      if (entries.length > 0) {
        return { success: false, error: 'Cannot delete non-empty directory' };
      }
      await fs.rmdir(fullPath);
    } else {
      await fs.unlink(fullPath);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete asset: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
