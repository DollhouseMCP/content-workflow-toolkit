#!/usr/bin/env node

/**
 * Content Workflow MCP Server
 *
 * An MCP server that allows AI assistants to interact with the content workflow toolkit.
 * Provides tools for content management, release scheduling, and workflow tracking.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

// Import tool implementations
import {
  createEpisode,
  updateEpisodeMetadata,
  getEpisodeDetails,
  listEpisodes,
  createSeries,
  listSeries
} from './tools/content.js';
import {
  getReleaseQueueContents,
  updateReleaseStatus,
  scheduleRelease
} from './tools/release.js';
import {
  updateWorkflowProgress,
  getPipelineStatus
} from './tools/workflow.js';
import {
  generateDescription,
  generateSocialPosts
} from './tools/generation.js';
import {
  listAssets,
  getAssetInfo,
  createAssetFolder,
  moveAsset,
  deleteAsset
} from './tools/assets.js';

// Define the available tools
const tools: Tool[] = [
  // Content Management Tools
  {
    name: 'create_episode',
    description: 'Creates a new episode folder with metadata, script, and notes files. Returns the created episode details.',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'string',
          description: 'The name of the series (e.g., "merview", "dollhouse-mcp")'
        },
        topic: {
          type: 'string',
          description: 'The topic/slug for the episode (will be slugified)'
        },
        title: {
          type: 'string',
          description: 'The full title of the episode'
        },
        description: {
          type: 'string',
          description: 'Optional description for the episode'
        }
      },
      required: ['series', 'topic', 'title']
    }
  },
  {
    name: 'update_episode_metadata',
    description: 'Updates fields in an episode\'s metadata.yml file',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'string',
          description: 'The series name'
        },
        episode: {
          type: 'string',
          description: 'The episode folder name (e.g., "2025-01-01-my-episode")'
        },
        updates: {
          type: 'object',
          description: 'Object containing the fields to update (title, description, content_status, tags, workflow, release)',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            content_status: {
              type: 'string',
              enum: ['draft', 'ready', 'staged', 'released']
            },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            workflow: {
              type: 'object',
              properties: {
                scripted: { type: 'boolean' },
                recorded: { type: 'boolean' },
                edited: { type: 'boolean' },
                thumbnail_created: { type: 'boolean' },
                uploaded: { type: 'boolean' },
                published: { type: 'boolean' }
              }
            },
            release: {
              type: 'object',
              properties: {
                target_date: { type: 'string' },
                release_group: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          }
        }
      },
      required: ['series', 'episode', 'updates']
    }
  },
  {
    name: 'get_episode',
    description: 'Returns episode details including metadata and file list',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'string',
          description: 'The series name'
        },
        episode: {
          type: 'string',
          description: 'The episode folder name'
        }
      },
      required: ['series', 'episode']
    }
  },
  {
    name: 'list_episodes',
    description: 'Lists all episodes with their metadata. Optionally filter by status or series.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by content status (draft, ready, staged, released)',
          enum: ['draft', 'ready', 'staged', 'released']
        },
        series: {
          type: 'string',
          description: 'Filter by series name'
        }
      }
    }
  },
  {
    name: 'create_series',
    description: 'Creates a new series folder with metadata (series.yml) and README. Returns the created series details.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the series (e.g., "AI Tools Review", "Tutorial Series")'
        },
        description: {
          type: 'string',
          description: 'Optional description for the series'
        },
        template: {
          type: 'string',
          description: 'Optional template type (default, tutorial, vlog, podcast, etc.)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'list_series',
    description: 'Lists all series with their metadata.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // Release Management Tools
  {
    name: 'get_release_queue',
    description: 'Returns the contents of release-queue.yml including release groups, staged, blocked, and released content',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'update_release_status',
    description: 'Updates the content_status field in an episode\'s metadata',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the episode (e.g., "series/merview/2025-01-01-intro" or "merview/2025-01-01-intro")'
        },
        status: {
          type: 'string',
          description: 'New status value',
          enum: ['draft', 'ready', 'staged', 'released']
        }
      },
      required: ['path', 'status']
    }
  },
  {
    name: 'schedule_release',
    description: 'Adds an episode to the release queue with a target date',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the episode'
        },
        date: {
          type: 'string',
          description: 'Target release date (YYYY-MM-DD or ISO format)'
        },
        group: {
          type: 'string',
          description: 'Optional release group ID to associate with'
        }
      },
      required: ['path', 'date']
    }
  },

  // Workflow Tools
  {
    name: 'update_workflow_progress',
    description: 'Updates a workflow stage checkbox (scripted, recorded, edited, thumbnail_created, uploaded, published)',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'string',
          description: 'The series name'
        },
        episode: {
          type: 'string',
          description: 'The episode folder name'
        },
        stage: {
          type: 'string',
          description: 'The workflow stage to update',
          enum: ['scripted', 'recorded', 'edited', 'thumbnail_created', 'uploaded', 'published']
        },
        complete: {
          type: 'boolean',
          description: 'Whether the stage is complete (true) or not (false)'
        }
      },
      required: ['series', 'episode', 'stage', 'complete']
    }
  },
  {
    name: 'get_pipeline_status',
    description: 'Returns a summary of all content organized by status (draft, ready, staged, released, blocked)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // Asset Management Tools
  {
    name: 'list_assets',
    description: 'Lists assets in the assets directory. Optionally filter by path or type.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional subdirectory path (e.g., "branding", "music")'
        },
        type: {
          type: 'string',
          description: 'Optional filter by type (image, video, audio, document)',
          enum: ['image', 'video', 'audio', 'document']
        }
      }
    }
  },
  {
    name: 'get_asset_info',
    description: 'Returns detailed information about a specific asset including size, type, and modification date.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the asset relative to assets directory'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'create_asset_folder',
    description: 'Creates a new folder in the assets directory.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_path: {
          type: 'string',
          description: 'Parent folder path (empty string for assets root)'
        },
        name: {
          type: 'string',
          description: 'Name for the new folder'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'move_asset',
    description: 'Moves or renames an asset or folder.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Current path of the asset'
        },
        destination: {
          type: 'string',
          description: 'New path for the asset'
        }
      },
      required: ['source', 'destination']
    }
  },
  {
    name: 'delete_asset',
    description: 'Deletes an asset file or empty folder.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the asset to delete'
        }
      },
      required: ['path']
    }
  },

  // Content Generation Tools
  {
    name: 'generate_description',
    description: 'Generates a YouTube/video description from the episode script.md file. Extracts key points and timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'string',
          description: 'The series name'
        },
        episode: {
          type: 'string',
          description: 'The episode folder name'
        }
      },
      required: ['series', 'episode']
    }
  },
  {
    name: 'generate_social_posts',
    description: 'Generates social media posts for an episode. Creates platform-appropriate content for Twitter, LinkedIn, Bluesky, and Threads.',
    inputSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'string',
          description: 'The series name'
        },
        episode: {
          type: 'string',
          description: 'The episode folder name'
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of platforms to generate for (twitter, linkedin, bluesky, threads). Defaults to all.'
        }
      },
      required: ['series', 'episode']
    }
  }
];

// Create the server
const server = new Server(
  {
    name: 'content-workflow-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Content Management
      case 'create_episode': {
        const { series, topic, title, description } = args as {
          series: string;
          topic: string;
          title: string;
          description?: string;
        };
        const result = await createEpisode(series, topic, title, description);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'update_episode_metadata': {
        const { series, episode, updates } = args as {
          series: string;
          episode: string;
          updates: Record<string, unknown>;
        };
        const result = await updateEpisodeMetadata(series, episode, updates);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'get_episode': {
        const { series, episode } = args as { series: string; episode: string };
        const result = await getEpisodeDetails(series, episode);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'list_episodes': {
        const filter = args as { status?: string; series?: string } | undefined;
        const result = await listEpisodes(filter);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'create_series': {
        const { name, description, template } = args as {
          name: string;
          description?: string;
          template?: string;
        };
        const result = await createSeries(name, description, template);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'list_series': {
        const result = await listSeries();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      // Release Management
      case 'get_release_queue': {
        const result = await getReleaseQueueContents();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'update_release_status': {
        const { path, status } = args as { path: string; status: string };
        const result = await updateReleaseStatus(path, status);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'schedule_release': {
        const { path, date, group } = args as {
          path: string;
          date: string;
          group?: string;
        };
        const result = await scheduleRelease(path, date, group);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      // Workflow
      case 'update_workflow_progress': {
        const { series, episode, stage, complete } = args as {
          series: string;
          episode: string;
          stage: string;
          complete: boolean;
        };
        const result = await updateWorkflowProgress(series, episode, stage, complete);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'get_pipeline_status': {
        const result = await getPipelineStatus();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      // Asset Management
      case 'list_assets': {
        const { path: assetPath, type } = args as { path?: string; type?: string };
        const result = await listAssets(assetPath, type);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'get_asset_info': {
        const { path: assetPath } = args as { path: string };
        const result = await getAssetInfo(assetPath);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'create_asset_folder': {
        const { parent_path, name } = args as { parent_path?: string; name: string };
        const result = await createAssetFolder(parent_path || '', name);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'move_asset': {
        const { source, destination } = args as { source: string; destination: string };
        const result = await moveAsset(source, destination);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'delete_asset': {
        const { path: assetPath } = args as { path: string };
        const result = await deleteAsset(assetPath);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      // Content Generation (stubs)
      case 'generate_description': {
        const { series, episode } = args as { series: string; episode: string };
        const result = await generateDescription(series, episode);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'generate_social_posts': {
        const { series, episode, platforms } = args as {
          series: string;
          episode: string;
          platforms?: string[];
        };
        const result = await generateSocialPosts(series, episode, platforms);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Content Workflow MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
