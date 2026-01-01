const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const router = express.Router();

// Base paths
const BASE_DIR = path.join(__dirname, '../..');
const SERIES_DIR = path.join(BASE_DIR, 'series');
const ASSETS_DIR = path.join(BASE_DIR, 'assets');
const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');
const RELEASE_QUEUE = path.join(BASE_DIR, 'release-queue.yml');
const DISTRIBUTION_PROFILES = path.join(BASE_DIR, 'distribution-profiles.yml');

// Security: Allowlist for valid slug characters (alphanumeric, hyphens, underscores)
const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/;
const VALID_SERIES_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_ ]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

// Helper: Validate and sanitize slug (no path traversal)
function isValidSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length < 1 || slug.length > 100) return false;
  // Check for path traversal attempts
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) return false;
  return VALID_SLUG_REGEX.test(slug);
}

// Helper: Validate series name
function isValidSeriesName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 100) return false;
  // Check for path traversal attempts
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return VALID_SERIES_REGEX.test(name);
}

// Helper: Slugify a string
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w-]+/g, '')        // Remove non-word chars (except -)
    .replace(/--+/g, '-')           // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

// Helper: Get current date in YYYY-MM-DD format
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

// GET /api/series - List all series folders
router.get('/series', async (req, res) => {
  try {
    const entries = await fs.readdir(SERIES_DIR, { withFileTypes: true });
    const seriesList = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    res.json({
      success: true,
      series: seriesList
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/episodes - Create a new episode
router.post('/episodes', async (req, res) => {
  try {
    const { series, topic, title, description, targetDate, distributionProfile } = req.body;

    // Validate required fields
    if (!series || typeof series !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Series name is required'
      });
    }

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Topic/slug is required'
      });
    }

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    // Slugify and validate the topic
    const slug = slugify(topic);
    if (!isValidSlug(slug)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid topic/slug. Use only lowercase letters, numbers, and hyphens.'
      });
    }

    // Validate series name (security: prevent path traversal)
    const seriesName = series.trim();
    if (!isValidSeriesName(seriesName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid series name. Use only letters, numbers, spaces, hyphens, and underscores.'
      });
    }

    // Sanitize title (basic XSS prevention - strip HTML)
    const sanitizedTitle = title.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedTitle) {
      return res.status(400).json({
        success: false,
        error: 'Title cannot be empty after sanitization'
      });
    }

    // Sanitize description if provided
    const sanitizedDescription = description
      ? description.replace(/<[^>]*>/g, '').trim()
      : '';

    // Create paths
    const date = getCurrentDate();
    const episodeFolderName = `${date}-${slug}`;
    const seriesPath = path.join(SERIES_DIR, seriesName);
    const episodePath = path.join(seriesPath, episodeFolderName);

    // Additional security: ensure paths are within SERIES_DIR
    const resolvedSeriesPath = path.resolve(seriesPath);
    const resolvedEpisodePath = path.resolve(episodePath);
    if (!resolvedSeriesPath.startsWith(path.resolve(SERIES_DIR)) ||
        !resolvedEpisodePath.startsWith(path.resolve(SERIES_DIR))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path detected'
      });
    }

    // Check if episode already exists
    try {
      await fs.access(episodePath);
      return res.status(409).json({
        success: false,
        error: `Episode folder already exists: ${episodeFolderName}`
      });
    } catch (err) {
      // Episode doesn't exist, which is what we want
    }

    // Create series folder if it doesn't exist
    try {
      await fs.access(seriesPath);
    } catch (err) {
      await fs.mkdir(seriesPath, { recursive: true });
    }

    // Create episode folder structure
    await fs.mkdir(episodePath, { recursive: true });
    await fs.mkdir(path.join(episodePath, 'raw', 'camera'), { recursive: true });
    await fs.mkdir(path.join(episodePath, 'raw', 'screen'), { recursive: true });
    await fs.mkdir(path.join(episodePath, 'audio'), { recursive: true });
    await fs.mkdir(path.join(episodePath, 'assets'), { recursive: true });
    await fs.mkdir(path.join(episodePath, 'exports'), { recursive: true });

    // Read and populate metadata template
    const metadataTemplatePath = path.join(TEMPLATES_DIR, 'metadata-template.yml');
    let metadataContent;
    try {
      metadataContent = await fs.readFile(metadataTemplatePath, 'utf8');
    } catch (err) {
      // If template doesn't exist, create basic metadata
      metadataContent = `# Episode Metadata
content_status: draft

title: ""
description: ""

distribution:
  profile: full

release:
  target_date: ""
  release_group: ""
  depends_on: []
  notes: ""

recording:
  date: ""
  duration_raw: ""
  duration_final: ""
  format: "4K"

series:
  name: ""
  episode_number:

workflow:
  scripted: false
  recorded: false
  edited: false
  thumbnail_created: false
  uploaded: false
  published: false

analytics:
  youtube_id: ""
  publish_date: ""
`;
    }

    // Update metadata with provided values
    metadataContent = metadataContent.replace(/title: ""/, `title: "${sanitizedTitle.replace(/"/g, '\\"')}"`);
    metadataContent = metadataContent.replace(/name: ""/, `name: "${seriesName.replace(/"/g, '\\"')}"`);
    metadataContent = metadataContent.replace(/date: ""/, `date: "${date}"`);

    if (sanitizedDescription) {
      // For multi-line description, use YAML block scalar
      const descLines = sanitizedDescription.split('\n').map(line => '  ' + line).join('\n');
      metadataContent = metadataContent.replace(
        /description: \|[\s\S]*?(?=\n\n|\ntags:|\n#)/,
        `description: |\n${descLines}\n\n`
      );
    }

    if (targetDate) {
      metadataContent = metadataContent.replace(/target_date: ""/, `target_date: "${targetDate}"`);
    }

    if (distributionProfile) {
      metadataContent = metadataContent.replace(/profile: full/, `profile: ${distributionProfile}`);
    }

    await fs.writeFile(path.join(episodePath, 'metadata.yml'), metadataContent, 'utf8');

    // Copy script template
    const scriptTemplatePath = path.join(TEMPLATES_DIR, 'script-template.md');
    try {
      let scriptContent = await fs.readFile(scriptTemplatePath, 'utf8');
      // Update placeholders
      scriptContent = scriptContent.replace('[Video Title]', sanitizedTitle);
      scriptContent = scriptContent.replace('[Series Name]', seriesName);
      scriptContent = scriptContent.replace('[Number/Date]', date);
      await fs.writeFile(path.join(episodePath, 'script.md'), scriptContent, 'utf8');
    } catch (err) {
      // If template doesn't exist, create basic script file
      const basicScript = `# ${sanitizedTitle}

**Series**: ${seriesName}
**Episode**: ${date}
**Target Length**: TBD

---

## Hook (0:00 - 0:30)

## Intro (0:30 - 1:00)

## Main Content

## Recap

## Call to Action
`;
      await fs.writeFile(path.join(episodePath, 'script.md'), basicScript, 'utf8');
    }

    // Create notes.md
    const notesContent = `# Episode Notes: ${slug}

**Series**: ${seriesName}
**Date Created**: ${date}

## Ideas & Research


## Recording Notes


## Edit Notes


## Post-Publish Notes


## Analytics

| Metric | 24h | 7d | 30d |
|--------|-----|-----|-----|
| Views | | | |
| CTR | | | |
| Avg Duration | | | |

`;
    await fs.writeFile(path.join(episodePath, 'notes.md'), notesContent, 'utf8');

    // Return success with created episode data
    res.status(201).json({
      success: true,
      message: 'Episode created successfully',
      episode: {
        path: `series/${seriesName}/${episodeFolderName}`,
        series: seriesName,
        episode: episodeFolderName,
        title: sanitizedTitle,
        description: sanitizedDescription,
        targetDate: targetDate || null,
        distributionProfile: distributionProfile || 'full'
      }
    });

  } catch (error) {
    console.error('Error creating episode:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
