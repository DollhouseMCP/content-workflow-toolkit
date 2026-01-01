import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import yaml from 'js-yaml';
import multer from 'multer';

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

// ============================================
// Security Configuration for File Uploads
// ============================================

// Allowed file extensions (whitelist)
// Note: SVG files can contain JavaScript. For public-facing applications,
// either remove SVG from this list or sanitize SVG content before serving.
// In this internal content workflow tool, SVGs are only accessible to authorized users.
const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
  // Video
  '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v',
  // Audio
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
  // Documents
  '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
  // Data/Config
  '.json', '.yml', '.yaml', '.csv', '.xml'
]);

// Maximum file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Sanitize filename - remove special characters that could cause issues
function sanitizeFilename(filename) {
  // Get the extension
  const ext = path.extname(filename).toLowerCase();
  const name = path.basename(filename, ext);

  // Replace dangerous characters, keep alphanumeric, dash, underscore, space, and dot
  const sanitized = name
    .replace(/[^a-zA-Z0-9\-_\s.]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200); // Limit length

  return sanitized + ext;
}

// Validate path is within assets directory (prevent path traversal)
// Uses path.relative() for robust cross-platform handling
function isPathWithinAssets(targetPath) {
  const resolvedPath = path.resolve(ASSETS_DIR, targetPath);
  const normalizedAssetsDir = path.resolve(ASSETS_DIR);
  const relativePath = path.relative(normalizedAssetsDir, resolvedPath);

  // Path is within assets if:
  // 1. Relative path doesn't start with '..' (would indicate escaping the directory)
  // 2. Relative path isn't an absolute path (edge case on Windows)
  // 3. Relative path is empty string (exact match) or a valid child path
  return relativePath === '' ||
         (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

// Validate file extension
function isAllowedExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Temporary upload location
    const uploadDir = path.join(BASE_DIR, 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fsSync.existsSync(uploadDir)) {
      fsSync.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    // Uses crypto.randomBytes for cryptographically secure unique suffix
    const sanitized = sanitizeFilename(file.originalname);
    const uniqueSuffix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = function (req, file, cb) {
  if (!isAllowedExtension(file.originalname)) {
    cb(new Error(`File type not allowed: ${path.extname(file.originalname)}`), false);
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 20 // Maximum 20 files at once
  },
  fileFilter: fileFilter
});

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
        const sanitizedTitle = updates.title.trim().replace(/[\x00-\x1F\x7F]/g, '');
        if (sanitizedTitle.length === 0) {
          errors.push('Title cannot be empty after sanitization');
        } else {
          sanitized.title = sanitizedTitle;
        }
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
        const workflowUpdates = {};
        for (const wfKey of Object.keys(updates.workflow)) {
          if (!validWorkflowFields.includes(wfKey)) {
            errors.push(`Workflow field '${wfKey}' is not valid`);
          } else if (typeof updates.workflow[wfKey] !== 'boolean') {
            errors.push(`Workflow field '${wfKey}' must be a boolean`);
          } else {
            workflowUpdates[wfKey] = updates.workflow[wfKey];
          }
        }
        // Only add workflow if there are valid fields to update
        if (Object.keys(workflowUpdates).length > 0) {
          sanitized.workflow = workflowUpdates;
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
                  // Validate date is actually valid (e.g., not Feb 30)
                  const [year, month, day] = updates.release.target_date.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
                    errors.push('Target date must be a valid date');
                  } else {
                    sanitized.release.target_date = updates.release.target_date;
                  }
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

    // Validate request body exists
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Ensure Content-Type is application/json and body contains valid JSON.'
      });
    }

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

    // Additional security: verify resolved path is within SERIES_DIR
    const resolvedPath = path.resolve(episodePath);
    if (!resolvedPath.startsWith(RESOLVED_SERIES_DIR)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path detected'
      });
    }

    // Check if episode exists
    try {
      await fs.access(episodePath);
      await fs.access(metadataPath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'Episode not found'
        });
      }
      // Other errors (EACCES, etc.) should be 500
      throw err;
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
      error: 'Failed to update episode. Please try again.'
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
    // Validate request body exists (express.json() middleware may not have parsed it)
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Ensure Content-Type is application/json and body contains valid JSON.'
      });
    }

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

// ============================================
// Asset Management API Endpoints
// ============================================

// POST /api/assets/upload - Upload files to a target folder
router.post('/assets/upload', upload.array('files', 20), async (req, res) => {
  const movedFiles = []; // Track files that have been moved for cleanup on error (must be outside try for catch access)

  try {
    const targetFolder = req.body.targetFolder || '';

    // Security: Validate target folder is within assets directory
    if (!isPathWithinAssets(targetFolder)) {
      // Clean up uploaded files
      for (const file of req.files || []) {
        await fs.unlink(file.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid target folder path'
      });
    }

    const targetDir = path.join(ASSETS_DIR, targetFolder);

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    const uploadedFiles = [];

    for (const file of req.files || []) {
      // Use the filename already generated by multer (already sanitized with unique suffix)
      // Multer's storage config generates: sanitized-name-timestamp-randomhex.ext
      const finalPath = path.join(targetDir, file.filename);

      // Note: With timestamp + crypto.randomBytes(4), collision probability is negligible
      // (~1 in 4.3 billion per millisecond). This check is defense-in-depth.
      // TOCTOU window exists but collision risk is astronomically low.
      try {
        await fs.access(finalPath);
        // File exists - this is unexpected with random suffix
        throw Object.assign(new Error('File already exists at destination'), { code: 'EEXIST' });
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err; // Re-throw if not "file doesn't exist"
        }
        // Good - file doesn't exist, proceed with rename
      }

      // Move file from temp uploads to target directory
      await fs.rename(file.path, finalPath);
      movedFiles.push(finalPath); // Track for cleanup

      // Get file stats for response
      const stats = await fs.stat(finalPath);

      uploadedFiles.push({
        name: file.filename,
        originalName: file.originalname,
        path: path.relative(ASSETS_DIR, finalPath),
        size: stats.size,
        type: file.mimetype
      });
    }

    res.json({
      success: true,
      files: uploadedFiles,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`
    });

  } catch (error) {
    // Clean up files that were moved to target directory
    for (const movedPath of movedFiles) {
      await fs.unlink(movedPath).catch(() => {});
    }
    // Clean up any temp files that weren't moved yet
    for (const file of req.files || []) {
      await fs.unlink(file.path).catch(() => {});
    }
    console.error('Upload error:', error);

    // Provide specific error messages for common failure cases
    if (error.code === 'ENOSPC') {
      return res.status(507).json({
        success: false,
        error: 'Insufficient storage space'
      });
    }
    if (error.code === 'EACCES') {
      return res.status(500).json({
        success: false,
        error: 'Permission denied'
      });
    }

    res.status(500).json({
      success: false,
      error: 'An internal error occurred during upload'
    });
  }
});

// POST /api/assets/folder - Create a new folder
router.post('/assets/folder', async (req, res) => {
  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Ensure Content-Type is application/json and body contains valid JSON.'
      });
    }

    const { path: parentPath, name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required'
      });
    }

    // Sanitize folder name
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9\-_\s]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);

    if (!sanitizedName) {
      return res.status(400).json({
        success: false,
        error: 'Invalid folder name'
      });
    }

    const parentDir = parentPath ? parentPath : '';
    const newFolderPath = path.join(parentDir, sanitizedName);

    // Security: Validate path is within assets directory
    if (!isPathWithinAssets(newFolderPath)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid folder path'
      });
    }

    const fullPath = path.join(ASSETS_DIR, newFolderPath);

    // Ensure parent directory exists first (recursive is safe here)
    const parentFullPath = path.dirname(fullPath);
    await fs.mkdir(parentFullPath, { recursive: true });

    // Create the final folder without recursive to get EEXIST error if it exists
    // This avoids TOCTOU race condition with access() check
    try {
      await fs.mkdir(fullPath, { recursive: false });
    } catch (mkdirError) {
      if (mkdirError.code === 'EEXIST') {
        return res.status(400).json({
          success: false,
          error: 'Folder already exists'
        });
      }
      throw mkdirError;
    }

    res.json({
      success: true,
      folder: {
        name: sanitizedName,
        path: newFolderPath
      },
      message: `Folder "${sanitizedName}" created successfully`
    });

  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({
      success: false,
      error: 'An internal error occurred while creating folder'
    });
  }
});

// DELETE /api/assets/* - Delete a file or folder
router.delete('/assets/*', async (req, res) => {
  try {
    // Get the path from URL params (everything after /assets/)
    const assetPath = req.params[0];

    if (!assetPath) {
      return res.status(400).json({
        success: false,
        error: 'Path is required'
      });
    }

    // Security: Validate path is within assets directory
    if (!isPathWithinAssets(assetPath)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path'
      });
    }

    // Prevent deleting the assets root directory
    const fullPath = path.join(ASSETS_DIR, assetPath);
    if (path.resolve(fullPath) === path.resolve(ASSETS_DIR)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the root assets folder'
      });
    }

    // Check if path exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'File or folder not found'
      });
    }

    // Get stats to determine if it's a file or directory
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      // Delete directory recursively
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      // Delete file
      await fs.unlink(fullPath);
    }

    res.json({
      success: true,
      message: `Successfully deleted: ${assetPath}`
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'An internal error occurred during delete operation'
    });
  }
});

// PATCH /api/assets/* - Rename or move a file/folder
router.patch('/assets/*', async (req, res) => {
  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Ensure Content-Type is application/json and body contains valid JSON.'
      });
    }

    // Get the current path from URL params
    const currentPath = req.params[0];
    const { newPath } = req.body;

    if (!currentPath) {
      return res.status(400).json({
        success: false,
        error: 'Current path is required'
      });
    }

    if (!newPath || typeof newPath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'New path is required'
      });
    }

    // Sanitize the filename portion of the new path
    const newPathDir = path.dirname(newPath);
    const newPathFilename = path.basename(newPath);
    const sanitizedFilename = sanitizeFilename(newPathFilename);
    const sanitizedNewPath = newPathDir === '.' ? sanitizedFilename : path.join(newPathDir, sanitizedFilename);

    // Security: Validate both paths are within assets directory
    if (!isPathWithinAssets(currentPath)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid current path'
      });
    }

    if (!isPathWithinAssets(sanitizedNewPath)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid new path'
      });
    }

    const fullCurrentPath = path.join(ASSETS_DIR, currentPath);
    const fullNewPath = path.join(ASSETS_DIR, sanitizedNewPath);

    // Prevent modifying the assets root
    if (path.resolve(fullCurrentPath) === path.resolve(ASSETS_DIR)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot rename the root assets folder'
      });
    }

    // Check if source exists
    try {
      await fs.access(fullCurrentPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Source file or folder not found'
      });
    }

    // Ensure parent directory of destination exists
    const newParentDir = path.dirname(fullNewPath);
    await fs.mkdir(newParentDir, { recursive: true });

    // Perform the rename/move - handles EEXIST on Windows
    // Note: On POSIX systems, fs.rename() atomically overwrites existing files by design,
    // so EEXIST won't be thrown. The stat check provides user feedback but has a TOCTOU window.
    // This is acceptable since this is a single-user tool where concurrent renames to same path are rare.
    try {
      // Check destination exists just before rename to minimize race window
      const destStats = await fs.stat(fullNewPath).catch(() => null);
      if (destStats) {
        return res.status(400).json({
          success: false,
          error: 'Destination already exists'
        });
      }
      await fs.rename(fullCurrentPath, fullNewPath);
    } catch (renameError) {
      if (renameError.code === 'EEXIST') {
        return res.status(400).json({
          success: false,
          error: 'Destination already exists'
        });
      }
      throw renameError;
    }

    res.json({
      success: true,
      oldPath: currentPath,
      newPath: sanitizedNewPath,
      message: `Successfully renamed/moved to: ${sanitizedNewPath}`
    });

  } catch (error) {
    console.error('Rename/move error:', error);
    res.status(500).json({
      success: false,
      error: 'An internal error occurred during rename/move operation'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 20 files at once'
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  next();
});

export default router;
