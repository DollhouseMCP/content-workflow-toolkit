// Content Workflow Dashboard - Configuration Constants

export const DASHBOARD_CONFIG = {
  // Calendar display settings
  CALENDAR_MAX_ITEMS_PER_DAY: 3,
  CALENDAR_TITLE_MAX_LENGTH: 20,

  // UI feedback delays (milliseconds)
  COPY_BUTTON_RESET_DELAY: 2000,
  MARKDOWN_RENDER_DELAY: 50,
  MERMAID_RENDER_DELAY: 100,
  SEARCH_DEBOUNCE_DELAY: 150,

  // File size display
  FILE_SIZE_UNIT: 1024,
  FILE_SIZE_LABELS: ['Bytes', 'KB', 'MB', 'GB'],

  // Asset management
  MAX_UPLOAD_SIZE_MB: 100,
  ALLOWED_UPLOAD_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
    '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v',
    '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
    '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
    '.json', '.yml', '.yaml', '.csv', '.xml'
  ]
};
