import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import apiRoutes from './api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// Security Middleware
// =============================================================================

// Security Headers Middleware
// Adds recommended security headers to all responses
app.use((req, res, next) => {
  // Prevent XSS attacks by controlling which resources can be loaded
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'"
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Legacy XSS protection for older browsers (deprecated but harmless)
  // Modern browsers use CSP instead; kept for compatibility with older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
});

// Rate Limiting Middleware
// Simple in-memory rate limiter to prevent abuse
// Note: For production behind a proxy, configure app.set('trust proxy', 1)
// and use X-Forwarded-For header validation. See SECURITY.md for details.
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

function rateLimit(req, res, next) {
  // Only apply rate limiting to API routes
  if (!req.path.startsWith('/api')) {
    return next();
  }

  // Use req.ip which respects trust proxy settings when configured
  const clientIP = req.ip || 'unknown';
  const now = Date.now();

  // Get or create rate limit entry for this IP
  let clientData = rateLimitStore.get(clientIP);

  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Start a new window
    clientData = { windowStart: now, requestCount: 1 };
    rateLimitStore.set(clientIP, clientData);
  } else {
    clientData.requestCount++;
  }

  // Check if rate limit exceeded
  if (clientData.requestCount > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
      retryAfter: Math.ceil((clientData.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX_REQUESTS - clientData.requestCount);
  res.setHeader('X-RateLimit-Reset', Math.ceil((clientData.windowStart + RATE_LIMIT_WINDOW_MS) / 1000));

  next();
}

// Periodically clean up old rate limit entries (every 5 minutes)
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

app.use(rateLimit);

// =============================================================================
// Standard Middleware
// =============================================================================

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
const MAX_SSE_CONNECTIONS = 50; // Maximum concurrent SSE connections

// SSE endpoint for live reload
app.get('/api/events', (req, res) => {
  // Limit concurrent SSE connections to prevent resource exhaustion
  if (clients.length >= MAX_SSE_CONNECTIONS) {
    return res.status(429).json({
      error: 'Too many connections',
      message: 'Maximum SSE connections reached. Please try again later.'
    });
  }

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
  clearInterval(rateLimitCleanupInterval);
  watcher.close();
  server.close(() => {
    console.log('HTTP server closed');
  });
});
