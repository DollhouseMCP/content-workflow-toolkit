// Content Workflow Dashboard - Main Application Entry Point

import { DASHBOARD_CONFIG } from './config.js';
import { fetchAPI, setupLiveReload } from './api.js';
import { escapeHtml, formatDate, formatFileSize, formatFileDate, getFileIcon, isMediaFile, getSeriesBadgeClass, getStatusClass, slugify, validateSlug, validateSeriesName } from './utils.js';
import { showModal, closeModal, showNotification } from './modal.js';
import { closeStatusDropdowns } from './components/statusDropdown.js';
import { renderPipeline } from './views/pipeline.js';
import { renderEpisodes } from './views/episodes.js';
import { renderCalendar } from './views/calendar.js';
import { renderReleases } from './views/releaseQueue.js';
import { renderAssets } from './views/assets.js';
import { renderDistribution } from './views/distribution.js';
import { attachMermaidFullscreenHandlers } from './mermaid-fullscreen.js';
import { getSavedMermaidTheme } from './previewThemes.js';

/**
 * Dashboard - Main application class
 * Coordinates views and manages global state
 */
class Dashboard {
  constructor() {
    this.currentView = 'episodes';
    this.data = {};
    this.seriesList = [];
    this.distributionProfiles = [];
    this.init();
  }

  async init() {
    this.setupMarkdown();
    this.setupEventListeners();
    this.setupLiveReload();
    await this.loadInitialData();
    await this.loadView('pipeline');
  }

  async loadInitialData() {
    try {
      const [seriesResult, distributionResult] = await Promise.all([
        this.fetchAPI('/series').catch(() => ({ success: false, series: [] })),
        this.fetchAPI('/distribution').catch(() => ({ success: false, data: { profiles: {} } }))
      ]);

      if (seriesResult.success) {
        this.seriesList = seriesResult.series || [];
      }

      if (distributionResult.success && distributionResult.data.profiles) {
        this.distributionProfiles = Object.entries(distributionResult.data.profiles).map(([id, profile]) => ({
          id,
          name: profile.name || id,
          description: profile.description || ''
        }));
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  setupMarkdown() {
    // Initialize mermaid for diagram rendering with saved theme
    try {
      if (typeof mermaid !== 'undefined') {
        const savedMermaidTheme = getSavedMermaidTheme();
        mermaid.initialize({
          startOnLoad: false,
          theme: savedMermaidTheme,
          securityLevel: 'loose'
        });
      }
    } catch (e) {
      console.warn('Mermaid init failed:', e);
    }

    // Configure marked for markdown rendering
    try {
      if (typeof marked !== 'undefined') {
        marked.setOptions({
          breaks: true,
          gfm: true
        });
      }
    } catch (e) {
      console.warn('Marked init failed:', e);
    }
  }

  async renderMarkdown(content) {
    if (typeof marked === 'undefined') {
      return `<pre>${escapeHtml(content)}</pre>`;
    }

    // Process mermaid diagrams before rendering
    let processedContent = content;
    const mermaidBlocks = [];
    let mermaidIndex = 0;

    // Extract mermaid code blocks
    processedContent = content.replace(/```mermaid\n([\s\S]*?)```/g, (match, diagram) => {
      const id = `mermaid-${mermaidIndex++}`;
      mermaidBlocks.push({ id, diagram: diagram.trim() });
      return `<div class="mermaid-container" id="${id}"></div>`;
    });

    // Render markdown
    let html = marked.parse(processedContent);

    // Sanitize HTML
    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, {
        ADD_TAGS: ['div'],
        ADD_ATTR: ['id', 'class']
      });
    }

    // Render mermaid diagrams after a short delay
    if (mermaidBlocks.length > 0 && typeof mermaid !== 'undefined') {
      setTimeout(async () => {
        // Get background color based on saved theme
        const savedTheme = getSavedMermaidTheme();
        const bgColor = savedTheme === 'dark' ? '#1e1e1e' : '#ffffff';

        for (const block of mermaidBlocks) {
          const container = document.getElementById(block.id);
          if (container) {
            try {
              const { svg } = await mermaid.render(`${block.id}-svg`, block.diagram);
              // Add mermaid class for fullscreen functionality and store source for theme switching
              container.classList.add('mermaid');
              container.setAttribute('data-mermaid-source', block.diagram);
              container.setAttribute('data-processed', 'true');
              container.style.backgroundColor = bgColor;
              container.innerHTML = svg;
            } catch (e) {
              container.innerHTML = `<pre class="mermaid-error">Diagram error: ${e.message}</pre>`;
            }
          }
        }
        // Attach fullscreen handlers to all rendered mermaid diagrams
        attachMermaidFullscreenHandlers(document);
      }, DASHBOARD_CONFIG.MERMAID_RENDER_DELAY);
    }

    return html;
  }

  setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });
  }

  setupLiveReload() {
    setupLiveReload(
      () => this.loadView(this.currentView),
      () => {
        document.getElementById('connection-status').innerHTML =
          '<span class="dot" style="background-color: var(--error);"></span> Disconnected';
      }
    );
  }

  switchView(view) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      }
    });

    this.loadView(view);
  }

  async loadView(view) {
    this.currentView = view;
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading">Loading...</div>';

    try {
      switch (view) {
      case 'pipeline':
        await renderPipeline(this);
        break;
      case 'episodes':
        await renderEpisodes(this);
        break;
      case 'calendar':
        await renderCalendar(this);
        break;
      case 'releases':
        await renderReleases(this);
        break;
      case 'assets':
        await renderAssets(this);
        break;
      case 'distribution':
        await renderDistribution(this);
        break;
      }
    } catch (error) {
      content.innerHTML = `
        <div class="error">
          <h2>Error loading view</h2>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  // API wrapper - delegate to the api module
  async fetchAPI(endpoint) {
    return fetchAPI(endpoint);
  }

  // Utility methods - expose for view modules
  escapeHtml(text) {
    return escapeHtml(text);
  }

  formatDate(dateString) {
    return formatDate(dateString);
  }

  formatFileSize(bytes) {
    return formatFileSize(bytes);
  }

  formatFileDate(dateString) {
    return formatFileDate(dateString);
  }

  getFileIcon(file) {
    return getFileIcon(file);
  }

  isMediaFile(ext) {
    return isMediaFile(ext);
  }

  getSeriesBadgeClass(series) {
    return getSeriesBadgeClass(series);
  }

  getStatusClass(status) {
    return getStatusClass(status);
  }

  slugify(text) {
    return slugify(text);
  }

  validateSlug(slug) {
    return validateSlug(slug);
  }

  validateSeriesName(name) {
    return validateSeriesName(name);
  }

  // Modal methods
  showModal(modalId, modalHTML) {
    showModal(modalId, modalHTML, () => this.closeStatusDropdowns());
  }

  closeModal(modalId) {
    closeModal(modalId, () => this.closeStatusDropdowns());
  }

  showNotification(message, type = 'info') {
    showNotification(message, type, escapeHtml);
  }

  closeStatusDropdowns() {
    closeStatusDropdowns();
  }

  // Episode modal - large method kept in main class for now
  async showEpisodeModal(episode, releaseGroups = {}, startInEditMode = false) {
    const metadata = episode.metadata || {};
    const workflow = metadata.workflow || {};
    const release = metadata.release || {};
    const recording = metadata.recording || {};
    const series = metadata.series || {};
    const distribution = metadata.distribution || {};

    // Store current episode data for editing
    this._currentEditEpisode = {
      series: episode.series,
      episode: episode.episode,
      path: episode.path,
      metadata: JSON.parse(JSON.stringify(metadata))
    };

    // Fetch detailed episode data with file list
    let episodeDetails;
    try {
      episodeDetails = await this.fetchAPI(`/episodes/${episode.series}/${episode.episode}`);
    } catch (error) {
      console.error('Failed to load episode details:', error);
      episodeDetails = { files: [] };
    }

    const files = episodeDetails.files || [];
    const releaseGroupId = release.release_group;
    const releaseGroup = releaseGroupId && releaseGroups[releaseGroupId];

    const workflowItems = [
      { key: 'scripted', label: 'Scripted' },
      { key: 'recorded', label: 'Recorded' },
      { key: 'edited', label: 'Edited' },
      { key: 'thumbnail_created', label: 'Thumbnail Created' },
      { key: 'uploaded', label: 'Uploaded' },
      { key: 'published', label: 'Published' }
    ];

    const workflowHTML = workflowItems.map(item => {
      const checked = workflow[item.key] === true;
      return `
        <div class="workflow-item workflow-item-interactive" data-workflow-key="${item.key}">
          <div class="workflow-checkbox ${checked ? 'checked' : ''}" data-workflow-key="${item.key}"></div>
          <span>${item.label}</span>
        </div>
      `;
    }).join('');

    // Determine initial preview file
    let previewFile = null;
    if (metadata.thumbnail) {
      previewFile = files.find(f => f.name === metadata.thumbnail);
    }
    if (!previewFile) {
      previewFile = files.find(f => this.isMediaFile(f.ext));
    }

    // Generate file browser HTML
    const fileBrowserHTML = this.renderFileBrowser(files, episode.path, previewFile);

    // Generate media preview HTML
    const mediaPreviewHTML = this.renderMediaPreview(previewFile, episode.path);

    // Release dependencies
    const dependencies = release.depends_on || [];
    const dependenciesHTML = dependencies.length > 0
      ? `<ul class="dependency-list">
          ${dependencies.map(dep => `<li class="dependency-item">${this.escapeHtml(dep)}</li>`).join('')}
         </ul>`
      : '<p class="text-muted">No dependencies</p>';

    // Distribution platforms
    const platforms = distribution.profiles ? Object.keys(distribution.profiles) : [];
    const platformsHTML = platforms.length > 0
      ? `<div class="distribution-badges">
          ${platforms.map(p => `<span class="platform-badge">${this.escapeHtml(p)}</span>`).join('')}
         </div>`
      : '<p class="text-muted">No platforms configured</p>';

    // Format tags for display and editing
    const tagsArray = metadata.tags || [];
    const tagsDisplay = tagsArray.filter(t => t && t.trim()).join(', ');

    const modalHTML = `
      <div class="modal-overlay" id="episode-modal">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-header-content">
              <div class="modal-title-view">${this.escapeHtml(metadata.title || episode.episode)}</div>
              <input type="text" class="modal-title-edit edit-field hidden" id="edit-title" value="${this.escapeHtml(metadata.title || '')}" placeholder="Episode title">
              <div class="modal-subtitle">${this.escapeHtml(episode.series)} / ${this.escapeHtml(episode.episode)}</div>
            </div>
            <div class="modal-header-actions">
              <button class="btn btn-secondary" id="edit-mode-btn">Edit</button>
              <button class="btn btn-primary hidden" id="save-episode-btn">Save</button>
              <button class="btn btn-secondary hidden" id="cancel-edit-btn">Cancel</button>
              <button class="modal-close" data-modal-close="episode-modal">x</button>
            </div>
          </div>
          <div class="modal-body" id="episode-modal-body">
            <div class="edit-status-bar hidden" id="edit-status-bar">
              <span class="edit-status-icon">Editing</span>
              <span class="edit-status-message" id="edit-status-message"></span>
            </div>
            <div class="modal-body-grid">
              <div class="modal-main-content">
                <!-- Media Preview -->
                <div class="modal-section">
                  <h3>Media Preview</h3>
                  ${mediaPreviewHTML}
                </div>

                <!-- Description -->
                <div class="modal-section">
                  <h3>Description</h3>
                  <p class="description-view">${this.escapeHtml(metadata.description || 'No description available')}</p>
                  <textarea class="description-edit edit-field hidden" id="edit-description" rows="6" placeholder="Episode description">${this.escapeHtml(metadata.description || '')}</textarea>
                </div>

                <!-- Metadata -->
                <div class="modal-section">
                  <h3>Metadata</h3>
                  <div class="metadata-grid">
                    <div class="metadata-item">
                      <div class="metadata-label">Content Status</div>
                      <div class="metadata-value metadata-value-view">
                        <span class="badge ${this.getStatusClass(metadata.content_status)}" id="status-badge">${metadata.content_status || 'draft'}</span>
                      </div>
                      <div class="metadata-value metadata-value-edit hidden">
                        <select class="edit-field" id="edit-content-status">
                          <option value="draft" ${metadata.content_status === 'draft' ? 'selected' : ''}>Draft</option>
                          <option value="ready" ${metadata.content_status === 'ready' ? 'selected' : ''}>Ready</option>
                          <option value="staged" ${metadata.content_status === 'staged' ? 'selected' : ''}>Staged</option>
                          <option value="released" ${metadata.content_status === 'released' ? 'selected' : ''}>Released</option>
                        </select>
                      </div>
                    </div>
                    <div class="metadata-item">
                      <div class="metadata-label">Series</div>
                      <div class="metadata-value">${this.escapeHtml(series.name || episode.series)}</div>
                    </div>
                    <div class="metadata-item">
                      <div class="metadata-label">Target Release Date</div>
                      <div class="metadata-value metadata-value-view" id="target-date-view">${this.escapeHtml(release.target_date || 'Not set')}</div>
                      <div class="metadata-value metadata-value-edit hidden">
                        <input type="date" class="edit-field" id="edit-target-date" value="${release.target_date || ''}">
                      </div>
                    </div>
                    <div class="metadata-item">
                      <div class="metadata-label">Tags</div>
                      <div class="metadata-value metadata-value-view" id="tags-view">${this.escapeHtml(tagsDisplay) || 'No tags'}</div>
                      <div class="metadata-value metadata-value-edit hidden">
                        <input type="text" class="edit-field" id="edit-tags" value="${this.escapeHtml(tagsDisplay)}" placeholder="Comma-separated tags">
                      </div>
                    </div>
                    ${recording.date ? `
                      <div class="metadata-item">
                        <div class="metadata-label">Recording Date</div>
                        <div class="metadata-value">${this.escapeHtml(recording.date)}</div>
                      </div>
                    ` : ''}
                    ${recording.duration_final ? `
                      <div class="metadata-item">
                        <div class="metadata-label">Duration</div>
                        <div class="metadata-value">${this.escapeHtml(recording.duration_final)}</div>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Workflow Progress -->
                <div class="modal-section">
                  <h3>Workflow Progress <span class="workflow-hint hidden" id="workflow-hint">(click to toggle)</span></h3>
                  <div class="workflow-checklist" id="workflow-checklist">
                    ${workflowHTML}
                  </div>
                </div>
              </div>

              <div class="modal-sidebar">
                <!-- File Browser -->
                <div class="modal-section">
                  <h3>Files</h3>
                  ${fileBrowserHTML}
                </div>

                <!-- Release Info -->
                <div class="modal-section">
                  <h3>Release Info</h3>
                  <div class="release-info-grid">
                    ${releaseGroup ? `
                      <div class="release-info-item">
                        <div class="release-info-label">Release Group</div>
                        <div class="release-info-value">${this.escapeHtml(releaseGroup.name || releaseGroupId)}</div>
                      </div>
                    ` : ''}
                    <div class="release-info-item">
                      <div class="release-info-label">Target Date</div>
                      <div class="release-info-value">${this.escapeHtml(release.target_date || 'Not set')}</div>
                    </div>
                    ${dependencies.length > 0 ? `
                      <div class="release-info-item">
                        <div class="release-info-label">Dependencies</div>
                        ${dependenciesHTML}
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Distribution -->
                ${platforms.length > 0 ? `
                  <div class="modal-section">
                    <h3>Distribution</h3>
                    ${platformsHTML}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.showModal('episode-modal', modalHTML);

    // Attach file click handlers
    this.attachFileClickHandlers(files, episode.path);

    // Attach close button handler
    const closeBtn = document.querySelector('[data-modal-close="episode-modal"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal('episode-modal'));
    }

    // Attach edit mode handlers
    this.attachEditModeHandlers(episode, releaseGroups);

    // If starting in edit mode, enable it
    if (startInEditMode) {
      this.toggleEditMode(true);
    }
  }

  renderFileBrowser(files, episodePath, activeFile) {
    if (!files || files.length === 0) {
      return '<div class="text-muted text-center" style="padding: 2rem;">No files found</div>';
    }

    const filesHTML = files
      .filter(f => f.type === 'file')
      .map(file => {
        const isActive = activeFile && file.name === activeFile.name;
        return `
          <div class="file-item ${isActive ? 'active' : ''}" data-file="${this.escapeHtml(file.name)}">
            <div class="file-icon">${this.getFileIcon(file)}</div>
            <div class="file-info">
              <div class="file-name">${this.escapeHtml(file.name)}</div>
              <div class="file-meta">
                <span class="file-size">${this.formatFileSize(file.size)}</span>
                <span class="file-date">${this.formatFileDate(file.modified)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

    return `
      <div class="file-browser">
        <div class="file-browser-header">${files.filter(f => f.type === 'file').length} Files</div>
        <div class="file-list">
          ${filesHTML}
        </div>
      </div>
    `;
  }

  renderMediaPreview(file, episodePath) {
    if (!file || !this.isMediaFile(file.ext)) {
      return `
        <div class="media-preview-container">
          <div class="media-preview">
            <div class="media-preview-placeholder">
              <div class="icon">🎬</div>
              <p>No media file selected</p>
            </div>
          </div>
        </div>
      `;
    }

    const filePath = `/content/${episodePath}/${file.name}`;
    const ext = file.ext;
    let mediaHTML = '';

    if (['.mp4', '.mov', '.webm'].includes(ext)) {
      mediaHTML = `<video controls src="${filePath}">Your browser does not support video playback.</video>`;
    } else if (['.mp3', '.wav', '.m4a'].includes(ext)) {
      mediaHTML = `<audio controls src="${filePath}">Your browser does not support audio playback.</audio>`;
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      mediaHTML = `<img src="${filePath}" alt="${this.escapeHtml(file.name)}">`;
    }

    return `
      <div class="media-preview-container">
        <div class="media-preview" id="media-preview">
          ${mediaHTML}
        </div>
      </div>
    `;
  }

  attachFileClickHandlers(files, episodePath) {
    document.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const fileName = item.dataset.file;
        const file = files.find(f => f.name === fileName);

        if (file && this.isMediaFile(file.ext)) {
          document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');

          const previewContainer = document.getElementById('media-preview');
          if (previewContainer) {
            const filePath = `/content/${episodePath}/${file.name}`;
            const ext = file.ext;
            let mediaHTML = '';

            if (['.mp4', '.mov', '.webm'].includes(ext)) {
              mediaHTML = `<video controls src="${filePath}">Your browser does not support video playback.</video>`;
            } else if (['.mp3', '.wav', '.m4a'].includes(ext)) {
              mediaHTML = `<audio controls src="${filePath}">Your browser does not support audio playback.</audio>`;
            } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
              mediaHTML = `<img src="${filePath}" alt="${this.escapeHtml(file.name)}">`;
            }

            previewContainer.innerHTML = mediaHTML;
          }
        }
      });
    });
  }

  toggleEditMode(enabled) {
    const modal = document.getElementById('episode-modal');
    if (!modal) return;

    const editBtn = document.getElementById('edit-mode-btn');
    const saveBtn = document.getElementById('save-episode-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const statusBar = document.getElementById('edit-status-bar');
    const workflowHint = document.getElementById('workflow-hint');

    if (editBtn) editBtn.classList.toggle('hidden', enabled);
    if (saveBtn) saveBtn.classList.toggle('hidden', !enabled);
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !enabled);
    if (statusBar) statusBar.classList.toggle('hidden', !enabled);
    if (workflowHint) workflowHint.classList.toggle('hidden', !enabled);

    modal.querySelectorAll('.modal-title-view').forEach(el => el.classList.toggle('hidden', enabled));
    modal.querySelectorAll('.modal-title-edit').forEach(el => el.classList.toggle('hidden', !enabled));
    modal.querySelectorAll('.description-view').forEach(el => el.classList.toggle('hidden', enabled));
    modal.querySelectorAll('.description-edit').forEach(el => el.classList.toggle('hidden', !enabled));
    modal.querySelectorAll('.metadata-value-view').forEach(el => el.classList.toggle('hidden', enabled));
    modal.querySelectorAll('.metadata-value-edit').forEach(el => el.classList.toggle('hidden', !enabled));

    const workflowChecklist = document.getElementById('workflow-checklist');
    if (workflowChecklist) {
      workflowChecklist.classList.toggle('workflow-editable', enabled);
    }

    this._isEditMode = enabled;
  }

  attachEditModeHandlers(episode, releaseGroups) {
    const editBtn = document.getElementById('edit-mode-btn');
    const saveBtn = document.getElementById('save-episode-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.toggleEditMode(true);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.toggleEditMode(false);
        this.resetEditForm();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await this.saveEpisodeChanges(episode, releaseGroups);
      });
    }

    this.attachWorkflowCheckboxHandlers();
  }

  resetEditForm() {
    if (!this._currentEditEpisode) return;

    const metadata = this._currentEditEpisode.metadata;
    const release = metadata.release || {};
    const tagsArray = metadata.tags || [];

    const titleInput = document.getElementById('edit-title');
    const descInput = document.getElementById('edit-description');
    const statusSelect = document.getElementById('edit-content-status');
    const targetDateInput = document.getElementById('edit-target-date');
    const tagsInput = document.getElementById('edit-tags');

    if (titleInput) titleInput.value = metadata.title || '';
    if (descInput) descInput.value = metadata.description || '';
    if (statusSelect) statusSelect.value = metadata.content_status || 'draft';
    if (targetDateInput) targetDateInput.value = release.target_date || '';
    if (tagsInput) tagsInput.value = tagsArray.filter(t => t && t.trim()).join(', ');

    const workflow = metadata.workflow || {};
    document.querySelectorAll('.workflow-checkbox').forEach(checkbox => {
      const key = checkbox.dataset.workflowKey;
      if (key) {
        checkbox.classList.toggle('checked', workflow[key] === true);
      }
    });
  }

  attachWorkflowCheckboxHandlers() {
    document.querySelectorAll('.workflow-item-interactive').forEach(item => {
      item.addEventListener('click', async () => {
        if (!this._isEditMode) return;

        const checkbox = item.querySelector('.workflow-checkbox');
        if (!checkbox) return;

        checkbox.classList.toggle('checked');
      });
    });
  }

  collectEditFormData() {
    const data = {};

    const titleInput = document.getElementById('edit-title');
    if (titleInput && titleInput.value.trim()) {
      data.title = titleInput.value.trim();
    }

    const descInput = document.getElementById('edit-description');
    if (descInput) {
      data.description = descInput.value.trim();
    }

    const statusSelect = document.getElementById('edit-content-status');
    if (statusSelect) {
      data.content_status = statusSelect.value;
    }

    const targetDateInput = document.getElementById('edit-target-date');
    if (targetDateInput) {
      data.release = {
        target_date: targetDateInput.value || ''
      };
    }

    const tagsInput = document.getElementById('edit-tags');
    if (tagsInput) {
      const tagsStr = tagsInput.value.trim();
      data.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
    }

    const workflow = {};
    document.querySelectorAll('.workflow-checkbox').forEach(checkbox => {
      const key = checkbox.dataset.workflowKey;
      if (key) {
        workflow[key] = checkbox.classList.contains('checked');
      }
    });
    data.workflow = workflow;

    return data;
  }

  async saveEpisodeChanges(_episode, _releaseGroups) {
    const saveBtn = document.getElementById('save-episode-btn');
    const statusMessage = document.getElementById('edit-status-message');

    if (!this._currentEditEpisode) {
      console.error('No episode data for saving');
      return;
    }

    const updates = this.collectEditFormData();

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }
    if (statusMessage) {
      statusMessage.textContent = 'Saving changes...';
    }

    try {
      const response = await fetch(`/api/episodes/${this._currentEditEpisode.series}/${this._currentEditEpisode.episode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.errors?.join(', ') || 'Failed to save changes');
      }

      this._currentEditEpisode.metadata = result.metadata;
      this.updateViewModeDisplay(result.metadata);

      if (statusMessage) {
        statusMessage.textContent = 'Changes saved successfully!';
        statusMessage.classList.add('success');
      }

      setTimeout(() => {
        this.toggleEditMode(false);
        if (statusMessage) {
          statusMessage.classList.remove('success');
        }
      }, 1500);

      if (this.currentView === 'pipeline') {
        renderPipeline(this);
      }

    } catch (error) {
      console.error('Error saving episode:', error);
      if (statusMessage) {
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.classList.add('error');
        setTimeout(() => {
          statusMessage.classList.remove('error');
          statusMessage.textContent = '';
        }, 3000);
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    }
  }

  updateViewModeDisplay(metadata) {
    const titleView = document.querySelector('.modal-title-view');
    if (titleView) {
      titleView.textContent = metadata.title || '';
    }

    const descView = document.querySelector('.description-view');
    if (descView) {
      descView.textContent = metadata.description || 'No description available';
    }

    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
      statusBadge.textContent = metadata.content_status || 'draft';
      statusBadge.className = `badge ${this.getStatusClass(metadata.content_status)}`;
    }

    const targetDateView = document.getElementById('target-date-view');
    if (targetDateView) {
      targetDateView.textContent = metadata.release?.target_date || 'Not set';
    }

    const tagsView = document.getElementById('tags-view');
    if (tagsView) {
      const tagsDisplay = (metadata.tags || []).filter(t => t && t.trim()).join(', ');
      tagsView.textContent = tagsDisplay || 'No tags';
    }
  }

  showNewEpisodeModal() {
    const seriesOptions = this.seriesList.map(series =>
      `<option value="${this.escapeHtml(series)}">${this.escapeHtml(series)}</option>`
    ).join('');

    const profileOptions = this.distributionProfiles.map(profile =>
      `<option value="${this.escapeHtml(profile.id)}" ${profile.id === 'full' ? 'selected' : ''}>${this.escapeHtml(profile.id)} - ${this.escapeHtml(profile.description)}</option>`
    ).join('');

    const modalHTML = `
      <div class="modal-overlay" id="new-episode-modal">
        <div class="modal new-episode-modal">
          <div class="modal-header">
            <div>
              <div class="modal-title">Create New Episode</div>
              <div class="modal-subtitle">Set up a new episode with metadata and folder structure</div>
            </div>
            <button class="modal-close" data-modal-close="new-episode-modal">x</button>
          </div>
          <div class="modal-body">
            <form id="new-episode-form" class="episode-form">
              <div class="form-group">
                <label for="episode-series" class="form-label">Series <span class="required">*</span></label>
                <div class="series-input-group">
                  <select id="episode-series-select" class="form-select">
                    <option value="">-- Select Series --</option>
                    ${seriesOptions}
                    <option value="__new__">+ Create New Series</option>
                  </select>
                  <input type="text" id="episode-series-new" class="form-input hidden" placeholder="Enter new series name">
                </div>
                <div class="form-error" id="series-error"></div>
              </div>

              <div class="form-group">
                <label for="episode-topic" class="form-label">Topic / Slug <span class="required">*</span></label>
                <input type="text" id="episode-topic" class="form-input" placeholder="e.g., getting-started, api-overview">
                <div class="form-hint">Used in folder name. Lowercase, hyphens allowed, no spaces.</div>
                <div class="form-error" id="topic-error"></div>
              </div>

              <div class="form-group">
                <label for="episode-title" class="form-label">Title <span class="required">*</span></label>
                <input type="text" id="episode-title" class="form-input" placeholder="Episode title for display">
                <div class="form-error" id="title-error"></div>
              </div>

              <div class="form-group">
                <label for="episode-description" class="form-label">Description</label>
                <textarea id="episode-description" class="form-textarea" rows="4" placeholder="Brief description of the episode content..."></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="episode-target-date" class="form-label">Target Release Date</label>
                  <input type="date" id="episode-target-date" class="form-input">
                </div>

                <div class="form-group">
                  <label for="episode-distribution" class="form-label">Distribution Profile</label>
                  <select id="episode-distribution" class="form-select">
                    ${profileOptions}
                  </select>
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close="new-episode-modal">Cancel</button>
                <button type="submit" class="btn btn-primary" id="create-episode-btn">
                  <span class="btn-text">Create Episode</span>
                  <span class="btn-loading hidden">Creating...</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    this.showModal('new-episode-modal', modalHTML);
    this.attachNewEpisodeFormListeners();
  }

  attachNewEpisodeFormListeners() {
    const form = document.getElementById('new-episode-form');
    const seriesSelect = document.getElementById('episode-series-select');
    const seriesNewInput = document.getElementById('episode-series-new');
    const topicInput = document.getElementById('episode-topic');

    seriesSelect.addEventListener('change', () => {
      if (seriesSelect.value === '__new__') {
        seriesNewInput.classList.remove('hidden');
        seriesNewInput.focus();
      } else {
        seriesNewInput.classList.add('hidden');
        seriesNewInput.value = '';
      }
    });

    topicInput.addEventListener('input', () => {
      const value = topicInput.value;
      const slugified = this.slugify(value);
      if (value !== slugified && value.toLowerCase() === value) {
        topicInput.value = slugified;
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleNewEpisodeSubmit();
    });

    document.querySelectorAll('[data-modal-close="new-episode-modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal('new-episode-modal'));
    });
  }

  async handleNewEpisodeSubmit() {
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => el.classList.remove('error'));

    const seriesSelect = document.getElementById('episode-series-select');
    const seriesNewInput = document.getElementById('episode-series-new');
    const topicInput = document.getElementById('episode-topic');
    const titleInput = document.getElementById('episode-title');
    const descriptionInput = document.getElementById('episode-description');
    const targetDateInput = document.getElementById('episode-target-date');
    const distributionSelect = document.getElementById('episode-distribution');
    const submitBtn = document.getElementById('create-episode-btn');

    let series = seriesSelect.value === '__new__' ? seriesNewInput.value.trim() : seriesSelect.value;
    const topic = this.slugify(topicInput.value.trim());
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const targetDate = targetDateInput.value;
    const distributionProfile = distributionSelect.value;

    let hasErrors = false;

    if (!series) {
      document.getElementById('series-error').textContent = 'Please select or enter a series name';
      if (seriesSelect.value === '__new__') {
        seriesNewInput.classList.add('error');
      } else {
        seriesSelect.classList.add('error');
      }
      hasErrors = true;
    } else if (!this.validateSeriesName(series)) {
      document.getElementById('series-error').textContent = 'Invalid series name. Use letters, numbers, spaces, hyphens, and underscores only.';
      if (seriesSelect.value === '__new__') {
        seriesNewInput.classList.add('error');
      } else {
        seriesSelect.classList.add('error');
      }
      hasErrors = true;
    }

    if (!topic) {
      document.getElementById('topic-error').textContent = 'Topic/slug is required';
      topicInput.classList.add('error');
      hasErrors = true;
    } else if (!this.validateSlug(topic)) {
      document.getElementById('topic-error').textContent = 'Invalid slug. Use lowercase letters, numbers, and hyphens only.';
      topicInput.classList.add('error');
      hasErrors = true;
    }

    if (!title) {
      document.getElementById('title-error').textContent = 'Title is required';
      titleInput.classList.add('error');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').classList.add('hidden');
    submitBtn.querySelector('.btn-loading').classList.remove('hidden');

    try {
      const response = await fetch('/api/episodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          series,
          topic,
          title,
          description,
          targetDate,
          distributionProfile
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create episode');
      }

      this.closeModal('new-episode-modal');
      this.showNotification(`Episode "${title}" created successfully!`, 'success');

      if (!this.seriesList.includes(series)) {
        this.seriesList.push(series);
        this.seriesList.sort();
      }

      await renderPipeline(this);

    } catch (error) {
      console.error('Error creating episode:', error);
      this.showNotification(error.message || 'Failed to create episode', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').classList.remove('hidden');
      submitBtn.querySelector('.btn-loading').classList.add('hidden');
    }
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});
