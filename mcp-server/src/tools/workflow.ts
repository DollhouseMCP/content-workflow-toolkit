// Workflow Tools for the MCP Server

import path from 'path';
import {
  SERIES_DIR,
  scanForEpisodes,
  getReleaseQueue,
  readYamlFile,
  writeYamlFile
} from '../utils.js';
import type {
  EpisodeMetadata,
  Episode,
  PipelineStatus,
  WorkflowStage,
  VALID_WORKFLOW_STAGES
} from '../types.js';

const WORKFLOW_STAGES: WorkflowStage[] = [
  'scripted',
  'recorded',
  'edited',
  'thumbnail_created',
  'uploaded',
  'published'
];

/**
 * Update workflow progress (checkboxes) for an episode
 */
export async function updateWorkflowProgress(
  series: string,
  episode: string,
  stage: string,
  complete: boolean
): Promise<{ success: boolean; workflow?: Record<string, boolean>; error?: string }> {
  try {
    // Validate stage
    if (!WORKFLOW_STAGES.includes(stage as WorkflowStage)) {
      return {
        success: false,
        error: `Invalid workflow stage. Must be one of: ${WORKFLOW_STAGES.join(', ')}`
      };
    }

    // Validate path parameters
    if (series.includes('..') || series.includes('/') || series.includes('\\') ||
        episode.includes('..') || episode.includes('/') || episode.includes('\\')) {
      return { success: false, error: 'Invalid series or episode name' };
    }

    const metadataPath = path.join(SERIES_DIR, series, episode, 'metadata.yml');

    // Verify path is within series directory
    const resolvedPath = path.resolve(metadataPath);
    const resolvedSeriesDir = path.resolve(SERIES_DIR) + path.sep;
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      return { success: false, error: 'Invalid path detected' };
    }

    // Read existing metadata
    let metadata: EpisodeMetadata;
    try {
      metadata = await readYamlFile<EpisodeMetadata>(metadataPath);
    } catch {
      return { success: false, error: 'Episode not found' };
    }

    // Update workflow
    if (!metadata.workflow) {
      metadata.workflow = {
        scripted: false,
        recorded: false,
        edited: false,
        thumbnail_created: false,
        uploaded: false,
        published: false
      };
    }

    metadata.workflow[stage as WorkflowStage] = complete;

    // Write updated metadata
    await writeYamlFile(metadataPath, metadata);

    return { success: true, workflow: metadata.workflow };

  } catch (error) {
    return {
      success: false,
      error: `Failed to update workflow: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get summary of all content by status (pipeline view)
 */
export async function getPipelineStatus(): Promise<{
  success: boolean;
  data?: PipelineStatus;
  error?: string;
}> {
  try {
    // Get all episodes
    const episodes = await scanForEpisodes(SERIES_DIR);

    // Get release queue for blocked items
    const releaseQueue = await getReleaseQueue();

    // Categorize episodes by status
    const pipeline: PipelineStatus = {
      draft: [],
      ready: [],
      staged: [],
      released: [],
      blocked: releaseQueue.blocked || [],
      total: episodes.length
    };

    for (const episode of episodes) {
      const status = episode.metadata.content_status || 'draft';
      if (status === 'draft') {
        pipeline.draft.push(episode);
      } else if (status === 'ready') {
        pipeline.ready.push(episode);
      } else if (status === 'staged') {
        pipeline.staged.push(episode);
      } else if (status === 'released') {
        pipeline.released.push(episode);
      }
    }

    return { success: true, data: pipeline };

  } catch (error) {
    return {
      success: false,
      error: `Failed to get pipeline status: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
