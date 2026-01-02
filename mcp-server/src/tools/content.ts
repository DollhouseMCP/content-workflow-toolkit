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
  MAX_DESCRIPTION_LENGTH
} from '../utils.js';
import type { Episode, EpisodeMetadata, WorkflowStage, VALID_WORKFLOW_STAGES, VALID_CONTENT_STATUSES } from '../types.js';

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
