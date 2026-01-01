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

// Helper: Write YAML file
async function writeYamlFile(filepath, data) {
  try {
    const content = yaml.dump(data, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });
    await fs.writeFile(filepath, content, 'utf8');
  } catch (error) {
    console.error(`Error writing YAML file ${filepath}:`, error);
    throw error;
  }
}

// Helper: Deep merge objects (target is modified)
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Helper: Validate and sanitize episode metadata updates
function validateEpisodeUpdate(updates) {
  const errors = [];
  const sanitized = {};

  // Allowed top-level fields that can be updated
  const allowedFields = [
    'title',
    'description',
    'content_status',
    'tags',
    'workflow',
    'release'
  ];

  // Allowed content_status values
  const validContentStatuses = ['draft', 'ready', 'staged', 'released'];

  // Allowed workflow fields
  const validWorkflowFields = ['scripted', 'recorded', 'edited', 'thumbnail_created', 'uploaded', 'published'];

  // Allowed release fields
  const validReleaseFields = ['target_date', 'release_group', 'depends_on', 'notes'];

  for (const key of Object.keys(updates)) {
    if (!allowedFields.includes(key)) {
      errors.push(`Field '${key}' is not allowed to be updated`);
      continue;
    }

    switch (key) {
      case 'title':
        if (typeof updates.title !== 'string') {
          errors.push('Title must be a string');
        } else if (updates.title.length > 200) {
          errors.push('Title must be 200 characters or less');
        } else {
          // Sanitize: trim and remove control characters
          sanitized.title = updates.title.trim().replace(/[\x00-\x1F\x7F]/g, '');
        }
        break;

      case 'description':
        if (typeof updates.description !== 'string') {
          errors.push('Description must be a string');
        } else if (updates.description.length > 10000) {
          errors.push('Description must be 10000 characters or less');
        } else {
          // Sanitize: trim and remove control characters (except newlines)
          sanitized.description = updates.description.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        }
        break;

      case 'content_status':
        if (!validContentStatuses.includes(updates.content_status)) {
          errors.push(`Content status must be one of: ${validContentStatuses.join(', ')}`);
        } else {
          sanitized.content_status = updates.content_status;
        }
        break;

      case 'tags':
        if (!Array.isArray(updates.tags)) {
          errors.push('Tags must be an array');
        } else {
          // Sanitize each tag
          sanitized.tags = updates.tags
            .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
            .map(tag => tag.trim().replace(/[\x00-\x1F\x7F]/g, '').substring(0, 100));
        }
        break;

      case 'workflow':
        if (typeof updates.workflow !== 'object' || updates.workflow === null) {
          errors.push('Workflow must be an object');
        } else {
          sanitized.workflow = {};
          for (const wfKey of Object.keys(updates.workflow)) {
            if (!validWorkflowFields.includes(wfKey)) {
              errors.push(`Workflow field '${wfKey}' is not valid`);
            } else if (typeof updates.workflow[wfKey] !== 'boolean') {
              errors.push(`Workflow field '${wfKey}' must be a boolean`);
            } else {
              sanitized.workflow[wfKey] = updates.workflow[wfKey];
            }
          }
        }
        break;

      case 'release':
        if (typeof updates.release !== 'object' || updates.release === null) {
          errors.push('Release must be an object');
        } else {
          sanitized.release = {};
          for (const relKey of Object.keys(updates.release)) {
            if (!validReleaseFields.includes(relKey)) {
              errors.push(`Release field '${relKey}' is not valid`);
            } else {
              switch (relKey) {
                case 'target_date':
                  if (updates.release.target_date !== null && updates.release.target_date !== '') {
                    // Validate date format (YYYY-MM-DD)
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(updates.release.target_date)) {
                      errors.push('Target date must be in YYYY-MM-DD format');
                    } else {
                      sanitized.release.target_date = updates.release.target_date;
                    }
                  } else {
                    sanitized.release.target_date = '';
                  }
                  break;
                case 'release_group':
                  sanitized.release.release_group = String(updates.release.release_group || '').trim();
                  break;
                case 'notes':
                  sanitized.release.notes = String(updates.release.notes || '').trim().substring(0, 2000);
                  break;
                case 'depends_on':
                  if (Array.isArray(updates.release.depends_on)) {
                    sanitized.release.depends_on = updates.release.depends_on
                      .filter(dep => typeof dep === 'string')
                      .map(dep => dep.trim().substring(0, 200));
                  }
                  break;
              }
            }
          }
        }
        break;
    }
  }

  return { errors, sanitized };
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

// PATCH /api/episodes/:series/:episode - Update episode metadata
router.patch('/episodes/:series/:episode', async (req, res) => {
  try {
    const { series, episode } = req.params;
    const updates = req.body;

    // Validate path parameters to prevent directory traversal
    if (series.includes('..') || series.includes('/') || series.includes('\\') ||
        episode.includes('..') || episode.includes('/') || episode.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid series or episode name'
      });
    }

    const episodePath = path.join(SERIES_DIR, series, episode);
    const metadataPath = path.join(episodePath, 'metadata.yml');

    // Check if episode exists
    try {
      await fs.access(episodePath);
      await fs.access(metadataPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Episode not found'
      });
    }

    // Validate and sanitize updates
    const { errors, sanitized } = validateEpisodeUpdate(updates);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }

    if (Object.keys(sanitized).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Read existing metadata
    const metadata = await readYamlFile(metadataPath);

    // Deep merge sanitized updates into existing metadata
    deepMerge(metadata, sanitized);

    // Write updated metadata back to file
    await writeYamlFile(metadataPath, metadata);

    // Fetch updated file info
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
      message: 'Episode updated successfully',
      series: series,
      episode: episode,
      path: path.relative(BASE_DIR, episodePath),
      metadata: metadata,
      files: files
    });
  } catch (error) {
    console.error('Error updating episode:', error);
    res.status(500).json({
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
