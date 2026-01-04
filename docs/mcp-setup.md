# MCP Server Setup Guide

This guide shows you how to connect the Content Workflow Toolkit to AI assistants using the Model Context Protocol (MCP).

## What is MCP?

MCP (Model Context Protocol) allows AI assistants like Claude to interact directly with your content workflow. Instead of describing what you want, the AI can actually create episodes, track workflow progress, manage releases, and generate content descriptions.

## Prerequisites

- Node.js 18 or higher
- Content Workflow Toolkit installed
- Claude Desktop or another MCP-compatible client

## Installation

### 1. Build the MCP Server

```bash
cd content-workflow-toolkit/mcp-server
npm install
npm run build
```

### 2. Configure Claude Desktop

Find your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the content-workflow server:

```json
{
  "mcpServers": {
    "content-workflow": {
      "command": "node",
      "args": ["/Users/yourname/path/to/content-workflow-toolkit/mcp-server/dist/index.js"]
    }
  }
}
```

**Replace the path with your actual installation location.**

### 3. Restart Claude Desktop

After saving the config, fully quit and restart Claude Desktop for the changes to take effect.

## Verify Installation

Ask Claude: "What content workflow tools do you have access to?"

Claude should list the available tools including create_episode, list_episodes, get_pipeline_status, etc.

## Available Tools

### Content Management (6 tools)
| Tool | Description |
|------|-------------|
| `create_episode` | Create a new episode folder with metadata and templates |
| `update_episode_metadata` | Update episode metadata fields |
| `get_episode` | Get episode details and file list |
| `list_episodes` | List all episodes (optionally filtered) |
| `create_series` | Create a new series folder |
| `list_series` | List all available series |

### Asset Management (5 tools)
| Tool | Description |
|------|-------------|
| `list_assets` | Browse the shared assets directory |
| `get_asset_info` | Get detailed info about an asset |
| `create_asset_folder` | Create a new asset folder |
| `move_asset` | Move or rename assets |
| `delete_asset` | Delete empty folders |

### Release Management (3 tools)
| Tool | Description |
|------|-------------|
| `get_release_queue` | View the release schedule |
| `update_release_status` | Change episode status |
| `schedule_release` | Schedule an episode for release |

### Workflow (2 tools)
| Tool | Description |
|------|-------------|
| `update_workflow_progress` | Mark workflow stages complete |
| `get_pipeline_status` | Overview of all content by status |

### Content Generation (2 tools)
| Tool | Description |
|------|-------------|
| `generate_description` | Create YouTube description from script |
| `generate_social_posts` | Generate platform-specific social posts |

## Example Workflows

### Starting a New Video

```
You: Create a new episode about "Building MCP Servers" in the tutorials series

Claude: I'll create that episode for you...
[Uses create_episode tool]
Created: series/tutorials/2025-01-03-building-mcp-servers/
- metadata.yml
- script.md
- notes.md
```

### Checking Pipeline Status

```
You: What's the status of our content pipeline?

Claude: Let me check the pipeline...
[Uses get_pipeline_status tool]

Pipeline Status:
- Draft: 3 episodes
- Ready: 2 episodes
- Staged: 1 episode
- Released: 15 episodes
```

### Generating Social Media Posts

```
You: Generate social posts for the intro episode

Claude: I'll generate platform-specific posts...
[Uses generate_social_posts tool]

LinkedIn:
Just published: "Introduction to Content Workflow"
Key takeaways:
- Organize your content pipeline
- Track workflow progress
- Automate repetitive tasks

Bluesky (300 chars):
New: Introduction to Content Workflow...

Threads:
new video just dropped 🎬
Introduction to Content Workflow
```

### Managing Releases

```
You: Schedule the getting-started episode for next Monday

Claude: I'll schedule that release...
[Uses schedule_release tool]

Scheduled: series/tutorials/2025-01-01-getting-started
Release date: 2025-01-06
```

## Tips for Best Results

1. **Be specific** - "Create an episode about X in the Y series" works better than "make a new video"

2. **Use series names** - The tools work with series/episode structure, so reference them directly

3. **Chain requests** - "Create an episode, then mark it as scripted" works well

4. **Ask for status** - "What episodes are in draft?" helps you track progress

## Troubleshooting

### "No tools available"

- Restart Claude Desktop after config changes
- Verify the path in config is absolute and correct
- Check that `dist/index.js` exists (run `npm run build`)

### "Episode not found"

- Use the exact folder name (e.g., `2025-01-01-getting-started`)
- Check the series name matches exactly
- Use `list_episodes` to see available episodes

### Permission errors

- Ensure you have read/write access to the toolkit directory
- Check the series and assets folders exist

## Advanced: Multiple MCP Servers

You can run multiple MCP servers alongside content-workflow:

```json
{
  "mcpServers": {
    "content-workflow": {
      "command": "node",
      "args": ["/path/to/content-workflow-toolkit/mcp-server/dist/index.js"]
    },
    "other-server": {
      "command": "...",
      "args": ["..."]
    }
  }
}
```

## Further Reading

- [MCP Server Technical Reference](../mcp-server/README.md)
- [Automation Tools Guide](./automation-tools.md)
- [Workflow Guide](./workflow-guide.md)
