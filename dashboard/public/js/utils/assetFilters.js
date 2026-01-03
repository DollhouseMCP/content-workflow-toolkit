/**
 * Asset Browser Filter Utilities
 * Functions for filtering assets by search query and type
 */

/**
 * Check if file matches current filter state
 * @param {object} file - File object with name and ext properties
 * @param {object} state - Filter state with searchQuery and filterType
 * @returns {boolean} True if file matches filter criteria
 */
export function matchesAssetFilter(file, state) {
  // Defensive null checks
  if (!file || !state) return false;

  // Search filter
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    if (!file.name.toLowerCase().includes(query)) {
      return false;
    }
  }

  // Type filter
  if (state.filterType !== 'all') {
    const ext = file.ext;
    switch (state.filterType) {
    case 'image':
      if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return false;
      break;
    case 'video':
      if (!['.mp4', '.mov', '.webm', '.avi'].includes(ext)) return false;
      break;
    case 'audio':
      if (!['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) return false;
      break;
    case 'document':
      if (!['.md', '.txt', '.pdf', '.doc', '.docx'].includes(ext)) return false;
      break;
    default:
      // Unknown filter types pass through (matches all)
      break;
    }
  }

  return true;
}

/**
 * Check if directory has any matching files (recursive)
 * @param {object} node - Tree node (file or directory)
 * @param {object} state - Filter state with searchQuery and filterType
 * @returns {boolean} True if node or any descendant matches filter
 */
export function hasMatchingFilesInDir(node, state) {
  // Defensive null checks
  if (!node || !state) return false;

  if (node.type === 'file') {
    return matchesAssetFilter(node, state);
  }

  if (node.children && node.children.length > 0) {
    return node.children.some(child => hasMatchingFilesInDir(child, state));
  }

  return false;
}
