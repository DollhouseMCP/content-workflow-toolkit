// Content Workflow Dashboard - Modal Handling

// Track modal keyboard handler for cleanup
let _modalKeyHandler = null;

/**
 * Show a modal with proper cleanup and keyboard support
 * @param {string} modalId - The modal element ID
 * @param {string} modalHTML - The HTML content for the modal
 * @param {function} closeCallback - Optional callback when modal closes
 */
export function showModal(modalId, modalHTML, closeCallback) {
  // Remove any existing modal with same ID
  const existingModal = document.getElementById(modalId);
  if (existingModal) {
    existingModal.remove();
  }

  // Remove any lingering modal keyboard listener
  if (_modalKeyHandler) {
    document.removeEventListener('keydown', _modalKeyHandler);
  }

  // Insert modal
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById(modalId);

  // Click on overlay to close
  const clickHandler = (e) => {
    if (e.target.id === modalId) {
      closeModal(modalId, closeCallback);
    }
  };
  modal.addEventListener('click', clickHandler);

  // Escape key to close
  _modalKeyHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal(modalId, closeCallback);
    }
  };
  document.addEventListener('keydown', _modalKeyHandler);

  // Store handlers for cleanup
  modal._clickHandler = clickHandler;
}

/**
 * Close and cleanup a modal
 * @param {string} modalId - The modal element ID
 * @param {function} closeCallback - Optional callback when modal closes
 */
export function closeModal(modalId, closeCallback) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Remove click listener
    if (modal._clickHandler) {
      modal.removeEventListener('click', modal._clickHandler);
    }
    modal.remove();
  }

  // Remove keyboard listener
  if (_modalKeyHandler) {
    document.removeEventListener('keydown', _modalKeyHandler);
    _modalKeyHandler = null;
  }

  // Call close callback if provided
  if (closeCallback) {
    closeCallback();
  }
}

/**
 * Show a notification toast
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('info', 'success', 'error')
 * @param {function} escapeHtml - HTML escape function
 */
export function showNotification(message, type = 'info', escapeHtml) {
  // Remove any existing notification
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  const notificationHTML = `
    <div class="notification notification-${type}">
      <span class="notification-message">${escapeHtml(message)}</span>
      <button class="notification-close">x</button>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', notificationHTML);

  const notification = document.querySelector('.notification');

  // Close button handler
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.add('notification-hiding');
    setTimeout(() => notification.remove(), 300);
  });

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('notification-hiding');
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}
