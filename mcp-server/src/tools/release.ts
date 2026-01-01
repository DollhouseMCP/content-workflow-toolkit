// Release Management Tools for the MCP Server

import path from 'path';
import {
  SERIES_DIR,
  getReleaseQueue,
  readYamlFile,
  writeYamlFile,
  RELEASE_QUEUE_PATH
} from '../utils.js';
import type { ReleaseQueue, ReleaseQueueItem, EpisodeMetadata } from '../types.js';

/**
 * Get the contents of release-queue.yml
 */
export async function getReleaseQueueContents(): Promise<{
  success: boolean;
  data?: ReleaseQueue;
  error?: string;
}> {
  try {
    const releaseQueue = await getReleaseQueue();
    return { success: true, data: releaseQueue };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get release queue: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Update the content_status in an episode's metadata
 */
export async function updateReleaseStatus(
  episodePath: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate status
    const validStatuses = ['draft', 'ready', 'staged', 'released'];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      };
    }

    // Validate path (prevent traversal)
    if (episodePath.includes('..')) {
      return { success: false, error: 'Invalid path' };
    }

    // Construct the metadata path
    // The path can be relative like "series/sample-series/2025-01-01-episode"
    // or just "sample-series/2025-01-01-episode"
    let metadataPath: string;
    if (episodePath.startsWith('series/')) {
      metadataPath = path.join(SERIES_DIR, '..', episodePath, 'metadata.yml');
    } else {
      metadataPath = path.join(SERIES_DIR, episodePath, 'metadata.yml');
    }

    // Read and update metadata
    const metadata = await readYamlFile<EpisodeMetadata>(metadataPath);
    metadata.content_status = status as EpisodeMetadata['content_status'];

    await writeYamlFile(metadataPath, metadata);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update release status: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Add an episode to the release queue with a target date
 */
export async function scheduleRelease(
  episodePath: string,
  targetDate: string,
  releaseGroup?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate date format (YYYY-MM-DD or ISO)
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T[\d:.-]+Z?)?$/;
    if (!dateRegex.test(targetDate)) {
      return {
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD or ISO format.'
      };
    }

    // Validate path
    if (episodePath.includes('..')) {
      return { success: false, error: 'Invalid path' };
    }

    // Read current release queue
    const releaseQueue = await getReleaseQueue();

    // Normalize the path format
    const normalizedPath = episodePath.startsWith('series/')
      ? episodePath
      : `series/${episodePath}`;

    // Check if already in staged
    if (!releaseQueue.staged) {
      releaseQueue.staged = [];
    }

    const existingIndex = releaseQueue.staged.findIndex(item => item.path === normalizedPath);

    const newItem: ReleaseQueueItem = {
      path: normalizedPath,
      status: 'staged',
      target_date: targetDate,
      distribution: 'full',
      notes: ''
    };

    if (existingIndex >= 0) {
      // Update existing entry
      releaseQueue.staged[existingIndex] = {
        ...releaseQueue.staged[existingIndex],
        ...newItem
      };
    } else {
      // Add new entry
      releaseQueue.staged.push(newItem);
    }

    // If release group specified, also add to the group
    if (releaseGroup) {
      if (!releaseQueue.release_groups) {
        releaseQueue.release_groups = {};
      }

      if (releaseQueue.release_groups[releaseGroup]) {
        // Add to existing group if not already there
        const group = releaseQueue.release_groups[releaseGroup];
        const alreadyInGroup = group.items.some(item => item.path === normalizedPath);
        if (!alreadyInGroup) {
          group.items.push({
            path: normalizedPath,
            type: 'youtube',
            distribution: 'full'
          });
        }
      }
    }

    // Write updated release queue
    await writeYamlFile(RELEASE_QUEUE_PATH, releaseQueue);

    // Also update the episode metadata
    let metadataPath: string;
    if (episodePath.startsWith('series/')) {
      metadataPath = path.join(SERIES_DIR, '..', episodePath, 'metadata.yml');
    } else {
      metadataPath = path.join(SERIES_DIR, episodePath, 'metadata.yml');
    }

    try {
      const metadata = await readYamlFile<EpisodeMetadata>(metadataPath);
      metadata.content_status = 'staged';
      metadata.release = metadata.release || {};
      metadata.release.target_date = targetDate;
      if (releaseGroup) {
        metadata.release.release_group = releaseGroup;
      }
      await writeYamlFile(metadataPath, metadata);
    } catch {
      // Episode might not exist yet, just update the queue
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to schedule release: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
