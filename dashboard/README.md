# Content Workflow Dashboard

Web-based dashboard for managing content workflow, episodes, releases, and assets.

## Features

- **Episodes View**: Browse all episodes with metadata
- **Release Queue**: Manage coordinated releases and staging
- **Assets**: Browse media files and assets
- **Distribution**: View platform distribution profiles
- **Live Reload**: Auto-refresh when content changes

## Installation

```bash
cd dashboard
npm install
```

## Usage

Start the dashboard server:

```bash
npm start
```

The dashboard will be available at http://localhost:3000

## API Endpoints

- `GET /api/episodes` - List all episodes with metadata
- `GET /api/episodes/:series/:episode` - Get single episode details
- `GET /api/releases` - Get release queue data
- `GET /api/distribution` - Get distribution profiles
- `GET /api/assets` - Get asset folder structure
- `GET /api/health` - Health check endpoint
- `GET /api/events` - Server-Sent Events for live reload

## Media Files

Media files are served from:

- `/media/series/*` - Series content files
- `/media/assets/*` - Asset files

## File Watching

The server watches the following for changes:

- `series/` directory
- `release-queue.yml`
- `distribution-profiles.yml`

When changes are detected, connected clients are notified via Server-Sent Events.

## Technology Stack

- **Backend**: Node.js + Express
- **YAML Parsing**: js-yaml
- **File Watching**: chokidar
- **Frontend**: Vanilla JavaScript (no framework)
- **Styling**: Custom CSS with dark theme
