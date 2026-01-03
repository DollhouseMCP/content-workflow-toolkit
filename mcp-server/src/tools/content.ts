// Content Management Tools for the MCP Server

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
  SERIES_DIR,
  BASE_DIR,
  scanForEpisodes,
  getEpisode,
  getMetadataTemplate,
  slugify,
  getCurrentDate,
  isValidSlug,
  isValidSeriesName,
  deepMerge,
  writeYamlFile,
  readYamlFile,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SERIES_NAME_LENGTH
} from '../utils.js';
import type { Episode, EpisodeMetadata, WorkflowStage, VALID_WORKFLOW_STAGES, VALID_CONTENT_STATUSES, SeriesMetadata, SeriesInfo, SeriesTemplate } from '../types.js';
import { VALID_SERIES_TEMPLATES } from '../types.js';

/**
 * Debug logger for content operations.
 * Logs to stderr to avoid interfering with MCP stdio communication.
 */
function debugLog(operation: string, message: string, data?: Record<string, unknown>): void {
  if (process.env.DEBUG === 'true' || process.env.MCP_DEBUG === 'true') {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.error(`[${timestamp}] [content:${operation}] ${message}${logData}`);
  }
}

/**
 * Create a new episode folder and metadata
 */
export async function createEpisode(
  series: string,
  topic: string,
  title: string,
  description?: string
): Promise<{ success: boolean; episode?: Episode; error?: string }> {
  let episodePath: string | null = null;
  let episodeCreated = false;

  try {
    // Validate series name
    const seriesName = series.trim();
    if (!isValidSeriesName(seriesName)) {
      return {
        success: false,
        error: 'Invalid series name. Use only letters, numbers, spaces, hyphens, and underscores.'
      };
    }

    // Slugify and validate the topic
    const slug = slugify(topic);
    if (!isValidSlug(slug)) {
      return {
        success: false,
        error: 'Invalid topic/slug. Use only lowercase letters, numbers, hyphens, and underscores.'
      };
    }

    // Validate title
    if (!title || title.trim().length === 0) {
      return { success: false, error: 'Title is required' };
    }

    // Sanitize title (strip HTML tags) and validate length
    const sanitizedTitle = title.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedTitle) {
      return { success: false, error: 'Title cannot be empty after removing HTML tags' };
    }
    if (sanitizedTitle.length > MAX_TITLE_LENGTH) {
      return { success: false, error: `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters` };
    }

    // Sanitize description if provided and validate length
    const sanitizedDescription = description
      ? description.replace(/<[^>]*>/g, '').trim()
      : '';
    if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters` };
    }

    // Create paths
    const date = getCurrentDate();
    const episodeFolderName = `${date}-${slug}`;
    const seriesPath = path.join(SERIES_DIR, seriesName);
    episodePath = path.join(seriesPath, episodeFolderName);

    // Verify path is within series directory
    const resolvedEpisodePath = path.resolve(episodePath);
    const resolvedSeriesDir = path.resolve(SERIES_DIR) + path.sep;
    if (!resolvedEpisodePath.startsWith(resolvedSeriesDir)) {
      return { success: false, error: 'Invalid path detected' };
    }

    // Create series folder if it doesn't exist
    await fs.mkdir(seriesPath, { recursive: true });

    // Create episode folder
    try {
      await fs.mkdir(episodePath, { recursive: false });
      episodeCreated = true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        return {
          success: false,
          error: `Episode folder already exists: ${episodeFolderName}`
        };
      }
      throw err;
    }

    // Create subdirectories
    await Promise.all([
      fs.mkdir(path.join(episodePath, 'raw', 'camera'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'raw', 'screen'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'audio'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'assets'), { recursive: true }),
      fs.mkdir(path.join(episodePath, 'exports'), { recursive: true })
    ]);

    // Get and customize metadata template
    const metadata = await getMetadataTemplate();
    metadata.title = sanitizedTitle;
    metadata.content_status = 'draft';

    if (sanitizedDescription) {
      metadata.description = sanitizedDescription;
    }

    metadata.series = metadata.series || {};
    metadata.series.name = seriesName;

    metadata.recording = metadata.recording || {};
    metadata.recording.date = date;

    // Write metadata file
    const metadataContent = '# Episode Metadata\n' + yaml.dump(metadata, {
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false
    });
    await fs.writeFile(path.join(episodePath, 'metadata.yml'), metadataContent, 'utf8');

    // Create basic script file
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

    // Create notes.md
    const notesContent = `# Episode Notes: ${slug}

**Series**: ${seriesName}
**Date Created**: ${date}

## Ideas & Research


## Recording Notes


## Edit Notes


## Post-Publish Notes

`;
    await fs.writeFile(path.join(episodePath, 'notes.md'), notesContent, 'utf8');

    // Return created episode
    const episode = await getEpisode(seriesName, episodeFolderName);
    return { success: true, episode: episode || undefined };

  } catch (error) {
    // Cleanup on failure if we created the folder
    if (episodeCreated && episodePath) {
      try {
        await fs.rm(episodePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    return {
      success: false,
      error: `Failed to create episode: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Update episode metadata fields
 */
export async function updateEpisodeMetadata(
  series: string,
  episode: string,
  updates: Partial<EpisodeMetadata>
): Promise<{ success: boolean; metadata?: EpisodeMetadata; error?: string }> {
  try {
    // Validate path parameters
    if (series.includes('..') || series.includes('/') || series.includes('\\') ||
        episode.includes('..') || episode.includes('/') || episode.includes('\\')) {
      return { success: false, error: 'Invalid series or episode name' };
    }

    const episodePath = path.join(SERIES_DIR, series, episode);
    const metadataPath = path.join(episodePath, 'metadata.yml');

    // Verify path is within series directory
    const resolvedPath = path.resolve(episodePath);
    const resolvedSeriesDir = path.resolve(SERIES_DIR) + path.sep;
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      return { success: false, error: 'Invalid path detected' };
    }

    // Check if episode exists
    try {
      await fs.access(metadataPath);
    } catch {
      return { success: false, error: 'Episode not found' };
    }

    // Read existing metadata
    const metadata = await readYamlFile<EpisodeMetadata>(metadataPath);

    // Deep merge updates into existing metadata
    deepMerge(metadata, updates);

    // Write updated metadata
    await writeYamlFile(metadataPath, metadata);

    return { success: true, metadata };

  } catch (error) {
    return {
      success: false,
      error: `Failed to update metadata: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get episode details and file list
 */
export async function getEpisodeDetails(
  series: string,
  episodeName: string
): Promise<{ success: boolean; episode?: Episode; error?: string }> {
  try {
    // Validate path parameters
    if (series.includes('..') || series.includes('/') || series.includes('\\') ||
        episodeName.includes('..') || episodeName.includes('/') || episodeName.includes('\\')) {
      return { success: false, error: 'Invalid series or episode name' };
    }

    const episode = await getEpisode(series, episodeName);
    if (!episode) {
      return { success: false, error: 'Episode not found' };
    }

    return { success: true, episode };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get episode: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * List all episodes with optional filtering
 */
export async function listEpisodes(
  filter?: { status?: string; series?: string }
): Promise<{ success: boolean; episodes?: Episode[]; count?: number; error?: string }> {
  try {
    let episodes = await scanForEpisodes(SERIES_DIR);

    // Apply filters
    if (filter) {
      if (filter.status) {
        episodes = episodes.filter(ep => ep.metadata.content_status === filter.status);
      }
      if (filter.series) {
        episodes = episodes.filter(ep => ep.series === filter.series);
      }
    }

    return {
      success: true,
      episodes,
      count: episodes.length
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list episodes: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Generate README content based on template type
 */
function generateSeriesReadme(seriesName: string, metadata: SeriesMetadata, templateType: string): string {
  const description = metadata.description || '*No description provided.*';

  // Template-specific sections
  const templateSections: Record<string, string> = {
    tutorial: `
## Learning Objectives

Define what viewers will learn from this series.

## Prerequisites

List any knowledge or tools viewers should have before starting.

## Episode Structure

Each episode in this series follows a consistent format:
1. Introduction & objectives
2. Step-by-step demonstration
3. Summary & next steps
`,
    vlog: `
## Series Theme

Define the recurring theme or focus of this vlog series.

## Recurring Segments

List any recurring segments or features.
`,
    podcast: `
## Format

Describe the podcast format (interview, solo, panel, etc.).

## Episode Length

Target duration for episodes.

## Recurring Segments

- Intro
- Main discussion
- Outro / Call to action
`,
    default: `
## Series Overview

Add details about what this series covers and who it's for.
`
  };

  const templateSection = templateSections[templateType] || templateSections.default;

  return `# ${seriesName}

${description}

## About This Series

- **Created**: ${metadata.created}
- **Template**: ${metadata.template}
${templateSection}
## Episodes

Episodes will appear here as they are created.

## Style Guide

Add any series-specific style notes, branding guidelines, or recurring elements here.

## Notes

Additional planning notes and ideas for future episodes.
`;
}

/**
 * Creates a new series folder with metadata and README.
 *
 * Creates the following structure:
 * - series/<slug>/series.yml - Series metadata
 * - series/<slug>/README.md - Series description with template-specific content
 *
 * @param name - Display name for the series (e.g., "AI Tools Review")
 * @param description - Optional series description (HTML tags will be stripped)
 * @param template - Optional template type: 'default', 'tutorial', 'vlog', 'podcast'
 * @returns Promise resolving to success status and series info, or error details
 *
 * @example
 * ```typescript
 * const result = await createSeries('My Tutorial Series', 'Learn coding', 'tutorial');
 * if (result.success) {
 *   console.log(`Created: ${result.series.path}`);
 * }
 * ```
 */
export async function createSeries(
  name: string,
  description?: string,
  template?: SeriesTemplate | string
): Promise<{ success: boolean; series?: SeriesInfo; warning?: string; error?: string }> {
  let seriesPath: string | null = null;
  let seriesCreated = false;
  let templateWarning: string | undefined;

  debugLog('createSeries', 'Starting series creation', { name, template });

  try {
    // Validate series name
    const seriesName = name.trim();
    if (!seriesName) {
      debugLog('createSeries', 'Validation failed: empty name');
      return { success: false, error: 'Series name is required' };
    }

    if (seriesName.length > MAX_SERIES_NAME_LENGTH) {
      debugLog('createSeries', 'Validation failed: name too long', { length: seriesName.length, max: MAX_SERIES_NAME_LENGTH });
      return {
        success: false,
        error: `Series name "${seriesName.substring(0, 20)}..." exceeds maximum length of ${MAX_SERIES_NAME_LENGTH} characters (got ${seriesName.length})`
      };
    }

    if (!isValidSeriesName(seriesName)) {
      debugLog('createSeries', 'Validation failed: invalid characters', { name: seriesName });
      return {
        success: false,
        error: `Invalid series name "${seriesName}". Use only letters, numbers, spaces, hyphens, and underscores.`
      };
    }

    // Create slug from name for folder
    const seriesSlug = slugify(seriesName);
    if (!seriesSlug) {
      debugLog('createSeries', 'Validation failed: empty slug', { name: seriesName });
      return {
        success: false,
        error: `Could not create valid folder name from series name "${seriesName}". Try using alphanumeric characters.`
      };
    }

    // Build path early for fail-fast checks (security + duplicate)
    seriesPath = path.join(SERIES_DIR, seriesSlug);

    // Security: Verify path is within series directory (prevents traversal)
    const resolvedPath = path.resolve(seriesPath);
    const resolvedSeriesDir = path.resolve(SERIES_DIR) + path.sep;
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      debugLog('createSeries', 'Security: path traversal attempt blocked', { seriesSlug });
      return { success: false, error: 'Invalid path detected - possible path traversal attempt' };
    }

    // Fail-fast: Check if series already exists (moved earlier)
    try {
      await fs.access(seriesPath);
      debugLog('createSeries', 'Series already exists', { slug: seriesSlug });
      return {
        success: false,
        error: `Series "${seriesName}" already exists at ${seriesSlug}/. Choose a different name or delete the existing series first.`
      };
    } catch {
      // Good - folder doesn't exist yet
    }

    // Validate template if provided (after duplicate check since it's cheaper)
    const templateType: SeriesTemplate = (template && VALID_SERIES_TEMPLATES.includes(template as SeriesTemplate))
      ? (template as SeriesTemplate)
      : 'default';

    if (template && !VALID_SERIES_TEMPLATES.includes(template as SeriesTemplate)) {
      templateWarning = `Invalid template '${template}', using 'default'. Valid templates: ${VALID_SERIES_TEMPLATES.join(', ')}`;
      debugLog('createSeries', 'Invalid template, using default', { provided: template, valid: VALID_SERIES_TEMPLATES });
    }

    // Validate and sanitize description BEFORE creating folder
    const sanitizedDescription = description?.replace(/<[^>]*>/g, '').trim() || '';
    if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      debugLog('createSeries', 'Validation failed: description too long', { length: sanitizedDescription.length, max: MAX_DESCRIPTION_LENGTH });
      return {
        success: false,
        error: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters (got ${sanitizedDescription.length})`
      };
    }

    // Create series folder
    debugLog('createSeries', 'Creating series folder', { path: seriesPath });
    await fs.mkdir(seriesPath, { recursive: false });
    seriesCreated = true;

    // Create series metadata
    const metadata: SeriesMetadata = {
      name: seriesName,
      slug: seriesSlug,
      description: sanitizedDescription,
      created: getCurrentDate(),
      template: templateType,
      settings: {
        default_distribution_profile: 'full',
        default_format: '4K'
      }
    };

    // Prepare file contents
    const metadataContent = '# Series Metadata\n' + yaml.dump(metadata, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });
    const readmeContent = generateSeriesReadme(seriesName, metadata, templateType);

    // Write files in parallel (independent operations)
    await Promise.all([
      fs.writeFile(path.join(seriesPath, 'series.yml'), metadataContent, 'utf8'),
      fs.writeFile(path.join(seriesPath, 'README.md'), readmeContent, 'utf8')
    ]);

    debugLog('createSeries', 'Series created successfully', { slug: seriesSlug, template: templateType, hasWarning: !!templateWarning });

    // Return created series info (include warning if template was invalid)
    const result: { success: boolean; series: SeriesInfo; warning?: string } = {
      success: true,
      series: {
        name: seriesName,
        slug: seriesSlug,
        path: path.relative(BASE_DIR, seriesPath),
        metadata
      }
    };

    if (templateWarning) {
      result.warning = templateWarning;
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog('createSeries', 'Error during creation', { error: errorMessage, seriesCreated });

    // Cleanup on failure
    let cleanupFailed = false;
    if (seriesCreated && seriesPath) {
      try {
        debugLog('createSeries', 'Cleaning up failed series folder', { path: seriesPath });
        await fs.rm(seriesPath, { recursive: true, force: true });
      } catch (cleanupError) {
        cleanupFailed = true;
        debugLog('createSeries', 'Cleanup failed', { error: String(cleanupError) });
      }
    }

    let finalError = `Failed to create series: ${errorMessage}`;
    if (cleanupFailed) {
      finalError += '. Note: Automatic cleanup failed - manual removal may be required.';
    }

    return {
      success: false,
      error: finalError
    };
  }
}

/**
 * Lists all available series with their metadata.
 *
 * Scans the series directory and returns information about each series,
 * including those without a series.yml file (with basic info).
 *
 * @returns Promise resolving to list of series with count, or error details
 *
 * @example
 * ```typescript
 * const result = await listSeries();
 * if (result.success) {
 *   console.log(`Found ${result.count} series`);
 *   result.series.forEach(s => console.log(`- ${s.name}`));
 * }
 * ```
 */
export async function listSeries(): Promise<{ success: boolean; series?: SeriesInfo[]; count?: number; error?: string }> {
  debugLog('listSeries', 'Starting series listing');

  try {
    const entries = await fs.readdir(SERIES_DIR, { withFileTypes: true });

    // Filter to valid directories only (security: skip potentially malicious names)
    const validDirs = entries.filter(entry =>
      entry.isDirectory() &&
      !entry.name.startsWith('.') &&  // Skip hidden directories
      !entry.name.includes('..') &&   // Skip path traversal attempts
      isValidSeriesName(entry.name)   // Only include valid series names
    );

    // Read all series metadata in parallel for performance
    const seriesPromises = validDirs.map(async (entry): Promise<SeriesInfo> => {
      const seriesPath = path.join(SERIES_DIR, entry.name);
      const metadataPath = path.join(seriesPath, 'series.yml');

      try {
        const metadata = await readYamlFile<SeriesMetadata>(metadataPath);
        return {
          name: metadata.name || entry.name,
          slug: entry.name,
          path: path.relative(BASE_DIR, seriesPath),
          metadata
        };
      } catch {
        // No series.yml - still include it with basic info
        return {
          name: entry.name,
          slug: entry.name,
          path: path.relative(BASE_DIR, seriesPath),
          metadata: {
            name: entry.name,
            slug: entry.name,
            description: '',
            created: ''
          }
        };
      }
    });

    const seriesList = await Promise.all(seriesPromises);
    const orphanCount = seriesList.filter(s => !s.metadata.created).length;

    debugLog('listSeries', 'Series listing complete', { total: seriesList.length, orphan: orphanCount });

    return {
      success: true,
      series: seriesList,
      count: seriesList.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog('listSeries', 'Error listing series', { error: errorMessage });

    return {
      success: false,
      error: `Failed to list series: ${errorMessage}. Ensure the series directory exists and is accessible.`
    };
  }
}
