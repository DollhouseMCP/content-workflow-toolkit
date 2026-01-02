// Content Workflow Dashboard - Utility Functions

import { DASHBOARD_CONFIG } from './config.js';

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format a date string for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = DASHBOARD_CONFIG.FILE_SIZE_UNIT;
  const sizes = DASHBOARD_CONFIG.FILE_SIZE_LABELS;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format file modification date
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
export function formatFileDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * NOTE: This function is intentionally duplicated in the server-side code.
 * Keep in sync with: dashboard/api/index.js (slugify function)
 *
 * The duplication exists because:
 * - Server needs slugify for validation and folder creation
 * - Client needs slugify for live preview/auto-formatting in forms
 * - A shared module would require a build step (adds complexity)
 * - An API endpoint would add latency for real-time input formatting
 *
 * @param {string} text - The text to slugify
 * @returns {string} URL-friendly slug (lowercase, hyphens, no special chars)
 */
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w-]+/g, '')        // Remove non-word chars (except -)
    .replace(/--+/g, '-')           // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

/**
 * Validate a slug format
 * @param {string} slug - Slug to validate
 * @returns {boolean} True if valid
 */
export function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length < 1 || slug.length > 100) return false;
  // Must be lowercase alphanumeric with hyphens and underscores
  const validSlugRegex = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/;
  return validSlugRegex.test(slug);
}

/**
 * Validate a series name
 * @param {string} name - Series name to validate
 * @returns {boolean} True if valid
 */
export function validateSeriesName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 100) return false;
  // Must not contain path traversal characters
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  const validSeriesRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_ ]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  return validSeriesRegex.test(name);
}

/**
 * Check if file extension is a media type
 * @param {string} ext - File extension (with dot)
 * @returns {boolean} True if media file
 */
export function isMediaFile(ext) {
  const mediaExtensions = ['.mp4', '.mov', '.webm', '.mp3', '.wav', '.m4a', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
  return mediaExtensions.includes(ext);
}

/**
 * Get appropriate icon for file type
 * @param {object} file - File object with type and ext properties
 * @returns {string} Emoji icon
 */
export function getFileIcon(file) {
  const ext = file.ext;
  if (file.type === 'directory') return '📁';
  if (['.mp4', '.mov', '.webm'].includes(ext)) return '🎥';
  if (['.mp3', '.wav', '.m4a'].includes(ext)) return '🎵';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return '🖼️';
  if (['.yml', '.yaml'].includes(ext)) return '⚙️';
  if (['.md', '.txt'].includes(ext)) return '📄';
  return '📄';
}

/**
 * Get CSS class for series badge
 * @param {string} series - Series name
 * @returns {string} CSS class name
 */
export function getSeriesBadgeClass(series) {
  const normalized = series.toLowerCase().replace(/\s+/g, '-');
  const knownSeries = ['dollhouse-mcp', 'merview', 'mcp-aql', 'ailish'];
  return knownSeries.includes(normalized) ? normalized : 'default';
}

/**
 * Get CSS class for status badge
 * @param {string} status - Status value
 * @returns {string} CSS class name
 */
export function getStatusClass(status) {
  const statusMap = {
    'planning': 'warning',
    'recording': 'warning',
    'editing': 'warning',
    'review': 'warning',
    'ready': 'success',
    'published': 'success',
    'staged': 'warning',
    'released': 'success',
    'blocked': 'error',
    'cancelled': 'error'
  };
  return statusMap[status] || 'warning';
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
export function isSameDate(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Get a date key in YYYY-MM-DD format using local timezone
 * @param {Date} date - Date object
 * @returns {string} Date key string
 */
export function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date key as local date
 * @param {string} dateKey - Date key in YYYY-MM-DD format
 * @returns {Date} Date object
 */
export function parseLocalDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}
