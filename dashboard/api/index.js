import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Base paths (resolved once at module load for security and performance)
const BASE_DIR = path.join(__dirname, '../..');
const SERIES_DIR = path.join(BASE_DIR, 'series');
const ASSETS_DIR = path.join(BASE_DIR, 'assets');
const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');
const RELEASE_QUEUE = path.join(BASE_DIR, 'release-queue.yml');
const DISTRIBUTION_PROFILES = path.join(BASE_DIR, 'distribution-profiles.yml');

// Pre-resolved paths for path traversal checks (resolved once at startup)
const RESOLVED_SERIES_DIR = path.resolve(SERIES_DIR) + path.sep;

// Input validation constants
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SLUG_LENGTH = 100;
const MAX_SERIES_NAME_LENGTH = 100;

// Security: Allowlist for valid slug characters (alphanumeric, hyphens, underscores)
const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/;
const VALID_SERIES_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_ ]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

// Cached metadata template (loaded once at startup, deep cloned on use)
let cachedMetadataTemplate = null;
async function getMetadataTemplate() {
  if (cachedMetadataTemplate === null) {
    try {
      const templatePath = path.join(TEMPLATES_DIR, 'metadata-template.yml');
      const content = await fs.readFile(templatePath, 'utf8');
      cachedMetadataTemplate = yaml.load(content) || {};
    } catch (err) {
      // Default template if file doesn't exist
      cachedMetadataTemplate = {
        content_status: 'draft',
        title: '',
        description: '',
        distribution: { profile: 'full' },
        release: { target_date: '', release_group: '', depends_on: [], notes: '' },
        recording: { date: '', duration_raw: '', duration_final: '', format: '4K' },
        series: { name: '', episode_number: null },
        workflow: {
          scripted: false,
          recorded: false,
          edited: false,
          thumbnail_created: false,
          uploaded: false,
          published: false
        },
        analytics: { youtube_id: '', publish_date: '' }
      };
    }
  }
  // Deep clone to prevent mutation of cached template
  return JSON.parse(JSON.stringify(cachedMetadataTemplate));
}

// Cached distribution profiles (loaded once at startup)
let cachedDistributionProfiles = null;
async function getDistributionProfiles() {
  if (cachedDistributionProfiles === null) {
    try {
      const content = await fs.readFile(DISTRIBUTION_PROFILES, 'utf8');
      cachedDistributionProfiles = yaml.load(content) || {};
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist - no profiles to validate against
        cachedDistributionProfiles = { profiles: {} };
      } else {
        throw err;
      }
    }
  }
  return cachedDistributionProfiles;
}

// Helper: Recursively remove directory (for cleanup on failure)
async function removeDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to clean up directory ${dirPath}:`, err.message);
  }
}

// Helper: Validate and sanitize slug (no path traversal)
function isValidSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length < 1 || slug.length > MAX_SLUG_LENGTH) return false;
  // Check for path traversal attempts
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) return false;
  return VALID_SLUG_REGEX.test(slug);
}

// Helper: Validate series name
function isValidSeriesName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > MAX_SERIES_NAME_LENGTH) return false;
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
  let episodePath = null; // Track for cleanup on failure
  let episodeCreated = false; // Only true after we successfully create the folder

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

    // Validate input lengths
    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Title must be ${MAX_TITLE_LENGTH} characters or less`
      });
    }

    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
      });
    }

    // Slugify and validate the topic
    const slug = slugify(topic);
    if (!isValidSlug(slug)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid topic/slug. Use only lowercase letters, numbers, hyphens, and underscores.'
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

    // Strip HTML tags from title as defense-in-depth
    // Note: Primary XSS protection is output escaping in the frontend (escapeHtml)
    // This prevents storing HTML that could cause issues in other contexts (logs, exports, etc.)
    const sanitizedTitle = title.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedTitle) {
      return res.status(400).json({
        success: false,
        error: 'Title cannot be empty after removing HTML tags'
      });
    }

    // Strip HTML from description if provided (defense-in-depth)
    const sanitizedDescription = description
      ? description.replace(/<[^>]*>/g, '').trim()
      : '';

    // Validate targetDate format if provided (YYYY-MM-DD)
    if (targetDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(targetDate)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid target date format. Use YYYY-MM-DD.'
        });
      }
      // Validate it's a real date (not just valid format)
      // Parse and verify the date components match what was provided
      const [year, month, day] = targetDate.split('-').map(Number);
      const parsedDate = new Date(year, month - 1, day);
      if (parsedDate.getFullYear() !== year ||
          parsedDate.getMonth() !== month - 1 ||
          parsedDate.getDate() !== day) {
        return res.status(400).json({
          success: false,
          error: 'Invalid target date.'
        });
      }
    }

    // Validate distribution profile if provided (uses cached profiles)
    if (distributionProfile) {
      try {
        const profiles = await getDistributionProfiles();
        const validProfiles = Object.keys(profiles.profiles || {});
        // Only validate if profiles exist; empty profiles means accept any
        if (validProfiles.length > 0 && !validProfiles.includes(distributionProfile)) {
          return res.status(400).json({
            success: false,
            error: `Invalid distribution profile. Valid options: ${validProfiles.join(', ')}`
          });
        }
      } catch (err) {
        console.error('Error reading distribution profiles:', err.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to validate distribution profile'
        });
      }
    }

    // Create paths
    const date = getCurrentDate();
    const episodeFolderName = `${date}-${slug}`;
    const seriesPath = path.join(SERIES_DIR, seriesName);
    episodePath = path.join(seriesPath, episodeFolderName);

    // Security: ensure paths are within SERIES_DIR using pre-resolved path + separator
    // The trailing separator prevents prefix matching (e.g., /series-evil matching /series)
    const resolvedEpisodePath = path.resolve(episodePath);
    if (!resolvedEpisodePath.startsWith(RESOLVED_SERIES_DIR)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path detected'
      });
    }

    // Create series folder if it doesn't exist
    await fs.mkdir(seriesPath, { recursive: true });

    // Create episode folder - use recursive:false to detect if it already exists
    // This avoids TOCTOU race condition between check and creation
    try {
      await fs.mkdir(episodePath, { recursive: false });
      episodeCreated = true; // Mark that WE created this folder (safe to cleanup on failure)
    } catch (err) {
      if (err.code === 'EEXIST') {
        return res.status(409).json({
          success: false,
          error: `Episode folder already exists: ${episodeFolderName}`
        });
      }
      throw err; // Re-throw other errors
    }

    // Create subdirectories in parallel for better performance
    await Promise.all([
      fs.mkdir(path.join(episodePath, 'raw', 'camera'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'raw', 'screen'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'audio'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'assets'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'exports'), { recursive: true })
    ]);

    // Get metadata template (cached for performance)
    const metadata = await getMetadataTemplate();

    // Update metadata with provided values
    metadata.title = sanitizedTitle;
    metadata.content_status = 'draft';

    if (sanitizedDescription) {
      metadata.description = sanitizedDescription;
    }

    // Ensure nested objects exist
    metadata.series = metadata.series || {};
    metadata.series.name = seriesName;

    metadata.recording = metadata.recording || {};
    metadata.recording.date = date;

    if (targetDate) {
      metadata.release = metadata.release || {};
      metadata.release.target_date = targetDate;
    }

    if (distributionProfile) {
      metadata.distribution = metadata.distribution || {};
      metadata.distribution.profile = distributionProfile;
    }

    // Write metadata using YAML dump for proper formatting
    const metadataContent = '# Episode Metadata\n' + yaml.dump(metadata, {
      lineWidth: -1,  // Don't wrap lines
      quotingType: '"',
      forceQuotes: false
    });
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
    // Log full error details server-side only
    console.error('Error creating episode:', error);

    // Only clean up if WE created the episode folder (prevents removing pre-existing folders)
    if (episodeCreated && episodePath) {
      await removeDirectory(episodePath);
    }

    // Return generic error message to client (don't leak internal paths/details)
    res.status(500).json({
      success: false,
      error: 'Failed to create episode. Please try again.'
    });
  }
});

export default router;
