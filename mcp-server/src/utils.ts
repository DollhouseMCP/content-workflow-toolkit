// Utility functions for the Content Workflow MCP Server

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import type { EpisodeMetadata, Episode, ReleaseQueue, FileInfo } from './types.js';

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base paths - resolved relative to mcp-server directory (up one level to project root)
export const BASE_DIR = path.resolve(__dirname, '../..');
export const SERIES_DIR = path.join(BASE_DIR, 'series');
export const ASSETS_DIR = path.join(BASE_DIR, 'assets');
export const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');
export const RELEASE_QUEUE_PATH = path.join(BASE_DIR, 'release-queue.yml');

// Validation constants
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_SLUG_LENGTH = 100;
export const MAX_SERIES_NAME_LENGTH = 100;

// Regex patterns for validation
export const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/;
export const VALID_SERIES_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_ ]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

/**
 * Read and parse a YAML file
 */
export async function readYamlFile<T>(filepath: string): Promise<T> {
  const content = await fs.readFile(filepath, 'utf8');
  return yaml.load(content) as T;
}

/**
 * Write data to a YAML file
 */
export async function writeYamlFile(filepath: string, data: unknown): Promise<void> {
  const content = yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
  await fs.writeFile(filepath, content, 'utf8');
}

/**
 * Slugify a string for use in file/folder names
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length < 1 || slug.length > MAX_SLUG_LENGTH) return false;
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) return false;
  return VALID_SLUG_REGEX.test(slug);
}

/**
 * Validate series name
 */
export function isValidSeriesName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > MAX_SERIES_NAME_LENGTH) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return VALID_SERIES_REGEX.test(name);
}

/**
 * Validate a path is within the series directory (prevent traversal)
 */
export function isPathWithinSeries(targetPath: string): boolean {
  const resolvedPath = path.resolve(SERIES_DIR, targetPath);
  const normalizedSeriesDir = path.resolve(SERIES_DIR);
  const relativePath = path.relative(normalizedSeriesDir, resolvedPath);

  return relativePath === '' ||
         (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

/**
 * Deep merge objects (target is modified)
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  for (const key in source) {
    const sourceValue = source[key];
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      if (!target[key] || typeof target[key] !== 'object') {
        (target as Record<string, unknown>)[key] = {};
      }
      deepMerge(target[key] as object, sourceValue as object);
    } else {
      (target as Record<string, unknown>)[key] = sourceValue;
    }
  }
  return target;
}

/**
 * Recursively scan directory for episodes
 */
export async function scanForEpisodes(dir: string): Promise<Episode[]> {
  const episodes: Episode[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const metadataPath = path.join(fullPath, 'metadata.yml');
        try {
          await fs.access(metadataPath);
          // This is an episode directory
          const metadata = await readYamlFile<EpisodeMetadata>(metadataPath);
          const relativePath = path.relative(BASE_DIR, fullPath);
          const pathParts = relativePath.split(path.sep);

          episodes.push({
            path: relativePath,
            series: pathParts[1] || 'unknown',
            episode: entry.name,
            metadata: metadata
          });
        } catch {
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

/**
 * Get episode by series and episode name
 */
export async function getEpisode(series: string, episode: string): Promise<Episode | null> {
  const episodePath = path.join(SERIES_DIR, series, episode);
  const metadataPath = path.join(episodePath, 'metadata.yml');

  try {
    await fs.access(episodePath);
    const metadata = await readYamlFile<EpisodeMetadata>(metadataPath);

    // Get list of files
    const fileEntries = await fs.readdir(episodePath, { withFileTypes: true });
    const files: FileInfo[] = await Promise.all(
      fileEntries.map(async (entry) => {
        const filePath = path.join(episodePath, entry.name);
        const stats = await fs.stat(filePath);
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          size: stats.size,
          modified: stats.mtime,
          ext: path.extname(entry.name).toLowerCase()
        };
      })
    );

    return {
      path: path.relative(BASE_DIR, episodePath),
      series,
      episode,
      metadata,
      files
    };
  } catch {
    return null;
  }
}

/**
 * Get the release queue
 */
export async function getReleaseQueue(): Promise<ReleaseQueue> {
  try {
    return await readYamlFile<ReleaseQueue>(RELEASE_QUEUE_PATH);
  } catch {
    return {
      release_groups: {},
      staged: [],
      blocked: [],
      released: []
    };
  }
}

/**
 * Get the metadata template
 */
export async function getMetadataTemplate(): Promise<EpisodeMetadata> {
  try {
    const templatePath = path.join(TEMPLATES_DIR, 'metadata-template.yml');
    const content = await fs.readFile(templatePath, 'utf8');
    return yaml.load(content) as EpisodeMetadata || getDefaultMetadata();
  } catch {
    return getDefaultMetadata();
  }
}

/**
 * Default metadata template
 */
function getDefaultMetadata(): EpisodeMetadata {
  return {
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

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}
