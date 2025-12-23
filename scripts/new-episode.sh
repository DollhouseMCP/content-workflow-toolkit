#!/bin/bash
# Creates a new episode folder with templates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <series-name> <episode-topic>"
    echo "Example: $0 dollhouse-mcp getting-started"
    exit 1
fi

SERIES="$1"
TOPIC="$2"
DATE=$(date +%Y-%m-%d)
EPISODE_DIR="$REPO_ROOT/series/$SERIES/$DATE-$TOPIC"

# Check if series folder exists
if [ ! -d "$REPO_ROOT/series/$SERIES" ]; then
    echo "Creating new series folder: $SERIES"
    mkdir -p "$REPO_ROOT/series/$SERIES"
fi

# Check if episode already exists
if [ -d "$EPISODE_DIR" ]; then
    echo "Error: Episode folder already exists: $EPISODE_DIR"
    exit 1
fi

echo "Creating episode: $EPISODE_DIR"

# Create episode structure
mkdir -p "$EPISODE_DIR"/{raw/{camera,screen},audio,assets,exports}

# Copy templates
cp "$REPO_ROOT/templates/script-template.md" "$EPISODE_DIR/script.md"
cp "$REPO_ROOT/templates/metadata-template.yml" "$EPISODE_DIR/metadata.yml"

# Create notes file
cat > "$EPISODE_DIR/notes.md" << EOF
# Episode Notes: $TOPIC

**Series**: $SERIES
**Date Created**: $DATE

## Ideas & Research


## Recording Notes


## Edit Notes


## Post-Publish Notes


## Analytics

| Metric | 24h | 7d | 30d |
|--------|-----|-----|-----|
| Views | | | |
| CTR | | | |
| Avg Duration | | | |

EOF

# Update metadata with basic info
sed -i '' "s/name: \"\"/name: \"$SERIES\"/" "$EPISODE_DIR/metadata.yml" 2>/dev/null || true
sed -i '' "s/date: \"\"/date: \"$DATE\"/" "$EPISODE_DIR/metadata.yml" 2>/dev/null || true

echo ""
echo "Episode created successfully!"
echo ""
echo "Next steps:"
echo "  1. Edit script.md with your content"
echo "  2. Fill in metadata.yml"
echo "  3. Run pre-production checklist"
echo ""
echo "Location: $EPISODE_DIR"
