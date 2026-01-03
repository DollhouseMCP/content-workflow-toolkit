# Content Workflow MCP Server

An MCP (Model Context Protocol) server that allows AI assistants to interact with the Content Workflow Toolkit. This enables AI-assisted content management, release scheduling, workflow tracking, and content generation.

## Quick Start

```bash
# Install dependencies
cd mcp-server
npm install

# Build the TypeScript
npm run build

# The server is ready - configure your MCP client (see below)
```

## Features

### Content Management
- **create_episode** - Create new episode folders with metadata, scripts, and notes
- **update_episode_metadata** - Update episode metadata fields
- **get_episode** - Get episode details including file list
- **list_episodes** - List all episodes with optional filtering
- **create_series** - Create a new series folder with configuration
- **list_series** - List all available series

### Asset Management
- **list_assets** - List assets in the shared assets directory
- **get_asset_info** - Get detailed information about a specific asset
- **create_asset_folder** - Create a new folder in assets
- **move_asset** - Move or rename an asset
- **delete_asset** - Delete an empty asset folder

### Release Management
- **get_release_queue** - Get contents of the release queue
- **update_release_status** - Update episode content status
- **schedule_release** - Add episodes to the release queue

### Workflow Tracking
- **update_workflow_progress** - Update workflow stage checkboxes
- **get_pipeline_status** - Get summary of all content by status

### Content Generation
- **generate_description** - Generate YouTube description from script (extracts timestamps and key points)
- **generate_social_posts** - Generate platform-specific social media posts (Twitter, LinkedIn, Bluesky, Threads)

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "content-workflow": {
      "command": "node",
      "args": ["/absolute/path/to/content-workflow-toolkit/mcp-server/dist/index.js"]
    }
  }
}
```

**Important:** Use the absolute path to your content-workflow-toolkit installation.

### Claude Code CLI

The MCP server works automatically when run from within the content-workflow-toolkit directory.

### Other MCP Clients

The server communicates via stdio and is compatible with any MCP-compliant client. Run:

```bash
node /path/to/content-workflow-toolkit/mcp-server/dist/index.js
```

## Example Prompts

Once configured, try these prompts with your AI assistant:

### Content Management
- "List all episodes in draft status"
- "Create a new episode about 'Getting Started' in the merview series"
- "Show me the details for the latest merview episode"
- "What series do we have?"

### Workflow Tracking
- "What's the current pipeline status?"
- "Mark the intro episode as recorded"
- "What episodes are ready but not yet staged?"

### Release Management
- "What's scheduled for release this week?"
- "Schedule the getting-started episode for next Monday"
- "Show me the release queue"

### Content Generation
- "Generate a YouTube description for the intro episode"
- "Create social media posts for the getting-started episode"
- "Generate Twitter and LinkedIn posts for the latest video"

### Asset Management
- "List all assets in the thumbnails folder"
- "Create a new folder called 'backgrounds' in assets"

## Development

```bash
# Build the project
npm run build

# Watch for changes during development
npm run watch

# Build and run
npm run dev

# Clean build artifacts
npm run clean
```

## Tool Reference

### create_episode

Creates a new episode folder with metadata, script, and notes files.

**Parameters:**
- `series` (required) - The name of the series
- `topic` (required) - The topic/slug for the episode (will be slugified)
- `title` (required) - The full title of the episode
- `description` (optional) - Description for the episode

**Example:**
```json
{
  "series": "merview",
  "topic": "Getting Started",
  "title": "Getting Started with Merview",
  "description": "Learn how to set up and use Merview"
}
```

### create_series

Creates a new series folder with configuration files.

**Parameters:**
- `name` (required) - The series name (letters, numbers, spaces, hyphens, underscores)
- `description` (optional) - Description of the series
- `template` (optional) - Template type to use

**Example:**
```json
{
  "name": "tutorials",
  "description": "Step-by-step tutorial videos"
}
```

### list_series

Lists all available series with their metadata.

**Parameters:** None

### update_episode_metadata

Updates fields in an episode's metadata.yml file.

**Parameters:**
- `series` (required) - The series name
- `episode` (required) - The episode folder name
- `updates` (required) - Object containing fields to update

**Example:**
```json
{
  "series": "merview",
  "episode": "2025-01-01-getting-started",
  "updates": {
    "content_status": "ready",
    "workflow": {
      "scripted": true,
      "recorded": true
    }
  }
}
```

### get_episode

Returns episode details including metadata and file list.

**Parameters:**
- `series` (required) - The series name
- `episode` (required) - The episode folder name

### list_episodes

Lists all episodes with their metadata.

**Parameters:**
- `status` (optional) - Filter by content status (draft, ready, staged, released)
- `series` (optional) - Filter by series name

### list_assets

Lists assets in the shared assets directory.

**Parameters:**
- `path` (optional) - Subdirectory path to list (e.g., "thumbnails/backgrounds")
- `type` (optional) - Filter by asset type: "image", "video", "audio", "document", "all"

### get_asset_info

Gets detailed information about a specific asset.

**Parameters:**
- `path` (required) - Path to the asset relative to assets directory

### create_asset_folder

Creates a new folder in the assets directory.

**Parameters:**
- `path` (optional) - Parent folder path (defaults to assets root)
- `name` (required) - Name of the new folder

### move_asset

Moves or renames an asset.

**Parameters:**
- `source` (required) - Current path relative to assets directory
- `destination` (required) - New path relative to assets directory

### delete_asset

Deletes an empty folder from assets directory.

**Parameters:**
- `path` (required) - Path to the folder relative to assets directory

**Note:** Only empty folders can be deleted for safety.

### get_release_queue

Returns the contents of release-queue.yml.

**Parameters:** None

### update_release_status

Updates the content_status field in an episode's metadata.

**Parameters:**
- `path` (required) - Path to the episode
- `status` (required) - New status (draft, ready, staged, released)

### schedule_release

Adds an episode to the release queue with a target date.

**Parameters:**
- `path` (required) - Path to the episode
- `date` (required) - Target release date (YYYY-MM-DD or ISO format)
- `group` (optional) - Release group ID to associate with

### update_workflow_progress

Updates a workflow stage checkbox.

**Parameters:**
- `series` (required) - The series name
- `episode` (required) - The episode folder name
- `stage` (required) - The workflow stage (scripted, recorded, edited, thumbnail_created, uploaded, published)
- `complete` (required) - Whether the stage is complete

### get_pipeline_status

Returns a summary of all content organized by status.

**Parameters:** None

### generate_description

Generates a YouTube/video description from the episode's script.md file.

**Parameters:**
- `series` (required) - The series name
- `episode` (required) - The episode folder name

**Returns:** Description text with key points and timestamps extracted from the script.

### generate_social_posts

Generates social media posts optimized for each platform.

**Parameters:**
- `series` (required) - The series name
- `episode` (required) - The episode folder name
- `platforms` (optional) - Array of platforms: "twitter", "linkedin", "bluesky", "threads" (defaults to all)

**Returns:** Platform-specific posts with appropriate character limits and tone.

## Troubleshooting

### Server won't start

1. Ensure Node.js 18+ is installed: `node --version`
2. Rebuild: `npm run clean && npm install && npm run build`
3. Check the path in your MCP client config is absolute and correct

### Tools not appearing in Claude Desktop

1. Restart Claude Desktop after config changes
2. Check config file syntax (valid JSON)
3. Verify the path points to `dist/index.js` (not `src/index.ts`)

### Permission errors

Ensure you have read/write access to the content-workflow-toolkit directory.

### Debug logging

The server logs to stderr. When running directly:
```bash
node dist/index.js 2>&1 | tee server.log
```

## License

AGPL-3.0 - See LICENSE in the project root.
