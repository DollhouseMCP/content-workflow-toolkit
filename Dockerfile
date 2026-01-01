# Content Workflow Toolkit Dashboard
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm install --omit=dev

# Copy application code
COPY dashboard/ ./dashboard/
COPY templates/ ./templates/
COPY scripts/ ./scripts/
COPY distribution-profiles.yml ./
COPY release-queue.yml* ./

# Create directories for content (will be mounted as volumes)
RUN mkdir -p /app/series /app/assets

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the dashboard port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the dashboard server
WORKDIR /app/dashboard
CMD ["node", "server.js"]
