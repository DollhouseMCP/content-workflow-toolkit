# Content Workflow MCP Server

An MCP (Model Context Protocol) server that allows AI assistants to interact with the Content Workflow Toolkit. This enables AI-assisted content management, release scheduling, and workflow tracking.

## Features

### Content Management
- **create_episode** - Create new episode folders with metadata, scripts, and notes
- **update_episode_metadata** - Update episode metadata fields
- **get_episode** - Get episode details including file list
- **list_episodes** - List all episodes with optional filtering

### Release Management
- **get_release_queue** - Get contents of the release queue
- **update_release_status** - Update episode content status
- **schedule_release** - Add episodes to the release queue

### Workflow
- **update_workflow_progress** - Update workflow stage checkboxes
- **get_pipeline_status** - Get summary of all content by status

### Content Generation (Stubs)
- **generate_description** - Generate description from script (not implemented)
- **generate_social_posts** - Generate social media posts (not implemented)

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "content-workflow": {
      "command": "node",
      "args": ["/path/to/content-workflow-toolkit/mcp-server/dist/index.js"]
    }
  }
}
```

### Direct Execution

```bash
node dist/index.js
```

The server communicates via stdio, making it compatible with any MCP client.

## Development

```bash
# Build the project
npm run build

# Watch for changes
npm run watch

# Build and run
npm run dev
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

### create_series

Creates a new series folder with metadata and README.

**Parameters:**
- `name` (required) - Series name (e.g., "AI Tools Review")
- `description` (optional) - Series description
- `template` (optional) - Template type: `default`, `tutorial`, `vlog`, `podcast`

**Example:**
```json
{
  "name": "AI Tools Review",
  "description": "Reviews of AI developer tools",
  "template": "tutorial"
}
```

**Note:** Invalid template values will fall back to `default` with a warning in the response.

### list_series

Lists all series with their metadata.

**Parameters:** None

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

## Debugging

### Enable Debug Logging

Set environment variables to enable detailed logging:

```bash
# Option 1: Using DEBUG
DEBUG=true node dist/index.js

# Option 2: Using MCP_DEBUG
MCP_DEBUG=true node dist/index.js
```

Debug logs are written to stderr (to not interfere with MCP stdio communication) and include timestamps:

```
[2025-01-03T07:00:00.000Z] [content:createSeries] Starting series creation {"name":"Test","template":"tutorial"}
[2025-01-03T07:00:00.010Z] [content:createSeries] Series created successfully {"slug":"test","template":"tutorial"}
```

### With Claude Desktop

To enable debugging with Claude Desktop, modify your config:

```json
{
  "mcpServers": {
    "content-workflow": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

Logs will appear in Claude Desktop's developer console or log files.

## License

AGPL-3.0 - See LICENSE in the project root.
