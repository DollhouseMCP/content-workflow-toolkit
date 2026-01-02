// Content Workflow Dashboard - Asset Browser View

import { DASHBOARD_CONFIG } from '../config.js';
import { escapeHtml, formatFileSize, formatFileDate, getFileIcon } from '../utils.js';
import { showModal, closeModal } from '../modal.js';

/**
 * Render the asset browser view
 * @param {object} dashboard - Dashboard instance for state and methods
 */
export async function renderAssets(dashboard) {
  const result = await dashboard.fetchAPI('/assets');
  const content = document.getElementById('content');

  if (!result.success) {
    content.innerHTML = '<div class="error">Failed to load assets</div>';
    return;
  }

  // Initialize asset browser state
  if (!dashboard.assetBrowserState) {
    dashboard.assetBrowserState = {
      expandedFolders: new Set(['assets', 'assets/branding', 'assets/music', 'assets/thumbnails', 'assets/sound-effects']),
      selectedFile: null,
      selectedFolder: 'assets',
      searchQuery: '',
      filterType: 'all',
      isUploading: false,
      uploadProgress: 0,
      contextMenu: null
    };
  }

  // Store tree data for later use
  dashboard._assetTreeData = result.data;

  content.innerHTML = `
    <div class="view">
      <div class="section-header">
        <h2>Asset Browser</h2>
        <p>Browse and preview media assets</p>
      </div>

      <div class="asset-browser-toolbar">
        <div class="toolbar-left">
          <button class="toolbar-btn primary" id="upload-btn">
            <span class="btn-icon">+</span>
            Upload Files
          </button>
          <button class="toolbar-btn" id="new-folder-btn">
            <span class="btn-icon">+</span>
            New Folder
          </button>
        </div>
        <div class="toolbar-right">
          <span class="current-folder-path" id="current-folder-path">
            ${escapeHtml(dashboard.assetBrowserState.selectedFolder || 'assets')}
          </span>
        </div>
      </div>

      <div class="asset-browser-controls">
        <div class="search-box">
          <input type="text" class="search-input" id="asset-search" placeholder="Search files..." value="${escapeHtml(dashboard.assetBrowserState.searchQuery)}">
        </div>
        <div class="filter-group">
          <label class="filter-label">Type:</label>
          <select class="filter-select" id="asset-type-filter">
            <option value="all" ${dashboard.assetBrowserState.filterType === 'all' ? 'selected' : ''}>All Files</option>
            <option value="image" ${dashboard.assetBrowserState.filterType === 'image' ? 'selected' : ''}>Images</option>
            <option value="video" ${dashboard.assetBrowserState.filterType === 'video' ? 'selected' : ''}>Videos</option>
            <option value="audio" ${dashboard.assetBrowserState.filterType === 'audio' ? 'selected' : ''}>Audio</option>
            <option value="document" ${dashboard.assetBrowserState.filterType === 'document' ? 'selected' : ''}>Documents</option>
          </select>
        </div>
      </div>

      <!-- Hidden file input for upload -->
      <input type="file" id="file-upload-input" multiple style="display: none;">

      <!-- Upload dropzone overlay -->
      <div class="upload-dropzone-overlay" id="upload-dropzone-overlay">
        <div class="dropzone-content">
          <div class="dropzone-icon">+</div>
          <p>Drop files here to upload</p>
          <p class="dropzone-hint">to: <span id="dropzone-target-folder">${escapeHtml(dashboard.assetBrowserState.selectedFolder || 'assets')}</span></p>
        </div>
      </div>

      <!-- Upload progress indicator -->
      <div class="upload-progress-container" id="upload-progress-container" style="display: none;">
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" id="upload-progress-fill"></div>
        </div>
        <div class="upload-progress-text" id="upload-progress-text">Uploading...</div>
      </div>

      <div class="asset-browser-layout" id="asset-browser-layout">
        <div class="asset-tree-panel">
          <div class="asset-tree-header">
            <span>Folder Structure</span>
          </div>
          <div class="asset-tree" id="asset-tree">
            ${renderAssetTree(result.data, 0, '', dashboard.assetBrowserState)}
          </div>
        </div>
        <div class="asset-preview-panel">
          <div class="asset-preview-header">
            <span>Preview</span>
          </div>
          <div id="asset-preview-content">
            ${renderAssetPreview(dashboard.assetBrowserState.selectedFile, dashboard)}
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu (hidden by default) -->
    <div class="asset-context-menu" id="asset-context-menu" style="display: none;">
      <div class="context-menu-item" data-action="rename">Rename</div>
      <div class="context-menu-item" data-action="delete">Delete</div>
    </div>
  `;

  // Attach event listeners
  attachAssetBrowserListeners(dashboard);
  attachAssetManagementListeners(dashboard);
}

/**
 * Render the asset tree structure
 */
function renderAssetTree(node, level, parentPath, state) {
  const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
  const isExpanded = state.expandedFolders.has(currentPath);

  if (node.type === 'file') {
    // Check if file matches search and filter
    if (!matchesAssetFilter(node, state)) {
      return '';
    }

    const isSelected = state.selectedFile && state.selectedFile.path === node.path;

    return `
      <div class="asset-tree-item asset-tree-file ${isSelected ? 'selected' : ''}"
           style="padding-left: ${(level + 1) * 1.5}rem;"
           data-file-path="${escapeHtml(node.path)}"
           data-file-data='${JSON.stringify(node).replace(/'/g, '&#39;')}'>
        <div class="asset-tree-item-content">
          <span class="asset-file-icon">${getFileIcon(node)}</span>
          <span class="asset-tree-name">${escapeHtml(node.name)}</span>
        </div>
      </div>
    `;
  }

  // Directory
  const hasMatchingFiles = hasMatchingFilesInDir(node, state);
  if (!hasMatchingFiles) {
    return '';
  }

  const childrenHTML = node.children && node.children.length > 0
    ? node.children.map(child => renderAssetTree(child, level + 1, currentPath, state)).join('')
    : '';

  return `
    <div class="asset-tree-folder">
      <div class="asset-tree-item asset-tree-directory ${isExpanded ? 'expanded' : ''}"
           style="padding-left: ${level * 1.5}rem;"
           data-folder-path="${escapeHtml(currentPath)}">
        <div class="asset-tree-item-content">
          <span class="asset-folder-toggle">${isExpanded ? '▼' : '▶'}</span>
          <span class="asset-folder-icon">📁</span>
          <span class="asset-tree-name">${escapeHtml(node.name)}</span>
          <span class="asset-folder-count">${node.fileCount || 0}</span>
        </div>
      </div>
      <div class="asset-tree-children ${isExpanded ? 'expanded' : 'collapsed'}">
        ${childrenHTML}
      </div>
    </div>
  `;
}

/**
 * Check if file matches current filter
 */
function matchesAssetFilter(file, state) {
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
    }
  }

  return true;
}

/**
 * Check if directory has matching files
 */
function hasMatchingFilesInDir(node, state) {
  if (node.type === 'file') {
    return matchesAssetFilter(node, state);
  }

  if (node.children && node.children.length > 0) {
    return node.children.some(child => hasMatchingFilesInDir(child, state));
  }

  return false;
}

/**
 * Render asset preview
 */
function renderAssetPreview(file, dashboard) {
  if (!file) {
    return `
      <div class="asset-preview-placeholder">
        <div class="asset-preview-icon">📁</div>
        <p>Select a file to preview</p>
      </div>
    `;
  }

  const filePath = `/content/${file.path}`;
  const ext = file.ext;
  let previewHTML = '';

  // Image preview
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
    previewHTML = `
      <div class="asset-preview-media">
        <img src="${filePath}" alt="${escapeHtml(file.name)}"
             onload="this.parentElement.dataset.loaded='true'">
      </div>
    `;
  }
  // Video preview
  else if (['.mp4', '.mov', '.webm'].includes(ext)) {
    previewHTML = `
      <div class="asset-preview-media">
        <video controls src="${filePath}">
          Your browser does not support video playback.
        </video>
      </div>
    `;
  }
  // Audio preview
  else if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) {
    previewHTML = `
      <div class="asset-preview-media audio">
        <div class="audio-icon">🎵</div>
        <audio controls src="${filePath}">
          Your browser does not support audio playback.
        </audio>
      </div>
    `;
  }
  // Markdown preview
  else if (ext === '.md') {
    previewHTML = `
      <div class="asset-preview-document markdown-preview" data-file="${filePath}">
        <div class="markdown-loading">Loading markdown...</div>
      </div>
    `;
    // Fetch and render markdown after DOM update
    setTimeout(async () => {
      const container = document.querySelector(`.markdown-preview[data-file="${filePath}"]`);
      if (container) {
        try {
          const response = await fetch(filePath);
          const text = await response.text();
          const renderedHTML = await dashboard.renderMarkdown(text);
          container.innerHTML = `<div class="markdown-content">${renderedHTML}</div>`;
        } catch (e) {
          container.innerHTML = `<div class="markdown-error">Error loading markdown: ${e.message}</div>`;
        }
      }
    }, DASHBOARD_CONFIG.MARKDOWN_RENDER_DELAY);
  }
  // Text file preview
  else if (['.txt', '.yml', '.yaml', '.json', '.js', '.ts', '.py', '.sh', '.css', '.html', '.xml', '.csv', '.log', '.env', '.gitignore', '.config'].includes(ext) || ext === '') {
    previewHTML = `
      <div class="asset-preview-document text-preview" data-file="${filePath}">
        <div class="markdown-loading">Loading file...</div>
      </div>
    `;
    // Fetch and display text file
    setTimeout(async () => {
      const container = document.querySelector(`.text-preview[data-file="${filePath}"]`);
      if (container) {
        try {
          const response = await fetch(filePath);
          const text = await response.text();
          container.innerHTML = `<pre class="text-content">${escapeHtml(text)}</pre>`;
        } catch (e) {
          container.innerHTML = `<div class="markdown-error">Error loading file: ${e.message}</div>`;
        }
      }
    }, DASHBOARD_CONFIG.MARKDOWN_RENDER_DELAY);
  }
  // Other files
  else {
    previewHTML = `
      <div class="asset-preview-placeholder">
        <div class="asset-preview-icon">${getFileIcon(file)}</div>
        <p>Preview not available for this file type</p>
        <p class="text-muted">${ext}</p>
      </div>
    `;
  }

  return `
    ${previewHTML}
    <div class="asset-file-info">
      <div class="asset-file-info-header">
        <h3>${escapeHtml(file.name)}</h3>
      </div>
      <div class="asset-file-info-grid">
        <div class="asset-info-item">
          <div class="asset-info-label">File Size</div>
          <div class="asset-info-value">${formatFileSize(file.size)}</div>
        </div>
        <div class="asset-info-item">
          <div class="asset-info-label">Type</div>
          <div class="asset-info-value">${ext.toUpperCase()}</div>
        </div>
        <div class="asset-info-item">
          <div class="asset-info-label">Modified</div>
          <div class="asset-info-value">${formatFileDate(file.modified)}</div>
        </div>
        <div class="asset-info-item">
          <div class="asset-info-label">Path</div>
          <div class="asset-info-value asset-path-value">
            <code>${escapeHtml(file.path)}</code>
            <button class="copy-path-btn" data-path="${escapeHtml(file.path)}" title="Copy path">
              📋
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach asset browser event listeners
 */
function attachAssetBrowserListeners(dashboard) {
  const content = document.getElementById('content');
  if (!content) return;

  // Remove existing handlers
  if (dashboard._assetClickHandler) {
    content.removeEventListener('click', dashboard._assetClickHandler);
  }
  if (dashboard._assetInputHandler) {
    content.removeEventListener('input', dashboard._assetInputHandler);
  }
  if (dashboard._assetChangeHandler) {
    content.removeEventListener('change', dashboard._assetChangeHandler);
  }

  // Create delegated click handler
  dashboard._assetClickHandler = async (e) => {
    const target = e.target;

    // Copy path button
    const copyBtn = target.closest('.copy-path-btn');
    if (copyBtn) {
      e.stopPropagation();
      const path = copyBtn.dataset.path;
      try {
        await navigator.clipboard.writeText(path);
        copyBtn.textContent = '✓';
        setTimeout(() => {
          copyBtn.textContent = '📋';
        }, DASHBOARD_CONFIG.COPY_BUTTON_RESET_DELAY);
      } catch (err) {
        console.error('Failed to copy path:', err);
      }
      return;
    }

    // File selection
    const fileItem = target.closest('.asset-tree-file');
    if (fileItem) {
      e.stopPropagation();
      const fileData = JSON.parse(fileItem.dataset.fileData);
      dashboard.assetBrowserState.selectedFile = fileData;
      renderAssets(dashboard);
      return;
    }

    // Folder toggle
    const folderItem = target.closest('.asset-tree-directory');
    if (folderItem) {
      e.stopPropagation();
      const folderPath = folderItem.dataset.folderPath;

      // Update selected folder for upload target
      dashboard.assetBrowserState.selectedFolder = folderPath;

      // Update the current folder path display
      const currentFolderPath = document.getElementById('current-folder-path');
      if (currentFolderPath) {
        currentFolderPath.textContent = folderPath;
      }
      const dropzoneTargetFolder = document.getElementById('dropzone-target-folder');
      if (dropzoneTargetFolder) {
        dropzoneTargetFolder.textContent = folderPath;
      }

      if (dashboard.assetBrowserState.expandedFolders.has(folderPath)) {
        dashboard.assetBrowserState.expandedFolders.delete(folderPath);
      } else {
        dashboard.assetBrowserState.expandedFolders.add(folderPath);
      }

      renderAssets(dashboard);
      return;
    }
  };

  // Create delegated input handler (for search)
  dashboard._assetInputHandler = (e) => {
    if (e.target.id === 'asset-search') {
      dashboard.assetBrowserState.searchQuery = e.target.value;
      renderAssets(dashboard);
    }
  };

  // Create delegated change handler (for type filter)
  dashboard._assetChangeHandler = (e) => {
    if (e.target.id === 'asset-type-filter') {
      dashboard.assetBrowserState.filterType = e.target.value;
      renderAssets(dashboard);
    }
  };

  content.addEventListener('click', dashboard._assetClickHandler);
  content.addEventListener('input', dashboard._assetInputHandler);
  content.addEventListener('change', dashboard._assetChangeHandler);
}

/**
 * Attach asset management event listeners (upload, create folder, context menu)
 */
function attachAssetManagementListeners(dashboard) {
  const content = document.getElementById('content');
  if (!content) return;

  // Upload button click
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('file-upload-input');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        await uploadFiles(files, dashboard);
      }
      fileInput.value = '';
    });
  }

  // New folder button click
  const newFolderBtn = document.getElementById('new-folder-btn');
  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', () => {
      showCreateFolderModal(dashboard);
    });
  }

  // Drag and drop handlers
  const assetBrowserLayout = document.getElementById('asset-browser-layout');
  const dropzoneOverlay = document.getElementById('upload-dropzone-overlay');

  if (assetBrowserLayout && dropzoneOverlay) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    assetBrowserLayout.addEventListener('dragenter', (e) => {
      if (e.dataTransfer.types.includes('Files')) {
        dropzoneOverlay.classList.add('active');
      }
    });

    dropzoneOverlay.addEventListener('dragleave', (e) => {
      if (e.target === dropzoneOverlay) {
        dropzoneOverlay.classList.remove('active');
      }
    });

    dropzoneOverlay.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    dropzoneOverlay.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzoneOverlay.classList.remove('active');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await uploadFiles(files, dashboard);
      }
    });
  }

  // Context menu handler (right-click)
  const assetTree = document.getElementById('asset-tree');
  if (assetTree) {
    assetTree.addEventListener('contextmenu', (e) => {
      const treeItem = e.target.closest('.asset-tree-item');
      if (treeItem) {
        e.preventDefault();
        showContextMenu(e, treeItem, dashboard);
      }
    });
  }

  // Hide context menu on click elsewhere
  document.addEventListener('click', () => {
    hideContextMenu(dashboard);
  });

  // Context menu action handler
  const contextMenu = document.getElementById('asset-context-menu');
  if (contextMenu) {
    contextMenu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action && dashboard._contextMenuTarget) {
        handleContextMenuAction(action, dashboard);
      }
    });
  }
}

/**
 * Upload files to the server
 */
async function uploadFiles(files, dashboard) {
  const targetFolder = dashboard.assetBrowserState.selectedFolder || 'assets';
  const apiTargetFolder = targetFolder.startsWith('assets/') ? targetFolder.substring(7) : (targetFolder === 'assets' ? '' : targetFolder);

  const progressContainer = document.getElementById('upload-progress-container');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-text');

  if (progressContainer) {
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = `Uploading ${files.length} file(s)...`;
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  formData.append('targetFolder', apiTargetFolder);

  try {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && progressFill && progressText) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = percentComplete + '%';
        progressText.textContent = `Uploading... ${percentComplete}%`;
      }
    });

    const uploadPromise = new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
    });

    xhr.open('POST', '/api/assets/upload');
    xhr.send(formData);

    const result = await uploadPromise;

    if (progressText) {
      progressText.textContent = `Successfully uploaded ${result.files.length} file(s)`;
    }

    setTimeout(() => {
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      renderAssets(dashboard);
    }, 1500);

  } catch (error) {
    console.error('Upload error:', error);
    if (progressText) {
      progressText.textContent = `Error: ${error.message}`;
    }
    setTimeout(() => {
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
    }, 3000);
  }
}

/**
 * Show create folder modal
 */
function showCreateFolderModal(dashboard) {
  const currentFolder = dashboard.assetBrowserState.selectedFolder || 'assets';
  const parentPath = currentFolder.startsWith('assets/') ? currentFolder.substring(7) : (currentFolder === 'assets' ? '' : currentFolder);

  const modalHTML = `
    <div class="modal-overlay" id="create-folder-modal">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">Create New Folder</div>
            <div class="modal-subtitle">in: ${escapeHtml(currentFolder)}</div>
          </div>
          <button class="modal-close" data-modal-close="create-folder-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Folder Name</label>
            <input type="text" class="form-input" id="new-folder-name" placeholder="Enter folder name..." autocomplete="off">
            <p class="form-hint">Allowed: letters, numbers, dashes, and underscores</p>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" data-modal-close="create-folder-modal">Cancel</button>
            <button class="btn btn-primary" id="create-folder-confirm">Create Folder</button>
          </div>
        </div>
      </div>
    </div>
  `;

  showModal('create-folder-modal', modalHTML);

  const input = document.getElementById('new-folder-name');
  if (input) {
    input.focus();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        createFolder(parentPath, input.value, dashboard);
      }
    });
  }

  const confirmBtn = document.getElementById('create-folder-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      createFolder(parentPath, input.value, dashboard);
    });
  }

  document.querySelectorAll('[data-modal-close="create-folder-modal"]').forEach(btn => {
    btn.addEventListener('click', () => closeModal('create-folder-modal'));
  });
}

/**
 * Create folder via API
 */
async function createFolder(parentPath, folderName, dashboard) {
  if (!folderName || !folderName.trim()) {
    console.error('Please enter a folder name');
    return;
  }

  try {
    const response = await fetch('/api/assets/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: parentPath,
        name: folderName.trim()
      })
    });

    const result = await response.json();

    if (result.success) {
      closeModal('create-folder-modal');
      const fullPath = 'assets' + (parentPath ? '/' + parentPath : '');
      dashboard.assetBrowserState.expandedFolders.add(fullPath);
      renderAssets(dashboard);
    } else {
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('Create folder error:', error);
  }
}

/**
 * Show context menu
 */
function showContextMenu(event, targetElement, dashboard) {
  const contextMenu = document.getElementById('asset-context-menu');
  if (!contextMenu) return;

  const isFile = targetElement.classList.contains('asset-tree-file');
  const isFolder = targetElement.classList.contains('asset-tree-directory');

  if (isFile) {
    dashboard._contextMenuTarget = {
      type: 'file',
      path: targetElement.dataset.filePath,
      element: targetElement
    };
  } else if (isFolder) {
    dashboard._contextMenuTarget = {
      type: 'folder',
      path: targetElement.dataset.folderPath,
      element: targetElement
    };
  } else {
    return;
  }

  contextMenu.style.display = 'block';
  contextMenu.style.left = event.pageX + 'px';
  contextMenu.style.top = event.pageY + 'px';

  const menuRect = contextMenu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    contextMenu.style.left = (event.pageX - menuRect.width) + 'px';
  }
  if (menuRect.bottom > window.innerHeight) {
    contextMenu.style.top = (event.pageY - menuRect.height) + 'px';
  }
}

/**
 * Hide context menu
 */
function hideContextMenu(dashboard) {
  const contextMenu = document.getElementById('asset-context-menu');
  if (contextMenu) {
    contextMenu.style.display = 'none';
  }
  dashboard._contextMenuTarget = null;
}

/**
 * Handle context menu actions
 */
function handleContextMenuAction(action, dashboard) {
  const target = dashboard._contextMenuTarget;
  if (!target) return;

  hideContextMenu(dashboard);

  switch (action) {
  case 'rename':
    showRenameModal(target, dashboard);
    break;
  case 'delete':
    showDeleteConfirmModal(target, dashboard);
    break;
  }
}

/**
 * Show rename modal
 */
function showRenameModal(target, dashboard) {
  const currentName = target.path.split('/').pop();
  const parentPath = target.path.substring(0, target.path.lastIndexOf('/'));

  const modalHTML = `
    <div class="modal-overlay" id="rename-modal">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">Rename ${target.type === 'folder' ? 'Folder' : 'File'}</div>
            <div class="modal-subtitle">${escapeHtml(target.path)}</div>
          </div>
          <button class="modal-close" data-modal-close="rename-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">New Name</label>
            <input type="text" class="form-input" id="rename-input" value="${escapeHtml(currentName)}" autocomplete="off">
            <p class="form-hint">Allowed: letters, numbers, dashes, underscores, and dots</p>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" data-modal-close="rename-modal">Cancel</button>
            <button class="btn btn-primary" id="rename-confirm">Rename</button>
          </div>
        </div>
      </div>
    </div>
  `;

  showModal('rename-modal', modalHTML);

  const input = document.getElementById('rename-input');
  if (input) {
    input.focus();
    input.select();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        renameAsset(target.path, parentPath, input.value, dashboard);
      }
    });
  }

  const confirmBtn = document.getElementById('rename-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      renameAsset(target.path, parentPath, input.value, dashboard);
    });
  }

  document.querySelectorAll('[data-modal-close="rename-modal"]').forEach(btn => {
    btn.addEventListener('click', () => closeModal('rename-modal'));
  });
}

/**
 * Rename asset via API
 */
async function renameAsset(currentPath, parentPath, newName, dashboard) {
  if (!newName || !newName.trim()) {
    console.error('Please enter a new name');
    return;
  }

  const apiCurrentPath = currentPath.startsWith('assets/') ? currentPath.substring(7) : currentPath;
  const apiParentPath = parentPath.startsWith('assets/') ? parentPath.substring(7) : (parentPath === 'assets' ? '' : parentPath);
  const newPath = apiParentPath ? apiParentPath + '/' + newName.trim() : newName.trim();

  try {
    const response = await fetch('/api/assets/' + encodeURIComponent(apiCurrentPath), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPath })
    });

    const result = await response.json();

    if (result.success) {
      closeModal('rename-modal');
      renderAssets(dashboard);
    } else {
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('Rename error:', error);
  }
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmModal(target, dashboard) {
  const isFolder = target.type === 'folder';

  const modalHTML = `
    <div class="modal-overlay" id="delete-modal">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">Delete ${isFolder ? 'Folder' : 'File'}</div>
          </div>
          <button class="modal-close" data-modal-close="delete-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="delete-warning">
            <p>Are you sure you want to delete:</p>
            <p class="delete-path"><strong>${escapeHtml(target.path)}</strong></p>
            ${isFolder ? '<p class="delete-note">This will delete the folder and all its contents!</p>' : ''}
            <p class="delete-note">This action cannot be undone.</p>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" data-modal-close="delete-modal">Cancel</button>
            <button class="btn btn-danger" id="delete-confirm">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  showModal('delete-modal', modalHTML);

  const confirmBtn = document.getElementById('delete-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      deleteAsset(target.path, dashboard);
    });
  }

  document.querySelectorAll('[data-modal-close="delete-modal"]').forEach(btn => {
    btn.addEventListener('click', () => closeModal('delete-modal'));
  });
}

/**
 * Delete asset via API
 */
async function deleteAsset(assetPath, dashboard) {
  const apiPath = assetPath.startsWith('assets/') ? assetPath.substring(7) : assetPath;

  try {
    const response = await fetch('/api/assets/' + encodeURIComponent(apiPath), {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      closeModal('delete-modal');
      if (dashboard.assetBrowserState.selectedFile && dashboard.assetBrowserState.selectedFile.path === assetPath) {
        dashboard.assetBrowserState.selectedFile = null;
      }
      renderAssets(dashboard);
    } else {
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('Delete error:', error);
  }
}
