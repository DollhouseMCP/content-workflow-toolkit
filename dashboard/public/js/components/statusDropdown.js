// Content Workflow Dashboard - Status Dropdown Component

import { escapeHtml, getStatusClass } from '../utils.js';

// Track the close handler for cleanup
let _statusDropdownCloseHandler = null;

/**
 * Close all status dropdowns
 */
export function closeStatusDropdowns() {
  document.querySelectorAll('.status-dropdown').forEach(dropdown => dropdown.remove());
  if (_statusDropdownCloseHandler) {
    document.removeEventListener('click', _statusDropdownCloseHandler);
    _statusDropdownCloseHandler = null;
  }
}

/**
 * Attach inline status dropdown handlers to all status badges
 * @param {Array} episodes - Array of episode objects
 * @param {function} onStatusUpdate - Callback when status is updated
 */
export function attachInlineStatusHandlers(episodes, onStatusUpdate) {
  document.querySelectorAll('.status-badge-clickable').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = badge.closest('.status-dropdown-container');
      if (!container) return;

      // Close any existing dropdown
      closeStatusDropdowns();

      // Get current status
      const currentStatus = badge.dataset.currentStatus;

      // Create dropdown
      const dropdown = document.createElement('div');
      dropdown.className = 'status-dropdown';
      dropdown.innerHTML = ['draft', 'ready', 'staged', 'released'].map(status => `
        <div class="status-dropdown-item ${status === currentStatus ? 'active' : ''}" data-status="${escapeHtml(status)}">
          <span class="status-dot ${escapeHtml(status)}"></span>
          <span>${escapeHtml(status)}</span>
        </div>
      `).join('');

      container.appendChild(dropdown);

      // Handle dropdown item clicks
      dropdown.querySelectorAll('.status-dropdown-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          e.stopPropagation();
          const newStatus = item.dataset.status;
          if (newStatus !== currentStatus) {
            await updateInlineStatus(container, newStatus, onStatusUpdate);
          }
          closeStatusDropdowns();
        });
      });

      // Close dropdown when clicking outside
      setTimeout(() => {
        if (_statusDropdownCloseHandler) {
          document.removeEventListener('click', _statusDropdownCloseHandler);
        }
        _statusDropdownCloseHandler = (e) => {
          if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-badge-clickable')) {
            closeStatusDropdowns();
          }
        };
        document.addEventListener('click', _statusDropdownCloseHandler);
      }, 0);
    });
  });
}

/**
 * Update episode status inline
 * @param {Element} container - The status dropdown container element
 * @param {string} newStatus - The new status value
 * @param {function} onStatusUpdate - Callback when status is updated successfully
 */
async function updateInlineStatus(container, newStatus, onStatusUpdate) {
  const seriesName = container.dataset.episodeSeries;
  const episodeId = container.dataset.episodeId;
  const badge = container.querySelector('.status-badge-clickable');

  if (!badge) return;

  // Show loading state
  badge.classList.add('status-updating');
  const originalText = badge.textContent;

  try {
    const response = await fetch(`/api/episodes/${seriesName}/${episodeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content_status: newStatus })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update status');
    }

    // Update the badge
    badge.textContent = newStatus;
    badge.dataset.currentStatus = newStatus;
    badge.className = `badge ${getStatusClass(newStatus)} status-badge-clickable`;

    // Call the update callback to refresh the view
    if (onStatusUpdate) {
      onStatusUpdate();
    }

  } catch (error) {
    console.error('Error updating status:', error);
    badge.textContent = originalText;
    // Show error briefly
    badge.style.outline = '2px solid var(--error)';
    setTimeout(() => {
      badge.style.outline = '';
    }, 2000);
  } finally {
    badge.classList.remove('status-updating');
  }
}
