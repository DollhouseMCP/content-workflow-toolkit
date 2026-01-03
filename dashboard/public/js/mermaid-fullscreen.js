/**
 * Mermaid Fullscreen Module
 * Provides fullscreen viewing capability for Mermaid diagrams with zoom and pan functionality.
 * Adapted from Merview (https://github.com/mickdarling/merview)
 */

// Fullscreen state
const mermaidZoom = {
  scale: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  startX: 0,
  startY: 0
};

// Fullscreen overlay background
const FULLSCREEN_BG = 'rgba(255, 255, 255, 0.98)';

/**
 * Open a Mermaid diagram in fullscreen mode with zoom/pan controls
 * @param {string} mermaidId - The ID of the mermaid element to expand
 */
export function expandMermaid(mermaidId) {
  const mermaidElement = document.getElementById(mermaidId);
  if (!mermaidElement) {
    console.warn(`Mermaid element with id "${mermaidId}" not found`);
    return;
  }

  // Get SVG content and validate
  const svgContent = mermaidElement.innerHTML;
  if (!svgContent || !svgContent.includes('<svg')) {
    console.warn('No valid SVG content found in mermaid element');
    return;
  }

  // Reset zoom state
  mermaidZoom.scale = 1;
  mermaidZoom.panX = 0;
  mermaidZoom.panY = 0;
  mermaidZoom.isPanning = false;

  // Create fullscreen overlay
  const overlay = document.createElement('div');
  overlay.className = 'mermaid-fullscreen-overlay';
  overlay.id = 'mermaid-fullscreen-overlay';
  overlay.style.background = FULLSCREEN_BG;
  overlay.innerHTML = `
    <button class="mermaid-close-btn" data-action="close">✕ Close</button>
    <div class="mermaid-fullscreen-content" id="mermaid-pan-area">${svgContent}</div>
    <div class="mermaid-zoom-controls">
      <button class="mermaid-zoom-btn" data-action="zoom-in">+</button>
      <span class="mermaid-zoom-level" id="mermaid-zoom-level">100%</span>
      <button class="mermaid-zoom-btn" data-action="zoom-out">−</button>
      <button class="mermaid-zoom-btn" data-action="zoom-reset">Reset</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Attach event listeners for overlay controls
  overlay.querySelector('[data-action="close"]').addEventListener('click', closeMermaidFullscreen);
  overlay.querySelector('[data-action="zoom-in"]').addEventListener('click', mermaidZoomIn);
  overlay.querySelector('[data-action="zoom-out"]').addEventListener('click', mermaidZoomOut);
  overlay.querySelector('[data-action="zoom-reset"]').addEventListener('click', mermaidZoomReset);

  // Set up pan area
  const panArea = document.getElementById('mermaid-pan-area');
  const svg = panArea.querySelector('svg');

  if (svg) {
    // Make SVG fill the container initially
    svg.style.width = '100%';
    svg.style.height = '100%';
    updateMermaidTransform();
  }

  // Mouse wheel zoom
  panArea.addEventListener('wheel', handleMermaidWheel, { passive: false });

  // Pan with mouse drag
  panArea.addEventListener('mousedown', handleMermaidPanStart);
  document.addEventListener('mousemove', handleMermaidPanMove);
  document.addEventListener('mouseup', handleMermaidPanEnd);

  // Close on Escape key
  document.addEventListener('keydown', handleMermaidEscape);

  // Close when clicking on overlay background (not content)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeMermaidFullscreen();
    }
  });
}

/**
 * Update the transform (zoom and pan) of the Mermaid diagram in fullscreen mode
 */
function updateMermaidTransform() {
  const panArea = document.getElementById('mermaid-pan-area');
  if (!panArea) return;
  const svg = panArea.querySelector('svg');
  if (!svg) return;

  svg.style.transform = `translate(${mermaidZoom.panX}px, ${mermaidZoom.panY}px) scale(${mermaidZoom.scale})`;

  const zoomLevel = document.getElementById('mermaid-zoom-level');
  if (zoomLevel) {
    zoomLevel.textContent = Math.round(mermaidZoom.scale * 100) + '%';
  }
}

/**
 * Zoom in the Mermaid diagram (increase scale by 25%)
 */
function mermaidZoomIn() {
  mermaidZoom.scale = Math.min(mermaidZoom.scale * 1.25, 10);
  updateMermaidTransform();
}

/**
 * Zoom out the Mermaid diagram (decrease scale by 25%)
 */
function mermaidZoomOut() {
  mermaidZoom.scale = Math.max(mermaidZoom.scale / 1.25, 0.1);
  updateMermaidTransform();
}

/**
 * Reset zoom and pan to default values
 */
function mermaidZoomReset() {
  mermaidZoom.scale = 1;
  mermaidZoom.panX = 0;
  mermaidZoom.panY = 0;
  updateMermaidTransform();
}

/**
 * Handle mouse wheel zoom events
 * @param {WheelEvent} e - The wheel event
 */
function handleMermaidWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  mermaidZoom.scale = Math.min(Math.max(mermaidZoom.scale * delta, 0.1), 10);
  updateMermaidTransform();
}

/**
 * Start panning the diagram (mouse down)
 * @param {MouseEvent} e - The mouse event
 */
function handleMermaidPanStart(e) {
  if (e.target.closest('.mermaid-zoom-controls')) return;
  mermaidZoom.isPanning = true;
  mermaidZoom.startX = e.clientX - mermaidZoom.panX;
  mermaidZoom.startY = e.clientY - mermaidZoom.panY;
}

/**
 * Continue panning the diagram (mouse move)
 * @param {MouseEvent} e - The mouse event
 */
function handleMermaidPanMove(e) {
  if (!mermaidZoom.isPanning) return;
  mermaidZoom.panX = e.clientX - mermaidZoom.startX;
  mermaidZoom.panY = e.clientY - mermaidZoom.startY;
  updateMermaidTransform();
}

/**
 * End panning the diagram (mouse up)
 */
function handleMermaidPanEnd() {
  mermaidZoom.isPanning = false;
}

/**
 * Close the Mermaid fullscreen overlay
 */
export function closeMermaidFullscreen() {
  const overlay = document.getElementById('mermaid-fullscreen-overlay');
  if (overlay) {
    overlay.remove();
  }
  document.removeEventListener('keydown', handleMermaidEscape);
  document.removeEventListener('mousemove', handleMermaidPanMove);
  document.removeEventListener('mouseup', handleMermaidPanEnd);
}

/**
 * Handle Escape key to close fullscreen
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleMermaidEscape(e) {
  if (e.key === 'Escape') {
    closeMermaidFullscreen();
  }
}

/**
 * Attach double-click handlers to all mermaid diagrams in a container
 * Prevents duplicate handlers by checking data attribute
 * @param {HTMLElement} container - Container element with mermaid diagrams
 */
export function attachMermaidFullscreenHandlers(container) {
  container.querySelectorAll('.mermaid[id]').forEach(el => {
    // Skip if handler already attached
    if (el.dataset.fullscreenAttached) return;

    el.addEventListener('dblclick', () => expandMermaid(el.id));
    el.style.cursor = 'zoom-in';
    el.dataset.fullscreenAttached = 'true';
  });
}
