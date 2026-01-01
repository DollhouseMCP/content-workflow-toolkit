import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import apiRoutes from './api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve content files from series and assets directories
app.use('/content/series', express.static(path.join(__dirname, '../series')));
app.use('/content/assets', express.static(path.join(__dirname, '../assets')));

// API routes
app.use('/api', apiRoutes);

// SPA fallback - serve index.html for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
  console.log('Watching for content changes...');
});

// File watcher for live reload
const watcher = chokidar.watch([
  path.join(__dirname, '../series'),
  path.join(__dirname, '../release-queue.yml'),
  path.join(__dirname, '../distribution-profiles.yml')
], {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

// Store connected SSE clients for live reload
const clients = [];

// SSE endpoint for live reload
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add this client to the list
  clients.push(res);

  // Remove client when connection closes
  req.on('close', () => {
    const index = clients.indexOf(res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

// Watch for file changes and notify clients
watcher.on('change', (filepath) => {
  console.log(`File changed: ${filepath}`);
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify({ type: 'reload', file: filepath })}\n\n`);
  });
});

watcher.on('add', (filepath) => {
  console.log(`File added: ${filepath}`);
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify({ type: 'reload', file: filepath })}\n\n`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  watcher.close();
  server.close(() => {
    console.log('HTTP server closed');
  });
});
