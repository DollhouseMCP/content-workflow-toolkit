# Content Workflow Toolkit

Open-source toolkit for content creators: dashboard, automation scripts, and workflow templates for YouTube and media production.

## Overview

This toolkit provides everything you need to manage a solo content creation workflow:

- **Dashboard**: Local web interface for managing content pipeline
- **Scripts**: Automation for episode setup and transcription
- **Templates**: Reusable templates for scripts, metadata, and social posts
- **Checklists**: Step-by-step guides for each production phase

## Quick Start

### Dashboard

```bash
cd dashboard
npm install
npm start
```

Open http://localhost:3000 to view the content management dashboard.

### Create New Episode

```bash
./scripts/new-episode.sh [series-name] [topic]
```

### Transcribe Video

```bash
pip install -r requirements.txt
python scripts/transcribe.py path/to/video.mp4
```

## Structure

```
content-workflow-toolkit/
├── dashboard/              # Web-based content management UI
│   ├── server.js           # Express server
│   ├── api/                # API endpoints
│   └── public/             # Frontend (HTML/CSS/JS)
├── scripts/                # Automation scripts
│   ├── new-episode.sh      # Create episode folders
│   └── transcribe.py       # Whisper-based transcription
├── templates/              # Reusable templates
│   ├── script-template.md
│   ├── metadata-template.yml
│   ├── description-template.md
│   ├── social-posts-template.md
│   └── blog-post-template.md
├── checklists/             # Production checklists
│   ├── pre-production.md
│   ├── production.md
│   ├── post-production.md
│   ├── distribution.md
│   ├── live-streaming.md
│   └── remote-interview.md
├── docs/                   # Documentation
│   ├── workflow-guide.md   # Complete workflow reference
│   ├── automation-tools.md # Tools and automation guide
│   └── staging-workflow.md # Content staging system
├── distribution-profiles.yml  # Platform distribution presets
└── requirements.txt        # Python dependencies
```

## Dashboard Features

- **Pipeline View**: Kanban board showing content status (draft → ready → staged → released)
- **Episode Cards**: Thumbnails, metadata, and workflow progress at a glance
- **Media Preview**: View videos, audio, and images without leaving the dashboard
- **Asset Browser**: Browse shared assets (intros, outros, music, etc.)
- **Release Queue**: Track coordinated releases and dependencies

## Workflow

```
🧠 AI Collaboration  →  🎬 You Execute  →  ⚙️ Automation
   (Claude/LLMs)          (Record/Edit)      (Transcribe/Upload)
```

1. **Content Development**: Brainstorm and script with AI assistance
2. **Pre-Production**: Set up episode folder, prepare assets
3. **Production**: Record (camera, screen, or live stream)
4. **Post-Production**: Edit, transcribe, create thumbnail
5. **Distribution**: Upload, repurpose, post to social platforms

## Using with Your Content

This toolkit is designed to work alongside a private content repository:

```
your-content/           # Private repo - your actual content
├── series/             # Video projects
├── assets/             # Branding, intros, outros
└── release-queue.yml   # Your release schedule

content-workflow-toolkit/  # This repo - the tools
├── dashboard/
├── scripts/
└── ...
```

Configure the dashboard to point to your content directory by setting the `CONTENT_DIR` environment variable.

## Contributing

Contributions welcome! Please open an issue or PR.

## License

AGPL 3.0
