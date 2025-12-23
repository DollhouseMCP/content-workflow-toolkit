const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const router = express.Router();

// Base paths
const BASE_DIR = path.join(__dirname, '../..');
const SERIES_DIR = path.join(BASE_DIR, 'series');
const ASSETS_DIR = path.join(BASE_DIR, 'assets');
const RELEASE_QUEUE = path.join(BASE_DIR, 'release-queue.yml');
const DISTRIBUTION_PROFILES = path.join(BASE_DIR, 'distribution-profiles.yml');

// Helper: Read and parse YAML file
async function readYamlFile(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf8');
    return yaml.load(content);
  } catch (error) {
    console.error(`Error reading YAML file ${filepath}:`, error);
    throw error;
  }
}

// Helper: Recursively scan directory for episodes
async function scanForEpisodes(dir) {
  const episodes = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Check if this directory contains a metadata.yml file
        const metadataPath = path.join(fullPath, 'metadata.yml');
        try {
          await fs.access(metadataPath);
          // This is an episode directory
          const metadata = await readYamlFile(metadataPath);
          const relativePath = path.relative(BASE_DIR, fullPath);
          const pathParts = relativePath.split(path.sep);

          episodes.push({
            path: relativePath,
            series: pathParts[1] || 'unknown',
            episode: entry.name,
            metadata: metadata
          });
        } catch (err) {
          // No metadata.yml, might contain subdirectories
          const subEpisodes = await scanForEpisodes(fullPath);
          episodes.push(...subEpisodes);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }

  return episodes;
}

// Helper: Get directory tree structure with detailed file info
async function getDirectoryTree(dir, relativeTo = dir) {
  const tree = {
    name: path.basename(dir),
    path: path.relative(relativeTo, dir),
    type: 'directory',
    children: [],
    fileCount: 0
  };

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subtree = await getDirectoryTree(fullPath, relativeTo);
        tree.children.push(subtree);
        tree.fileCount += subtree.fileCount;
      } else {
        const stats = await fs.stat(fullPath);
        const ext = path.extname(entry.name).toLowerCase();

        // Get image dimensions for image files
        let dimensions = null;
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
          // Note: We could use sharp or similar library for actual dimensions
          // For now, we'll just mark it as an image
          dimensions = { type: 'image' };
        }

        tree.children.push({
          name: entry.name,
          path: path.relative(relativeTo, fullPath),
          type: 'file',
          ext: ext,
          size: stats.size,
          modified: stats.mtime,
          dimensions: dimensions
        });
        tree.fileCount += 1;
      }
    }

    // Sort: directories first, then files alphabetically
    tree.children.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return tree;
}

// API Routes

// GET /api/episodes - List all episodes with metadata
router.get('/episodes', async (req, res) => {
  try {
    const episodes = await scanForEpisodes(SERIES_DIR);
    res.json({
      success: true,
      count: episodes.length,
      episodes: episodes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/episodes/:series/:episode - Single episode detail
router.get('/episodes/:series/:episode', async (req, res) => {
  try {
    const { series, episode } = req.params;
    const episodePath = path.join(SERIES_DIR, series, episode);
    const metadataPath = path.join(episodePath, 'metadata.yml');

    // Check if episode exists
    await fs.access(episodePath);

    // Read metadata
    const metadata = await readYamlFile(metadataPath);

    // Get list of files in episode directory with details
    const fileEntries = await fs.readdir(episodePath, { withFileTypes: true });
    const files = await Promise.all(
      fileEntries.map(async (entry) => {
        const filePath = path.join(episodePath, entry.name);
        const stats = await fs.stat(filePath);
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
          ext: path.extname(entry.name).toLowerCase()
        };
      })
    );

    res.json({
      success: true,
      series: series,
      episode: episode,
      path: path.relative(BASE_DIR, episodePath),
      metadata: metadata,
      files: files
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/releases - Release queue data
router.get('/releases', async (req, res) => {
  try {
    const releaseQueue = await readYamlFile(RELEASE_QUEUE);
    res.json({
      success: true,
      data: releaseQueue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/distribution - Distribution profiles
router.get('/distribution', async (req, res) => {
  try {
    const distributionProfiles = await readYamlFile(DISTRIBUTION_PROFILES);
    res.json({
      success: true,
      data: distributionProfiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/assets - Asset folder structure
router.get('/assets', async (req, res) => {
  try {
    const tree = await getDirectoryTree(ASSETS_DIR, BASE_DIR);
    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/health - Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
