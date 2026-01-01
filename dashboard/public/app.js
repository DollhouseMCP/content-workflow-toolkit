// Content Workflow Dashboard - Frontend Application

/**
 * @fileoverview Frontend application for the Content Workflow Dashboard.
 * Provides a visual interface for managing episodes, releases, assets, and distribution.
 * @module dashboard/app
 */

/**
 * Episode metadata from episode.yml files.
 * @typedef {Object} EpisodeMetadata
 * @property {string} [title] - Display title of the episode
 * @property {string} [description] - Episode description
 * @property {string} [content_status] - Current status: 'draft', 'ready', 'staged', 'released'
 * @property {string} [thumbnail] - Filename of the thumbnail image
 * @property {string[]} [tags] - Array of tags for categorization
 * @property {Object} [workflow] - Workflow progress tracking
 * @property {boolean} [workflow.scripted] - Whether script is complete
 * @property {boolean} [workflow.recorded] - Whether recording is complete
 * @property {boolean} [workflow.edited] - Whether editing is complete
 * @property {boolean} [workflow.thumbnail_created] - Whether thumbnail is created
 * @property {boolean} [workflow.uploaded] - Whether content is uploaded
 * @property {boolean} [workflow.published] - Whether content is published
 * @property {Object} [release] - Release scheduling information
 * @property {string} [release.target_date] - Target release date (YYYY-MM-DD)
 * @property {string} [release.release_group] - Associated release group ID
 * @property {string[]} [release.depends_on] - Dependencies that must be released first
 * @property {Object} [recording] - Recording metadata
 * @property {string} [recording.date] - Recording date
 * @property {string} [recording.duration_final] - Final duration
 * @property {Object} [analytics] - Analytics data
 * @property {string} [analytics.publish_date] - Actual publish date
 * @property {Object} [distribution] - Distribution configuration
 * @property {Object} [distribution.profiles] - Platform-specific distribution settings
 * @property {Object} [series] - Series-level metadata
 */

/**
 * Episode object returned from the API.
 * @typedef {Object} Episode
 * @property {string} path - Relative path to the episode directory (e.g., 'series-name/YYYY-MM-DD-slug')
 * @property {string} series - Name of the series
 * @property {string} episode - Episode identifier (folder name)
 * @property {EpisodeMetadata} [metadata] - Parsed episode metadata from episode.yml
 */

/**
 * Release calendar item representing a scheduled or released piece of content.
 * @typedef {Object} ReleaseItem
 * @property {'episode'|'release_group'|'staged'|'released'} type - Type of release item
 * @property {'scheduled'|'released'} status - Current release status
 * @property {Date} date - The scheduled or actual release date
 * @property {string} title - Display title for the item
 * @property {string} [series] - Series name (for episodes)
 * @property {Episode} [episode] - Full episode object (for episode items)
 * @property {string} [releaseGroup] - Associated release group ID
 * @property {string} [contentStatus] - Content workflow status
 * @property {string} [path] - File path (for staged/released items)
 * @property {string} [groupId] - Release group ID (for release_group items)
 * @property {Object} [group] - Release group configuration
 * @property {number} [itemCount] - Number of items in a release group
 */

/**
 * Asset node in the file tree structure.
 * @typedef {Object} AssetNode
 * @property {string} name - File or folder name
 * @property {'file'|'directory'} type - Node type
 * @property {string} path - Relative path from assets root
 * @property {string} [ext] - File extension (for files)
 * @property {number} [size] - File size in bytes (for files)
 * @property {string} [modified] - Last modified date ISO string
 * @property {number} [fileCount] - Number of files in directory (for directories)
 * @property {AssetNode[]} [children] - Child nodes (for directories)
 */

/**
 * File object representing a file in an episode directory.
 * @typedef {Object} EpisodeFile
 * @property {string} name - File name
 * @property {'file'|'directory'} type - Node type
 * @property {string} ext - File extension
 * @property {number} size - File size in bytes
 * @property {string} modified - Last modified date ISO string
 */

/**
 * Distribution profile configuration.
 * @typedef {Object} DistributionProfile
 * @property {string} id - Profile identifier
 * @property {string} name - Display name
 * @property {string} [description] - Profile description
 * @property {Object} [platforms] - Platform-specific settings
 */

/**
 * Release group configuration from release-queue.yml.
 * @typedef {Object} ReleaseGroup
 * @property {string} [name] - Display name for the group
 * @property {string} [description] - Group description
 * @property {string} [status] - Group status
 * @property {string} [target_date] - Target release date
 * @property {Array<{path: string, distribution: string}>} [items] - Items in the group
 * @property {string[]} [dependencies] - Required dependencies
 */

/**
 * Asset browser state for managing folder expansion and selection.
 * @typedef {Object} AssetBrowserState
 * @property {Set<string>} expandedFolders - Set of expanded folder paths
 * @property {AssetNode|null} selectedFile - Currently selected file
 * @property {string} selectedFolder - Currently selected folder path
 * @property {string} searchQuery - Current search filter text
 * @property {'all'|'image'|'video'|'audio'|'document'} filterType - Current file type filter
 * @property {boolean} isUploading - Whether an upload is in progress
 * @property {number} uploadProgress - Upload progress percentage
 * @property {Object|null} contextMenu - Context menu state
 */

/**
 * Calendar view state for navigation and filtering.
 * @typedef {Object} CalendarState
 * @property {Date} currentDate - Currently displayed month/year
 * @property {'calendar'|'list'} viewMode - Current view mode
 * @property {'all'|'upcoming'|'released'} filter - Current filter setting
 */

/**
 * Pipeline view state for filtering and sorting.
 * @typedef {Object} PipelineState
 * @property {string} filterSeries - Series filter ('all' or series name)
 * @property {'created'|'target_release'} sortBy - Sort order
 */

// Configuration constants
const DASHBOARD_CONFIG = {
    // Calendar display settings
    CALENDAR_MAX_ITEMS_PER_DAY: 3,
    CALENDAR_TITLE_MAX_LENGTH: 20,

    // UI feedback delays (milliseconds)
    COPY_BUTTON_RESET_DELAY: 2000,
    MARKDOWN_RENDER_DELAY: 50,
    MERMAID_RENDER_DELAY: 100,

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

/**
 * Main Dashboard application class.
 * Manages the UI for the content workflow dashboard including views for
 * pipeline, episodes, calendar, releases, assets, and distribution.
 *
 * @class Dashboard
 * @example
 * // Dashboard is automatically initialized on DOMContentLoaded
 * document.addEventListener('DOMContentLoaded', () => {
 *     new Dashboard();
 * });
 */
class Dashboard {
    /**
     * Creates a new Dashboard instance and initializes the application.
     * Sets up initial state, event listeners, and loads the default view.
     *
     * @constructor
     * @property {string} currentView - The currently active view ('pipeline', 'episodes', 'calendar', 'releases', 'assets', 'distribution')
     * @property {Object} data - Cached data from API responses
     * @property {string[]} seriesList - List of available series names
     * @property {DistributionProfile[]} distributionProfiles - Available distribution profiles
     * @property {PipelineState} [pipelineState] - State for pipeline view filtering/sorting
     * @property {CalendarState} [calendarState] - State for calendar view navigation
     * @property {AssetBrowserState} [assetBrowserState] - State for asset browser
     */
    constructor() {
        this.currentView = 'episodes';
        this.data = {};
        this.seriesList = [];
        this.distributionProfiles = [];
        this.init();
    }

    /**
     * Initializes the dashboard application.
     * Sets up markdown rendering, event listeners, live reload,
     * loads initial data, and renders the default pipeline view.
     *
     * @async
     * @returns {Promise<void>}
     */
    async init() {
        this.setupMarkdown();
        this.setupEventListeners();
        this.setupLiveReload();
        await this.loadInitialData();
        await this.loadView('pipeline');
    }

    /**
     * Pre-loads series list and distribution profiles for the new episode modal.
     * Called during initialization to ensure data is available before user interaction.
     *
     * @async
     * @returns {Promise<void>}
     */
    async loadInitialData() {
        // Pre-load series list and distribution profiles for the new episode modal
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

    /**
     * Initializes markdown and mermaid rendering libraries.
     * Configures marked for GitHub Flavored Markdown and mermaid for diagram support.
     *
     * @returns {void}
     */
    setupMarkdown() {
        // Initialize mermaid for diagram rendering
        try {
            if (typeof mermaid !== 'undefined') {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
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

    /**
     * Renders markdown content to HTML with mermaid diagram support.
     * Extracts mermaid code blocks and renders them as SVG diagrams after the main content.
     *
     * @async
     * @param {string} content - Raw markdown content to render
     * @returns {Promise<string>} Rendered HTML string
     */
    async renderMarkdown(content) {
        if (typeof marked === 'undefined') {
            return `<pre>${this.escapeHtml(content)}</pre>`;
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
                for (const block of mermaidBlocks) {
                    const container = document.getElementById(block.id);
                    if (container) {
                        try {
                            const { svg } = await mermaid.render(`${block.id}-svg`, block.diagram);
                            container.innerHTML = svg;
                        } catch (e) {
                            container.innerHTML = `<pre class="mermaid-error">Diagram error: ${e.message}</pre>`;
                        }
                    }
                }
            }, DASHBOARD_CONFIG.MERMAID_RENDER_DELAY);
        }

        return html;
    }

    /**
     * Sets up event listeners for navigation buttons.
     * Attaches click handlers to nav buttons that trigger view switching.
     *
     * @returns {void}
     */
    setupEventListeners() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });
    }

    /**
     * Sets up Server-Sent Events (SSE) connection for live content reloading.
     * Automatically refreshes the current view when content changes are detected.
     *
     * @returns {void}
     * @fires Dashboard#reload - When content changes are detected
     */
    setupLiveReload() {
        const eventSource = new EventSource('/api/events');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'reload') {
                console.log('Content changed, reloading view...');
                this.loadView(this.currentView);
            }
        };

        eventSource.onerror = () => {
            console.error('SSE connection error');
            document.getElementById('connection-status').innerHTML =
                '<span class="dot" style="background-color: var(--error);"></span> Disconnected';
        };
    }

    /**
     * Switches to a different dashboard view.
     * Updates the navigation button states and loads the new view.
     *
     * @param {string} view - View name to switch to ('pipeline', 'episodes', 'calendar', 'releases', 'assets', 'distribution')
     * @returns {void}
     */
    switchView(view) {
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });

        this.loadView(view);
    }

    /**
     * Loads and renders a specific dashboard view.
     * Shows a loading state while fetching data, then renders the appropriate view.
     *
     * @async
     * @param {string} view - View name to load ('pipeline', 'episodes', 'calendar', 'releases', 'assets', 'distribution')
     * @returns {Promise<void>}
     * @throws {Error} Displays error message in UI if view fails to load
     */
    async loadView(view) {
        this.currentView = view;
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading...</div>';

        try {
            switch (view) {
                case 'pipeline':
                    await this.renderPipeline();
                    break;
                case 'episodes':
                    await this.renderEpisodes();
                    break;
                case 'calendar':
                    await this.renderCalendar();
                    break;
                case 'releases':
                    await this.renderReleases();
                    break;
                case 'assets':
                    await this.renderAssets();
                    break;
                case 'distribution':
                    await this.renderDistribution();
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

    /**
     * Makes an API request to the dashboard backend.
     *
     * @async
     * @param {string} endpoint - API endpoint path (e.g., '/episodes', '/releases')
     * @returns {Promise<Object>} Parsed JSON response from the API
     * @throws {Error} If the API request fails or returns a non-OK status
     */
    async fetchAPI(endpoint) {
        const response = await fetch(`/api${endpoint}`);
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return await response.json();
    }

    /**
     * Renders the pipeline view as a Kanban board.
     * Shows episodes organized by content status (draft, ready, staged, released)
     * with filtering and sorting options.
     *
     * @async
     * @returns {Promise<void>}
     */
    async renderPipeline() {
        const result = await this.fetchAPI('/episodes');
        const releaseQueueResult = await this.fetchAPI('/releases');
        const content = document.getElementById('content');

        if (!result.success) {
            content.innerHTML = '<div class="error">Failed to load episodes</div>';
            return;
        }

        // Extract release groups from release queue
        const releaseGroups = releaseQueueResult.success && releaseQueueResult.data.release_groups
            ? releaseQueueResult.data.release_groups
            : {};

        // Get all unique series for filtering
        const allSeries = [...new Set(result.episodes.map(ep => ep.series))].sort();

        // Store state for filtering/sorting
        if (!this.pipelineState) {
            this.pipelineState = {
                filterSeries: 'all',
                sortBy: 'created'
            };
        }

        // Filter and sort episodes
        let episodes = result.episodes;

        if (this.pipelineState.filterSeries !== 'all') {
            episodes = episodes.filter(ep => ep.series === this.pipelineState.filterSeries);
        }

        // Sort episodes
        episodes.sort((a, b) => {
            if (this.pipelineState.sortBy === 'created') {
                // Sort by episode name (which includes date YYYY-MM-DD)
                return b.episode.localeCompare(a.episode);
            } else if (this.pipelineState.sortBy === 'target_release') {
                const dateA = a.metadata?.release?.target_date || '';
                const dateB = b.metadata?.release?.target_date || '';
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateA.localeCompare(dateB);
            }
            return 0;
        });

        // Group episodes by content_status
        const columns = {
            draft: { title: 'Draft', episodes: [] },
            ready: { title: 'Ready', episodes: [] },
            staged: { title: 'Staged', episodes: [] },
            released: { title: 'Released', episodes: [] }
        };

        episodes.forEach(episode => {
            const status = episode.metadata?.content_status || 'draft';
            if (columns[status]) {
                columns[status].episodes.push(episode);
            } else {
                columns.draft.episodes.push(episode);
            }
        });

        // Generate series filter options
        const seriesOptions = allSeries.map(series =>
            `<option value="${series}" ${this.pipelineState.filterSeries === series ? 'selected' : ''}>${this.escapeHtml(series)}</option>`
        ).join('');

        // Generate Kanban board HTML
        const kanbanHTML = Object.entries(columns).map(([status, data]) => {
            const cardsHTML = data.episodes.map(episode => this.renderEpisodeCard(episode, releaseGroups)).join('');

            return `
                <div class="kanban-column">
                    <div class="column-header ${status}">
                        <span class="column-title">${data.title}</span>
                        <span class="column-count">${data.episodes.length}</span>
                    </div>
                    <div class="column-cards">
                        ${cardsHTML || '<div class="text-muted text-center" style="padding: 2rem;">No episodes</div>'}
                    </div>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="view">
                <div class="section-header pipeline-header">
                    <div class="section-header-text">
                        <h2>Content Pipeline</h2>
                        <p>Track content progress through your workflow</p>
                    </div>
                    <button class="btn btn-primary" id="new-episode-btn">
                        <span class="btn-icon">+</span> New Episode
                    </button>
                </div>

                <div class="pipeline-controls">
                    <div class="filter-group">
                        <label class="filter-label" for="series-filter">Series:</label>
                        <select class="filter-select" id="series-filter">
                            <option value="all" ${this.pipelineState.filterSeries === 'all' ? 'selected' : ''}>All Series</option>
                            ${seriesOptions}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label" for="sort-filter">Sort by:</label>
                        <select class="filter-select" id="sort-filter">
                            <option value="created" ${this.pipelineState.sortBy === 'created' ? 'selected' : ''}>Date Created</option>
                            <option value="target_release" ${this.pipelineState.sortBy === 'target_release' ? 'selected' : ''}>Target Release</option>
                        </select>
                    </div>
                </div>

                <div class="kanban-board">
                    ${kanbanHTML}
                </div>
            </div>
        `;

        // Attach event listeners
        document.getElementById('series-filter').addEventListener('change', (e) => {
            this.pipelineState.filterSeries = e.target.value;
            this.renderPipeline();
        });

        document.getElementById('sort-filter').addEventListener('change', (e) => {
            this.pipelineState.sortBy = e.target.value;
            this.renderPipeline();
        });

        // New Episode button
        document.getElementById('new-episode-btn').addEventListener('click', () => {
            this.showNewEpisodeModal();
        });

        // Attach click listeners to episode cards
        document.querySelectorAll('.episode-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking on status dropdown
                if (e.target.closest('.status-dropdown-container') || e.target.closest('.status-dropdown')) {
                    return;
                }
                const episodePath = card.dataset.episodePath;
                const episode = episodes.find(ep => ep.path === episodePath);
                if (episode) {
                    this.showEpisodeModal(episode, releaseGroups);
                }
            });
        });

        // Attach inline status dropdown handlers
        this.attachInlineStatusHandlers(episodes);
    }

    /**
     * Attaches click handlers for inline status dropdowns on episode cards.
     * Allows users to change episode status directly from the pipeline view.
     *
     * @param {Episode[]} episodes - Array of episodes to attach handlers for
     * @returns {void}
     */
    attachInlineStatusHandlers(episodes) {
        document.querySelectorAll('.status-badge-clickable').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                const container = badge.closest('.status-dropdown-container');
                if (!container) return;

                // Close any existing dropdown
                this.closeStatusDropdowns();

                // Get current status
                const currentStatus = badge.dataset.currentStatus;

                // Create dropdown
                // Note: Status values are hardcoded (not user input), so XSS is not a concern here
                // Using escapeHtml for defense-in-depth
                const dropdown = document.createElement('div');
                dropdown.className = 'status-dropdown';
                dropdown.innerHTML = ['draft', 'ready', 'staged', 'released'].map(status => `
                    <div class="status-dropdown-item ${status === currentStatus ? 'active' : ''}" data-status="${this.escapeHtml(status)}">
                        <span class="status-dot ${this.escapeHtml(status)}"></span>
                        <span>${this.escapeHtml(status)}</span>
                    </div>
                `).join('');

                container.appendChild(dropdown);

                // Handle dropdown item clicks
                dropdown.querySelectorAll('.status-dropdown-item').forEach(item => {
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const newStatus = item.dataset.status;
                        if (newStatus !== currentStatus) {
                            await this.updateInlineStatus(container, newStatus, episodes);
                        }
                        this.closeStatusDropdowns();
                    });
                });

                // Close dropdown when clicking outside
                // Use setTimeout to avoid immediately triggering the handler from this click
                setTimeout(() => {
                    // Remove any existing listener before adding a new one (prevents memory leak)
                    if (this._statusDropdownCloseHandler) {
                        document.removeEventListener('click', this._statusDropdownCloseHandler);
                    }
                    this._statusDropdownCloseHandler = (e) => {
                        if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-badge-clickable')) {
                            this.closeStatusDropdowns();
                        }
                    };
                    document.addEventListener('click', this._statusDropdownCloseHandler);
                }, 0);
            });
        });
    }

    /**
     * Closes all open status dropdown menus.
     * Removes dropdown elements and cleans up document click handlers.
     *
     * @returns {void}
     */
    closeStatusDropdowns() {
        document.querySelectorAll('.status-dropdown').forEach(dropdown => dropdown.remove());
        if (this._statusDropdownCloseHandler) {
            document.removeEventListener('click', this._statusDropdownCloseHandler);
            this._statusDropdownCloseHandler = null;
        }
    }

    /**
     * Updates an episode's status via the API from an inline dropdown.
     * Shows loading state during update and refreshes the pipeline on success.
     *
     * @async
     * @param {HTMLElement} container - The dropdown container element with episode data attributes
     * @param {string} newStatus - New status value ('draft', 'ready', 'staged', 'released')
     * @param {Episode[]} episodes - Array of episodes (unused, kept for compatibility)
     * @returns {Promise<void>}
     */
    async updateInlineStatus(container, newStatus, episodes) {
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
            badge.className = `badge ${this.getStatusClass(newStatus)} status-badge-clickable`;

            // Refresh the pipeline view to move card to new column
            this.renderPipeline();

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

    /**
     * Renders an episode card for the pipeline Kanban board.
     *
     * @param {Episode} episode - Episode data to render
     * @param {Object<string, ReleaseGroup>} [releaseGroups={}] - Map of release group IDs to group data
     * @returns {string} HTML string for the episode card
     */
    renderEpisodeCard(episode, releaseGroups = {}) {
        const metadata = episode.metadata || {};
        const title = metadata.title || episode.episode;
        const series = episode.series;
        const workflow = metadata.workflow || {};
        const release = metadata.release || {};
        const contentStatus = metadata.content_status || 'draft';

        // Determine thumbnail
        const thumbnailPath = metadata.thumbnail;
        const hasThumbnail = thumbnailPath && thumbnailPath !== '';
        const thumbnailStyle = hasThumbnail
            ? `background-image: url('/content/${episode.path}/${thumbnailPath}');`
            : '';

        // Series badge class
        const seriesBadgeClass = this.getSeriesBadgeClass(series);

        // Workflow indicators (scripted, recorded, edited)
        const workflowIndicators = [
            { key: 'scripted', label: 'Scripted' },
            { key: 'recorded', label: 'Recorded' },
            { key: 'edited', label: 'Edited' }
        ].map(indicator => {
            const completed = workflow[indicator.key] === true;
            return `<div class="workflow-indicator ${completed ? 'completed' : ''}" title="${indicator.label}"></div>`;
        }).join('');

        // Target date display
        const targetDate = release.target_date;
        const targetDateHTML = targetDate
            ? `<div class="target-date">📅 ${this.formatDate(targetDate)}</div>`
            : '';

        // Release group badge
        const releaseGroupId = release.release_group;
        const releaseGroup = releaseGroupId && releaseGroups[releaseGroupId];
        const releaseGroupHTML = releaseGroup
            ? `<div class="release-group-badge">${this.escapeHtml(releaseGroup.name || releaseGroupId)}</div>`
            : '';

        // Inline status dropdown
        const statusDropdownHTML = `
            <div class="status-dropdown-container" data-episode-series="${this.escapeHtml(episode.series)}" data-episode-id="${this.escapeHtml(episode.episode)}">
                <span class="badge ${this.getStatusClass(contentStatus)} status-badge-clickable" data-current-status="${contentStatus}">${contentStatus}</span>
            </div>
        `;

        return `
            <div class="episode-card" data-episode-path="${episode.path}">
                <div class="episode-thumbnail ${hasThumbnail ? '' : 'placeholder'}" style="${thumbnailStyle}">
                    ${hasThumbnail ? '' : '🎬'}
                </div>
                <div class="episode-card-body">
                    <div class="episode-title">${this.escapeHtml(title)}</div>
                    <div class="episode-meta">
                        <div class="series-badge ${seriesBadgeClass}">${this.escapeHtml(series)}</div>
                        ${statusDropdownHTML}
                        <div class="workflow-indicators">
                            ${workflowIndicators}
                        </div>
                        ${targetDateHTML}
                        ${releaseGroupHTML}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Gets the CSS class for a series badge based on series name.
     *
     * @param {string} series - Series name
     * @returns {string} CSS class name for the series badge
     */
    getSeriesBadgeClass(series) {
        const normalized = series.toLowerCase().replace(/\s+/g, '-');
        const knownSeries = ['dollhouse-mcp', 'merview', 'mcp-aql', 'ailish'];
        return knownSeries.includes(normalized) ? normalized : 'default';
    }

    /**
     * Formats a date string for display.
     *
     * @param {string} dateString - ISO date string or YYYY-MM-DD format
     * @returns {string} Formatted date string (e.g., 'Jan 15, 2025') or empty string
     */
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateString;
        }
    }

    /**
     * Displays a modal with detailed episode information.
     * Shows metadata, workflow progress, files, and allows editing.
     *
     * @async
     * @param {Episode} episode - Episode to display
     * @param {Object<string, ReleaseGroup>} [releaseGroups={}] - Map of release group configurations
     * @param {boolean} [startInEditMode=false] - Whether to start in edit mode
     * @returns {Promise<void>}
     */
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
            metadata: JSON.parse(JSON.stringify(metadata)) // Deep clone
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

        // Determine initial preview file (thumbnail or first media file)
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
                            <button class="modal-close" data-modal-close="episode-modal">×</button>
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

        // Add modal to page with proper cleanup
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

    /**
     * Toggles edit mode in the episode modal.
     * Shows/hides edit fields and updates button visibility.
     *
     * @param {boolean} enabled - Whether edit mode should be enabled
     * @returns {void}
     */
    toggleEditMode(enabled) {
        const modal = document.getElementById('episode-modal');
        if (!modal) return;

        const editBtn = document.getElementById('edit-mode-btn');
        const saveBtn = document.getElementById('save-episode-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const statusBar = document.getElementById('edit-status-bar');
        const workflowHint = document.getElementById('workflow-hint');

        // Toggle button visibility
        if (editBtn) editBtn.classList.toggle('hidden', enabled);
        if (saveBtn) saveBtn.classList.toggle('hidden', !enabled);
        if (cancelBtn) cancelBtn.classList.toggle('hidden', !enabled);
        if (statusBar) statusBar.classList.toggle('hidden', !enabled);
        if (workflowHint) workflowHint.classList.toggle('hidden', !enabled);

        // Toggle view/edit fields
        modal.querySelectorAll('.modal-title-view').forEach(el => el.classList.toggle('hidden', enabled));
        modal.querySelectorAll('.modal-title-edit').forEach(el => el.classList.toggle('hidden', !enabled));
        modal.querySelectorAll('.description-view').forEach(el => el.classList.toggle('hidden', enabled));
        modal.querySelectorAll('.description-edit').forEach(el => el.classList.toggle('hidden', !enabled));
        modal.querySelectorAll('.metadata-value-view').forEach(el => el.classList.toggle('hidden', enabled));
        modal.querySelectorAll('.metadata-value-edit').forEach(el => el.classList.toggle('hidden', !enabled));

        // Toggle workflow interactivity
        const workflowChecklist = document.getElementById('workflow-checklist');
        if (workflowChecklist) {
            workflowChecklist.classList.toggle('workflow-editable', enabled);
        }

        // Store edit mode state
        this._isEditMode = enabled;
    }

    /**
     * Attaches event handlers for edit mode buttons in the episode modal.
     *
     * @param {Episode} episode - Episode being edited
     * @param {Object<string, ReleaseGroup>} releaseGroups - Release group configurations
     * @returns {void}
     */
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
                // Reset form fields to original values
                this.resetEditForm();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await this.saveEpisodeChanges(episode, releaseGroups);
            });
        }

        // Attach workflow checkbox click handlers
        this.attachWorkflowCheckboxHandlers();
    }

    /**
     * Resets the edit form to the original episode values.
     * Called when canceling edit mode.
     *
     * @returns {void}
     */
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

        // Reset workflow checkboxes
        const workflow = metadata.workflow || {};
        document.querySelectorAll('.workflow-checkbox').forEach(checkbox => {
            const key = checkbox.dataset.workflowKey;
            if (key) {
                checkbox.classList.toggle('checked', workflow[key] === true);
            }
        });
    }

    /**
     * Attaches click handlers to workflow checkbox items.
     * Allows toggling workflow completion states in edit mode.
     *
     * @returns {void}
     */
    attachWorkflowCheckboxHandlers() {
        document.querySelectorAll('.workflow-item-interactive').forEach(item => {
            item.addEventListener('click', async () => {
                if (!this._isEditMode) return;

                const checkbox = item.querySelector('.workflow-checkbox');
                if (!checkbox) return;

                // Toggle the checked state
                checkbox.classList.toggle('checked');
            });
        });
    }

    /**
     * Collects current values from the edit form fields.
     *
     * @returns {Object} Object containing form field values for API update
     */
    collectEditFormData() {
        const data = {};

        // Title
        const titleInput = document.getElementById('edit-title');
        if (titleInput && titleInput.value.trim()) {
            data.title = titleInput.value.trim();
        }

        // Description
        const descInput = document.getElementById('edit-description');
        if (descInput) {
            data.description = descInput.value.trim();
        }

        // Content status
        const statusSelect = document.getElementById('edit-content-status');
        if (statusSelect) {
            data.content_status = statusSelect.value;
        }

        // Target date
        const targetDateInput = document.getElementById('edit-target-date');
        if (targetDateInput) {
            data.release = {
                target_date: targetDateInput.value || ''
            };
        }

        // Tags
        const tagsInput = document.getElementById('edit-tags');
        if (tagsInput) {
            const tagsStr = tagsInput.value.trim();
            data.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
        }

        // Workflow checkboxes
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

    /**
     * Saves episode changes to the server via PATCH API.
     * Collects form data, sends update request, and refreshes the view on success.
     *
     * @async
     * @param {Episode} episode - Episode being edited
     * @param {Object<string, ReleaseGroup>} releaseGroups - Release group configurations
     * @returns {Promise<void>}
     */
    async saveEpisodeChanges(episode, releaseGroups) {
        const saveBtn = document.getElementById('save-episode-btn');
        const statusMessage = document.getElementById('edit-status-message');

        if (!this._currentEditEpisode) {
            console.error('No episode data for saving');
            return;
        }

        // Collect form data
        const updates = this.collectEditFormData();

        // Show loading state
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

            // Update cached episode data
            this._currentEditEpisode.metadata = result.metadata;

            // Update view mode display
            this.updateViewModeDisplay(result.metadata);

            // Show success message
            if (statusMessage) {
                statusMessage.textContent = 'Changes saved successfully!';
                statusMessage.classList.add('success');
            }

            // Exit edit mode after a brief delay
            setTimeout(() => {
                this.toggleEditMode(false);
                if (statusMessage) {
                    statusMessage.classList.remove('success');
                }
            }, 1500);

            // Refresh the pipeline view if visible
            if (this.currentView === 'pipeline') {
                this.renderPipeline();
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

    /**
     * Updates the view mode display after saving episode changes.
     * Refreshes displayed values without requiring a full modal reload.
     *
     * @param {EpisodeMetadata} metadata - Updated metadata from the server
     * @returns {void}
     */
    updateViewModeDisplay(metadata) {
        // Update title
        const titleView = document.querySelector('.modal-title-view');
        if (titleView) {
            titleView.textContent = metadata.title || '';
        }

        // Update description
        const descView = document.querySelector('.description-view');
        if (descView) {
            descView.textContent = metadata.description || 'No description available';
        }

        // Update status badge
        const statusBadge = document.getElementById('status-badge');
        if (statusBadge) {
            statusBadge.textContent = metadata.content_status || 'draft';
            statusBadge.className = `badge ${this.getStatusClass(metadata.content_status)}`;
        }

        // Update target date
        const targetDateView = document.getElementById('target-date-view');
        if (targetDateView) {
            targetDateView.textContent = metadata.release?.target_date || 'Not set';
        }

        // Update tags
        const tagsView = document.getElementById('tags-view');
        if (tagsView) {
            const tagsDisplay = (metadata.tags || []).filter(t => t && t.trim()).join(', ');
            tagsView.textContent = tagsDisplay || 'No tags';
        }
    }

    /**
     * Displays the modal for creating a new episode.
     * Shows form with series selection, topic/slug, title, and optional fields.
     *
     * @returns {void}
     */
    showNewEpisodeModal() {
        // Generate series options
        const seriesOptions = this.seriesList.map(series =>
            `<option value="${this.escapeHtml(series)}">${this.escapeHtml(series)}</option>`
        ).join('');

        // Generate distribution profile options
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
                        <button class="modal-close" data-modal-close="new-episode-modal">×</button>
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

        // Attach form event listeners
        this.attachNewEpisodeFormListeners();
    }

    /**
     * Attaches event listeners for the new episode form.
     * Handles series selection, topic slugification, and form submission.
     *
     * @returns {void}
     */
    attachNewEpisodeFormListeners() {
        const form = document.getElementById('new-episode-form');
        const seriesSelect = document.getElementById('episode-series-select');
        const seriesNewInput = document.getElementById('episode-series-new');
        const topicInput = document.getElementById('episode-topic');

        // Handle series select change (show/hide new series input)
        seriesSelect.addEventListener('change', () => {
            if (seriesSelect.value === '__new__') {
                seriesNewInput.classList.remove('hidden');
                seriesNewInput.focus();
            } else {
                seriesNewInput.classList.add('hidden');
                seriesNewInput.value = '';
            }
        });

        // Auto-slugify topic input
        topicInput.addEventListener('input', () => {
            const value = topicInput.value;
            const slugified = this.slugify(value);
            if (value !== slugified && value.toLowerCase() === value) {
                // Only auto-correct if user is typing lowercase
                topicInput.value = slugified;
            }
        });

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleNewEpisodeSubmit();
        });

        // Close button handlers
        document.querySelectorAll('[data-modal-close="new-episode-modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('new-episode-modal'));
        });
    }

    /**
     * Converts text to a URL-safe slug format.
     *
     * @param {string} text - Text to convert
     * @returns {string} Lowercase, hyphen-separated slug
     */
    slugify(text) {
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
     * Validates a slug string format.
     *
     * @param {string} slug - Slug to validate
     * @returns {boolean} True if valid slug format
     */
    validateSlug(slug) {
        if (!slug || typeof slug !== 'string') return false;
        if (slug.length < 1 || slug.length > 100) return false;
        // Must be lowercase alphanumeric with hyphens and underscores
        // Must match server-side VALID_SLUG_REGEX in api/index.js
        const validSlugRegex = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/;
        return validSlugRegex.test(slug);
    }

    /**
     * Validates a series name format.
     *
     * @param {string} name - Series name to validate
     * @returns {boolean} True if valid series name format
     */
    validateSeriesName(name) {
        if (!name || typeof name !== 'string') return false;
        if (name.length < 1 || name.length > 100) return false;
        // Must not contain path traversal characters
        if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
        const validSeriesRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_ ]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
        return validSeriesRegex.test(name);
    }

    /**
     * Handles submission of the new episode form.
     * Validates input, creates episode via API, and refreshes the pipeline view.
     *
     * @async
     * @returns {Promise<void>}
     */
    async handleNewEpisodeSubmit() {
        // Clear previous errors
        document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
        document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => el.classList.remove('error'));

        // Get form values
        const seriesSelect = document.getElementById('episode-series-select');
        const seriesNewInput = document.getElementById('episode-series-new');
        const topicInput = document.getElementById('episode-topic');
        const titleInput = document.getElementById('episode-title');
        const descriptionInput = document.getElementById('episode-description');
        const targetDateInput = document.getElementById('episode-target-date');
        const distributionSelect = document.getElementById('episode-distribution');
        const submitBtn = document.getElementById('create-episode-btn');

        // Determine series value
        let series = seriesSelect.value === '__new__' ? seriesNewInput.value.trim() : seriesSelect.value;
        const topic = this.slugify(topicInput.value.trim());
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();
        const targetDate = targetDateInput.value;
        const distributionProfile = distributionSelect.value;

        // Validate
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

        // Show loading state
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

            // Success - close modal and refresh
            this.closeModal('new-episode-modal');

            // Show success message
            this.showNotification(`Episode "${title}" created successfully!`, 'success');

            // Update series list if a new series was created
            if (!this.seriesList.includes(series)) {
                this.seriesList.push(series);
                this.seriesList.sort();
            }

            // Refresh the pipeline view
            await this.renderPipeline();

        } catch (error) {
            console.error('Error creating episode:', error);
            this.showNotification(error.message || 'Failed to create episode', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').classList.remove('hidden');
            submitBtn.querySelector('.btn-loading').classList.add('hidden');
        }
    }

    /**
     * Displays a notification toast message.
     * Auto-dismisses after 5 seconds or can be closed manually.
     *
     * @param {string} message - Message to display
     * @param {'info'|'success'|'error'} [type='info'] - Notification type for styling
     * @returns {void}
     */
    showNotification(message, type = 'info') {
        // Remove any existing notification
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notificationHTML = `
            <div class="notification notification-${type}">
                <span class="notification-message">${this.escapeHtml(message)}</span>
                <button class="notification-close">×</button>
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

    /**
     * Checks if a file extension is a supported media type.
     *
     * @param {string} ext - File extension including dot (e.g., '.mp4')
     * @returns {boolean} True if media file type
     */
    isMediaFile(ext) {
        const mediaExtensions = ['.mp4', '.mov', '.webm', '.mp3', '.wav', '.m4a', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
        return mediaExtensions.includes(ext);
    }

    /**
     * Gets an emoji icon for a file based on its type.
     *
     * @param {EpisodeFile|AssetNode} file - File object with ext and type properties
     * @returns {string} Emoji representing the file type
     */
    getFileIcon(file) {
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
     * Formats a file size in bytes to a human-readable string.
     *
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size string (e.g., '1.5 MB')
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = DASHBOARD_CONFIG.FILE_SIZE_UNIT;
        const sizes = DASHBOARD_CONFIG.FILE_SIZE_LABELS;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Formats a date string for file display.
     *
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date string (e.g., 'Jan 15, 2025')
     */
    formatFileDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateString;
        }
    }

    /**
     * Renders the file browser component for an episode modal.
     *
     * @param {EpisodeFile[]} files - Array of files in the episode directory
     * @param {string} episodePath - Relative path to the episode
     * @param {EpisodeFile|null} activeFile - Currently selected file
     * @returns {string} HTML string for the file browser
     */
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

    /**
     * Renders the media preview component for an episode file.
     *
     * @param {EpisodeFile|null} file - File to preview
     * @param {string} episodePath - Relative path to the episode
     * @returns {string} HTML string for the media preview
     */
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

    /**
     * Attaches click handlers to file items in the file browser.
     * Updates the media preview when a media file is selected.
     *
     * @param {EpisodeFile[]} files - Array of files in the episode
     * @param {string} episodePath - Relative path to the episode
     * @returns {void}
     */
    attachFileClickHandlers(files, episodePath) {
        document.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                const fileName = item.dataset.file;
                const file = files.find(f => f.name === fileName);

                if (file && this.isMediaFile(file.ext)) {
                    // Update active state
                    document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');

                    // Update media preview
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

    /**
     * Renders the episodes list view.
     * Shows all episodes as cards with basic metadata.
     *
     * @async
     * @returns {Promise<void>}
     */
    async renderEpisodes() {
        const result = await this.fetchAPI('/episodes');
        const content = document.getElementById('content');

        if (!result.success || result.count === 0) {
            content.innerHTML = `
                <div class="view">
                    <div class="section-header">
                        <h2>Episodes</h2>
                        <p>No episodes found. Add content to the series/ directory.</p>
                    </div>
                </div>
            `;
            return;
        }

        const episodesHTML = result.episodes.map(episode => {
            const metadata = episode.metadata || {};
            const status = metadata.workflow?.status || 'unknown';
            const title = metadata.title || episode.episode;

            return `
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">${this.escapeHtml(title)}</div>
                        <div class="card-subtitle">${this.escapeHtml(episode.series)} / ${this.escapeHtml(episode.episode)}</div>
                    </div>
                    <div class="card-content">
                        <div class="mb-2">
                            <span class="badge ${this.getStatusClass(status)}">${status}</span>
                        </div>
                        ${metadata.description ? `<p class="mt-2">${this.escapeHtml(metadata.description)}</p>` : ''}
                        <div class="mt-2 text-muted">
                            <small>${episode.path}</small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="view">
                <div class="section-header">
                    <h2>Episodes</h2>
                    <p>Found ${result.count} episode(s)</p>
                </div>
                <div class="card-grid">
                    ${episodesHTML}
                </div>
            </div>
        `;
    }

    /**
     * Renders the releases queue view.
     * Shows release groups, staged content, and blocked items.
     *
     * @async
     * @returns {Promise<void>}
     */
    async renderReleases() {
        const result = await this.fetchAPI('/releases');
        const content = document.getElementById('content');

        if (!result.success) {
            content.innerHTML = '<div class="error">Failed to load release queue</div>';
            return;
        }

        const data = result.data;
        const hasGroups = data.release_groups && Object.keys(data.release_groups).length > 0;
        const hasStaged = data.staged && data.staged.length > 0;
        const hasBlocked = data.blocked && data.blocked.length > 0;

        let sectionsHTML = '';

        if (hasGroups) {
            const groupsHTML = Object.entries(data.release_groups).map(([id, group]) => `
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">${this.escapeHtml(group.name || id)}</div>
                        <div class="card-subtitle">${this.escapeHtml(id)}</div>
                    </div>
                    <div class="card-content">
                        <div class="mb-2">
                            <span class="badge ${this.getStatusClass(group.status)}">${group.status}</span>
                        </div>
                        ${group.description ? `<p class="mt-2">${this.escapeHtml(group.description)}</p>` : ''}
                        ${group.target_date ? `<p class="mt-2 text-muted"><small>Target: ${group.target_date}</small></p>` : ''}
                    </div>
                </div>
            `).join('');

            sectionsHTML += `
                <div class="section-header mt-3">
                    <h3>Release Groups</h3>
                </div>
                <div class="card-grid">
                    ${groupsHTML}
                </div>
            `;
        }

        if (hasStaged) {
            sectionsHTML += `
                <div class="section-header mt-3">
                    <h3>Staged Content</h3>
                </div>
                <div class="list">
                    ${data.staged.map(item => `
                        <div class="list-item">
                            <div>${this.escapeHtml(item.path)}</div>
                            <div class="mt-1"><span class="badge ${this.getStatusClass(item.status)}">${item.status}</span></div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (hasBlocked) {
            sectionsHTML += `
                <div class="section-header mt-3">
                    <h3>Blocked Content</h3>
                </div>
                <div class="list">
                    ${data.blocked.map(item => `
                        <div class="list-item">
                            <div>${this.escapeHtml(item.path)}</div>
                            <div class="mt-1 text-muted"><small>Blocked by: ${this.escapeHtml(item.blocked_by)}</small></div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (!hasGroups && !hasStaged && !hasBlocked) {
            sectionsHTML = '<p class="text-muted">No release items configured yet.</p>';
        }

        content.innerHTML = `
            <div class="view">
                <div class="section-header">
                    <h2>Release Queue</h2>
                    <p>Manage coordinated releases and staging</p>
                </div>
                ${sectionsHTML}
            </div>
        `;
    }

    /**
     * Renders the asset browser view.
     * Shows file tree, preview panel, and upload functionality.
     *
     * @async
     * @returns {Promise<void>}
     */
    async renderAssets() {
        const result = await this.fetchAPI('/assets');
        const content = document.getElementById('content');

        if (!result.success) {
            content.innerHTML = '<div class="error">Failed to load assets</div>';
            return;
        }

        // Initialize asset browser state
        if (!this.assetBrowserState) {
            this.assetBrowserState = {
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
        this._assetTreeData = result.data;

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
                            ${this.escapeHtml(this.assetBrowserState.selectedFolder || 'assets')}
                        </span>
                    </div>
                </div>

                <div class="asset-browser-controls">
                    <div class="search-box">
                        <input type="text" class="search-input" id="asset-search" placeholder="Search files..." value="${this.escapeHtml(this.assetBrowserState.searchQuery)}">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Type:</label>
                        <select class="filter-select" id="asset-type-filter">
                            <option value="all" ${this.assetBrowserState.filterType === 'all' ? 'selected' : ''}>All Files</option>
                            <option value="image" ${this.assetBrowserState.filterType === 'image' ? 'selected' : ''}>Images</option>
                            <option value="video" ${this.assetBrowserState.filterType === 'video' ? 'selected' : ''}>Videos</option>
                            <option value="audio" ${this.assetBrowserState.filterType === 'audio' ? 'selected' : ''}>Audio</option>
                            <option value="document" ${this.assetBrowserState.filterType === 'document' ? 'selected' : ''}>Documents</option>
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
                        <p class="dropzone-hint">to: <span id="dropzone-target-folder">${this.escapeHtml(this.assetBrowserState.selectedFolder || 'assets')}</span></p>
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
                            ${this.renderAssetTree(result.data)}
                        </div>
                    </div>
                    <div class="asset-preview-panel">
                        <div class="asset-preview-header">
                            <span>Preview</span>
                        </div>
                        <div id="asset-preview-content">
                            ${this.renderAssetPreview(this.assetBrowserState.selectedFile)}
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
        this.attachAssetBrowserListeners();
        this.attachAssetManagementListeners();
    }

    /**
     * Recursively renders the asset tree structure.
     *
     * @param {AssetNode} node - Tree node to render
     * @param {number} [level=0] - Current nesting level
     * @param {string} [parentPath=''] - Parent folder path
     * @returns {string} HTML string for the tree node and children
     */
    renderAssetTree(node, level = 0, parentPath = '') {
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        const isExpanded = this.assetBrowserState.expandedFolders.has(currentPath);

        if (node.type === 'file') {
            // Check if file matches search and filter
            if (!this.matchesAssetFilter(node)) {
                return '';
            }

            const isSelected = this.assetBrowserState.selectedFile &&
                              this.assetBrowserState.selectedFile.path === node.path;

            return `
                <div class="asset-tree-item asset-tree-file ${isSelected ? 'selected' : ''}"
                     style="padding-left: ${(level + 1) * 1.5}rem;"
                     data-file-path="${this.escapeHtml(node.path)}"
                     data-file-data='${JSON.stringify(node).replace(/'/g, "&#39;")}'>
                    <div class="asset-tree-item-content">
                        <span class="asset-file-icon">${this.getFileIcon(node)}</span>
                        <span class="asset-tree-name">${this.escapeHtml(node.name)}</span>
                    </div>
                </div>
            `;
        }

        // Directory
        const hasMatchingFiles = this.hasMatchingFiles(node);
        if (!hasMatchingFiles) {
            return '';
        }

        const childrenHTML = node.children && node.children.length > 0
            ? node.children.map(child => this.renderAssetTree(child, level + 1, currentPath)).join('')
            : '';

        return `
            <div class="asset-tree-folder">
                <div class="asset-tree-item asset-tree-directory ${isExpanded ? 'expanded' : ''}"
                     style="padding-left: ${level * 1.5}rem;"
                     data-folder-path="${this.escapeHtml(currentPath)}">
                    <div class="asset-tree-item-content">
                        <span class="asset-folder-toggle">${isExpanded ? '▼' : '▶'}</span>
                        <span class="asset-folder-icon">📁</span>
                        <span class="asset-tree-name">${this.escapeHtml(node.name)}</span>
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
     * Checks if a file matches the current search and type filters.
     *
     * @param {AssetNode} file - File node to check
     * @returns {boolean} True if file matches current filters
     */
    matchesAssetFilter(file) {
        const state = this.assetBrowserState;

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
     * Checks if a directory contains any files matching current filters.
     *
     * @param {AssetNode} node - Directory node to check
     * @returns {boolean} True if contains matching files
     */
    hasMatchingFiles(node) {
        if (node.type === 'file') {
            return this.matchesAssetFilter(node);
        }

        if (node.children && node.children.length > 0) {
            return node.children.some(child => this.hasMatchingFiles(child));
        }

        return false;
    }

    /**
     * Renders the asset preview panel for a selected file.
     *
     * @param {AssetNode|null} file - File to preview, or null for placeholder
     * @returns {string} HTML string for the preview panel
     */
    renderAssetPreview(file) {
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
                    <img src="${filePath}" alt="${this.escapeHtml(file.name)}"
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
                        const renderedHTML = await this.renderMarkdown(text);
                        container.innerHTML = `<div class="markdown-content">${renderedHTML}</div>`;
                    } catch (e) {
                        container.innerHTML = `<div class="markdown-error">Error loading markdown: ${e.message}</div>`;
                    }
                }
            }, DASHBOARD_CONFIG.MARKDOWN_RENDER_DELAY);
        }
        // Text file preview (txt, yml, yaml, json, js, py, sh, css, html, etc.)
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
                        container.innerHTML = `<pre class="text-content">${this.escapeHtml(text)}</pre>`;
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
                    <div class="asset-preview-icon">${this.getFileIcon(file)}</div>
                    <p>Preview not available for this file type</p>
                    <p class="text-muted">${ext}</p>
                </div>
            `;
        }

        return `
            ${previewHTML}
            <div class="asset-file-info">
                <div class="asset-file-info-header">
                    <h3>${this.escapeHtml(file.name)}</h3>
                </div>
                <div class="asset-file-info-grid">
                    <div class="asset-info-item">
                        <div class="asset-info-label">File Size</div>
                        <div class="asset-info-value">${this.formatFileSize(file.size)}</div>
                    </div>
                    <div class="asset-info-item">
                        <div class="asset-info-label">Type</div>
                        <div class="asset-info-value">${ext.toUpperCase()}</div>
                    </div>
                    <div class="asset-info-item">
                        <div class="asset-info-label">Modified</div>
                        <div class="asset-info-value">${this.formatFileDate(file.modified)}</div>
                    </div>
                    <div class="asset-info-item">
                        <div class="asset-info-label">Path</div>
                        <div class="asset-info-value asset-path-value">
                            <code>${this.escapeHtml(file.path)}</code>
                            <button class="copy-path-btn" data-path="${this.escapeHtml(file.path)}" title="Copy path">
                                📋
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attaches event listeners for the asset browser.
     * Uses event delegation for efficient handling of dynamic content.
     *
     * @returns {void}
     */
    attachAssetBrowserListeners() {
        // Use event delegation on the content element to avoid memory leaks
        const content = document.getElementById('content');
        if (!content) return;

        // Remove existing asset browser listeners if present
        if (this._assetClickHandler) {
            content.removeEventListener('click', this._assetClickHandler);
        }
        if (this._assetInputHandler) {
            content.removeEventListener('input', this._assetInputHandler);
        }
        if (this._assetChangeHandler) {
            content.removeEventListener('change', this._assetChangeHandler);
        }

        // Create delegated click handler
        this._assetClickHandler = async (e) => {
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
                this.assetBrowserState.selectedFile = fileData;
                this.renderAssets();
                return;
            }

            // Folder toggle
            const folderItem = target.closest('.asset-tree-directory');
            if (folderItem) {
                e.stopPropagation();
                const folderPath = folderItem.dataset.folderPath;

                // Update selected folder for upload target
                this.assetBrowserState.selectedFolder = folderPath;

                // Update the current folder path display
                const currentFolderPath = document.getElementById('current-folder-path');
                if (currentFolderPath) {
                    currentFolderPath.textContent = folderPath;
                }
                const dropzoneTargetFolder = document.getElementById('dropzone-target-folder');
                if (dropzoneTargetFolder) {
                    dropzoneTargetFolder.textContent = folderPath;
                }

                if (this.assetBrowserState.expandedFolders.has(folderPath)) {
                    this.assetBrowserState.expandedFolders.delete(folderPath);
                } else {
                    this.assetBrowserState.expandedFolders.add(folderPath);
                }

                this.renderAssets();
                return;
            }
        };

        // Create delegated input handler (for search)
        this._assetInputHandler = (e) => {
            if (e.target.id === 'asset-search') {
                this.assetBrowserState.searchQuery = e.target.value;
                this.renderAssets();
            }
        };

        // Create delegated change handler (for type filter)
        this._assetChangeHandler = (e) => {
            if (e.target.id === 'asset-type-filter') {
                this.assetBrowserState.filterType = e.target.value;
                this.renderAssets();
            }
        };

        content.addEventListener('click', this._assetClickHandler);
        content.addEventListener('input', this._assetInputHandler);
        content.addEventListener('change', this._assetChangeHandler);
    }

    /**
     * Attaches event listeners for asset management features.
     * Handles upload, folder creation, drag-and-drop, and context menus.
     *
     * @returns {void}
     */
    attachAssetManagementListeners() {
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
                    await this.uploadFiles(files);
                }
                // Reset the input so the same files can be selected again
                fileInput.value = '';
            });
        }

        // New folder button click
        const newFolderBtn = document.getElementById('new-folder-btn');
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => {
                this.showCreateFolderModal();
            });
        }

        // Drag and drop handlers
        const assetBrowserLayout = document.getElementById('asset-browser-layout');
        const dropzoneOverlay = document.getElementById('upload-dropzone-overlay');

        if (assetBrowserLayout && dropzoneOverlay) {
            // Prevent default drag behaviors on the whole document
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                document.body.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            // Show dropzone when dragging files over the asset browser
            assetBrowserLayout.addEventListener('dragenter', (e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    dropzoneOverlay.classList.add('active');
                }
            });

            dropzoneOverlay.addEventListener('dragleave', (e) => {
                // Only hide if leaving the dropzone entirely
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
                    await this.uploadFiles(files);
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
                    this.showContextMenu(e, treeItem);
                }
            });
        }

        // Hide context menu on click elsewhere
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Context menu action handler
        const contextMenu = document.getElementById('asset-context-menu');
        if (contextMenu) {
            contextMenu.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action && this._contextMenuTarget) {
                    this.handleContextMenuAction(action);
                }
            });
        }
    }

    /**
     * Uploads files to the server via the API.
     * Shows progress indicator and refreshes the asset browser on completion.
     *
     * @async
     * @param {FileList} files - Files to upload
     * @returns {Promise<void>}
     */
    async uploadFiles(files) {
        const targetFolder = this.assetBrowserState.selectedFolder || 'assets';
        // Remove the leading 'assets/' if present for the API call
        const apiTargetFolder = targetFolder.startsWith('assets/') ? targetFolder.substring(7) : (targetFolder === 'assets' ? '' : targetFolder);

        // Show upload progress
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

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && progressFill && progressText) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressFill.style.width = percentComplete + '%';
                    progressText.textContent = `Uploading... ${percentComplete}%`;
                }
            });

            // Create a promise for the XHR request
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

            // Refresh the asset browser after a short delay
            setTimeout(() => {
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
                this.renderAssets();
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
     * Displays the modal for creating a new folder in the asset browser.
     *
     * @returns {void}
     */
    showCreateFolderModal() {
        const currentFolder = this.assetBrowserState.selectedFolder || 'assets';
        const parentPath = currentFolder.startsWith('assets/') ? currentFolder.substring(7) : (currentFolder === 'assets' ? '' : currentFolder);

        const modalHTML = `
            <div class="modal-overlay" id="create-folder-modal">
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <div>
                            <div class="modal-title">Create New Folder</div>
                            <div class="modal-subtitle">in: ${this.escapeHtml(currentFolder)}</div>
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

        this.showModal('create-folder-modal', modalHTML);

        // Focus the input
        const input = document.getElementById('new-folder-name');
        if (input) {
            input.focus();

            // Handle Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.createFolder(parentPath, input.value);
                }
            });
        }

        // Handle confirm button
        const confirmBtn = document.getElementById('create-folder-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.createFolder(parentPath, input.value);
            });
        }

        // Handle close buttons
        document.querySelectorAll('[data-modal-close="create-folder-modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('create-folder-modal'));
        });
    }

    /**
     * Creates a new folder via the API.
     *
     * @async
     * @param {string} parentPath - Parent folder path (relative to assets)
     * @param {string} folderName - Name for the new folder
     * @returns {Promise<void>}
     */
    async createFolder(parentPath, folderName) {
        if (!folderName || !folderName.trim()) {
            console.error('Please enter a folder name'); return;
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
                this.closeModal('create-folder-modal');
                // Expand the parent folder and refresh
                const fullPath = 'assets' + (parentPath ? '/' + parentPath : '');
                this.assetBrowserState.expandedFolders.add(fullPath);
                this.renderAssets();
            } else {
                console.error('Error:', result.error);
            }
        } catch (error) {
            console.error('Create folder error:', error);
            console.error('Error creating folder:', error.message);
        }
    }

    /**
     * Shows the context menu for an asset tree item.
     *
     * @param {MouseEvent} event - Right-click event
     * @param {HTMLElement} targetElement - Target tree item element
     * @returns {void}
     */
    showContextMenu(event, targetElement) {
        const contextMenu = document.getElementById('asset-context-menu');
        if (!contextMenu) return;

        // Store the target element for later action
        const isFile = targetElement.classList.contains('asset-tree-file');
        const isFolder = targetElement.classList.contains('asset-tree-directory');

        if (isFile) {
            this._contextMenuTarget = {
                type: 'file',
                path: targetElement.dataset.filePath,
                element: targetElement
            };
        } else if (isFolder) {
            this._contextMenuTarget = {
                type: 'folder',
                path: targetElement.dataset.folderPath,
                element: targetElement
            };
        } else {
            return;
        }

        // Position the menu at mouse coordinates
        contextMenu.style.display = 'block';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';

        // Make sure it doesn't go off screen
        const menuRect = contextMenu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            contextMenu.style.left = (event.pageX - menuRect.width) + 'px';
        }
        if (menuRect.bottom > window.innerHeight) {
            contextMenu.style.top = (event.pageY - menuRect.height) + 'px';
        }
    }

    /**
     * Hides the asset context menu.
     *
     * @returns {void}
     */
    hideContextMenu() {
        const contextMenu = document.getElementById('asset-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        this._contextMenuTarget = null;
    }

    /**
     * Handles a context menu action selection.
     *
     * @param {string} action - Action name ('rename' or 'delete')
     * @returns {void}
     */
    handleContextMenuAction(action) {
        const target = this._contextMenuTarget;
        if (!target) return;

        this.hideContextMenu();

        switch (action) {
            case 'rename':
                this.showRenameModal(target);
                break;
            case 'delete':
                this.showDeleteConfirmModal(target);
                break;
        }
    }

    /**
     * Displays the modal for renaming an asset.
     *
     * @param {{type: string, path: string, element: HTMLElement}} target - Target asset info
     * @returns {void}
     */
    showRenameModal(target) {
        const currentName = target.path.split('/').pop();
        const parentPath = target.path.substring(0, target.path.lastIndexOf('/'));

        const modalHTML = `
            <div class="modal-overlay" id="rename-modal">
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <div>
                            <div class="modal-title">Rename ${target.type === 'folder' ? 'Folder' : 'File'}</div>
                            <div class="modal-subtitle">${this.escapeHtml(target.path)}</div>
                        </div>
                        <button class="modal-close" data-modal-close="rename-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">New Name</label>
                            <input type="text" class="form-input" id="rename-input" value="${this.escapeHtml(currentName)}" autocomplete="off">
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

        this.showModal('rename-modal', modalHTML);

        const input = document.getElementById('rename-input');
        if (input) {
            input.focus();
            input.select();

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.renameAsset(target.path, parentPath, input.value);
                }
            });
        }

        const confirmBtn = document.getElementById('rename-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.renameAsset(target.path, parentPath, input.value);
            });
        }

        document.querySelectorAll('[data-modal-close="rename-modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('rename-modal'));
        });
    }

    /**
     * Renames an asset via the API.
     *
     * @async
     * @param {string} currentPath - Current path of the asset
     * @param {string} parentPath - Parent folder path
     * @param {string} newName - New name for the asset
     * @returns {Promise<void>}
     */
    async renameAsset(currentPath, parentPath, newName) {
        if (!newName || !newName.trim()) {
            console.error('Please enter a new name'); return;
            return;
        }

        // Remove the 'assets/' prefix for API call
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
                this.closeModal('rename-modal');
                this.renderAssets();
            } else {
                console.error('Error:', result.error);
            }
        } catch (error) {
            console.error('Rename error:', error);
            console.error('Error renaming:', error.message);
        }
    }

    /**
     * Displays the confirmation modal for deleting an asset.
     *
     * @param {{type: string, path: string, element: HTMLElement}} target - Target asset info
     * @returns {void}
     */
    showDeleteConfirmModal(target) {
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
                            <p class="delete-path"><strong>${this.escapeHtml(target.path)}</strong></p>
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

        this.showModal('delete-modal', modalHTML);

        const confirmBtn = document.getElementById('delete-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.deleteAsset(target.path);
            });
        }

        document.querySelectorAll('[data-modal-close="delete-modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('delete-modal'));
        });
    }

    /**
     * Deletes an asset via the API.
     *
     * @async
     * @param {string} assetPath - Path of the asset to delete
     * @returns {Promise<void>}
     */
    async deleteAsset(assetPath) {
        // Remove the 'assets/' prefix for API call
        const apiPath = assetPath.startsWith('assets/') ? assetPath.substring(7) : assetPath;

        try {
            const response = await fetch('/api/assets/' + encodeURIComponent(apiPath), {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.closeModal('delete-modal');
                // Clear selection if deleted item was selected
                if (this.assetBrowserState.selectedFile && this.assetBrowserState.selectedFile.path === assetPath) {
                    this.assetBrowserState.selectedFile = null;
                }
                this.renderAssets();
            } else {
                console.error('Error:', result.error);
            }
        } catch (error) {
            console.error('Delete error:', error);
            console.error('Error deleting:', error.message);
        }
    }

    /**
     * Renders the distribution profiles view.
     * Shows configured distribution platforms and profiles.
     *
     * @async
     * @returns {Promise<void>}
     */
    async renderDistribution() {
        const result = await this.fetchAPI('/distribution');
        const content = document.getElementById('content');

        if (!result.success) {
            content.innerHTML = '<div class="error">Failed to load distribution profiles</div>';
            return;
        }

        const data = result.data;
        const profiles = data.profiles || {};

        const profilesHTML = Object.entries(profiles).map(([id, profile]) => {
            const platforms = profile.platforms ? Object.keys(profile.platforms).join(', ') : 'None';

            return `
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">${this.escapeHtml(profile.name || id)}</div>
                        <div class="card-subtitle">${this.escapeHtml(id)}</div>
                    </div>
                    <div class="card-content">
                        ${profile.description ? `<p class="mb-2">${this.escapeHtml(profile.description)}</p>` : ''}
                        <div class="mt-2">
                            <strong>Platforms:</strong>
                            <div class="mt-1 text-muted"><small>${this.escapeHtml(platforms)}</small></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="view">
                <div class="section-header">
                    <h2>Distribution Profiles</h2>
                    <p>Platform distribution configurations</p>
                </div>
                ${Object.keys(profiles).length > 0 ? `
                    <div class="card-grid">
                        ${profilesHTML}
                    </div>
                ` : '<p class="text-muted">No distribution profiles configured yet.</p>'}
            </div>
        `;
    }

    /**
     * Renders the release calendar view.
     * Shows scheduled and released content in calendar or list format.
     *
     * @async
     * @returns {Promise<void>}
     */
    async renderCalendar() {
        const content = document.getElementById('content');

        let episodesResult, releaseQueueResult;
        try {
            [episodesResult, releaseQueueResult] = await Promise.all([
                this.fetchAPI('/episodes'),
                this.fetchAPI('/releases').catch(err => {
                    console.warn('Failed to load release queue:', err);
                    return { success: false, data: {} };
                })
            ]);
        } catch (error) {
            content.innerHTML = `<div class="error">Failed to load calendar data: ${this.escapeHtml(error.message)}</div>`;
            return;
        }

        if (!episodesResult.success) {
            content.innerHTML = '<div class="error">Failed to load episodes</div>';
            return;
        }

        // Show warning if release queue failed but episodes loaded
        const releaseQueueWarning = !releaseQueueResult.success
            ? '<div class="warning" style="margin-bottom: 1rem; padding: 0.5rem; background: var(--warning); color: var(--background); border-radius: 4px;">Warning: Release queue data unavailable. Some scheduled releases may not appear.</div>'
            : '';

        // Initialize calendar state
        if (!this.calendarState) {
            this.calendarState = {
                currentDate: new Date(),
                viewMode: 'calendar', // 'calendar' or 'list'
                filter: 'all' // 'all', 'upcoming', 'released'
            };
        }

        const releaseQueue = releaseQueueResult.success ? releaseQueueResult.data : {};
        const releaseGroups = releaseQueue.release_groups || {};

        // Collect all release dates from episodes and release queue
        const releaseItems = this.collectReleaseItems(episodesResult.episodes, releaseQueue);

        // Cache release items for use in modals (avoids refetching)
        this._cachedReleaseItems = releaseItems;
        this._cachedReleaseGroups = releaseGroups;

        // Filter items based on current filter
        const filteredItems = this.filterReleaseItems(releaseItems, this.calendarState.filter);

        content.innerHTML = `
            <div class="view">
                <div class="section-header">
                    <h2>Release Calendar</h2>
                    <p>Scheduled and released content timeline</p>
                </div>

                ${releaseQueueWarning}

                <div class="calendar-controls">
                    <div class="calendar-view-toggle">
                        <button class="toggle-btn ${this.calendarState.viewMode === 'calendar' ? 'active' : ''}" data-mode="calendar">Calendar View</button>
                        <button class="toggle-btn ${this.calendarState.viewMode === 'list' ? 'active' : ''}" data-mode="list">List View</button>
                    </div>
                    <div class="calendar-filter-group">
                        <select class="filter-select" id="calendar-filter">
                            <option value="all" ${this.calendarState.filter === 'all' ? 'selected' : ''}>All Items</option>
                            <option value="upcoming" ${this.calendarState.filter === 'upcoming' ? 'selected' : ''}>Upcoming Only</option>
                            <option value="released" ${this.calendarState.filter === 'released' ? 'selected' : ''}>Released Only</option>
                        </select>
                    </div>
                </div>

                <div id="calendar-content">
                    ${this.calendarState.viewMode === 'calendar'
                        ? this.renderCalendarView(filteredItems, releaseGroups)
                        : this.renderListView(filteredItems, releaseGroups)}
                </div>
            </div>
        `;

        // Attach event listeners
        this.attachCalendarListeners();
    }

    /**
     * Collects release items from episodes and release queue data.
     * Combines scheduled and actual release dates into a unified list.
     *
     * @param {Episode[]} episodes - Array of episodes
     * @param {Object} releaseQueue - Release queue data with groups, staged, and released items
     * @returns {ReleaseItem[]} Sorted array of release items
     */
    collectReleaseItems(episodes, releaseQueue) {
        const items = [];

        // Helper to safely parse dates and validate them
        // Handles both YYYY-MM-DD (local) and ISO 8601 (with timezone) formats
        const parseDate = (dateString) => {
            if (!dateString) return null;

            // Check if it's a simple YYYY-MM-DD format (no time component)
            // These should be parsed as local dates, not UTC
            const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
            if (dateOnlyMatch) {
                const [, year, month, day] = dateOnlyMatch;
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return isNaN(date.getTime()) ? null : date;
            }

            // For ISO 8601 or other formats, use standard parsing
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        };

        // Collect from episodes
        episodes.forEach(episode => {
            const metadata = episode.metadata || {};
            const release = metadata.release || {};
            const analytics = metadata.analytics || {};

            // Target date (scheduled)
            const targetDate = parseDate(release.target_date);
            if (targetDate) {
                items.push({
                    type: 'episode',
                    status: 'scheduled',
                    date: targetDate,
                    episode: episode,
                    title: metadata.title || episode.episode,
                    series: episode.series,
                    releaseGroup: release.release_group,
                    contentStatus: metadata.content_status
                });
            }

            // Actual publish date
            const publishDate = parseDate(analytics.publish_date);
            if (publishDate) {
                items.push({
                    type: 'episode',
                    status: 'released',
                    date: publishDate,
                    episode: episode,
                    title: metadata.title || episode.episode,
                    series: episode.series,
                    releaseGroup: release.release_group,
                    contentStatus: metadata.content_status
                });
            }
        });

        // Collect from release groups
        if (releaseQueue.release_groups) {
            Object.entries(releaseQueue.release_groups).forEach(([id, group]) => {
                const groupDate = parseDate(group.target_date);
                if (groupDate) {
                    items.push({
                        type: 'release_group',
                        status: group.status === 'released' ? 'released' : 'scheduled',
                        date: groupDate,
                        groupId: id,
                        group: group,
                        title: group.name || id,
                        itemCount: group.items ? group.items.length : 0
                    });
                }
            });
        }

        // Collect from staged items
        if (releaseQueue.staged) {
            releaseQueue.staged.forEach(item => {
                const stagedDate = parseDate(item.target_date);
                if (stagedDate) {
                    items.push({
                        type: 'staged',
                        status: 'scheduled',
                        date: stagedDate,
                        stagedItem: item,
                        title: item.path,
                        path: item.path
                    });
                }
            });
        }

        // Collect from released items
        if (releaseQueue.released) {
            releaseQueue.released.forEach(item => {
                const releasedDate = parseDate(item.release_date);
                if (releasedDate) {
                    items.push({
                        type: 'released',
                        status: 'released',
                        date: releasedDate,
                        releasedItem: item,
                        title: item.path,
                        path: item.path
                    });
                }
            });
        }

        return items.sort((a, b) => a.date - b.date);
    }

    /**
     * Filters release items based on the current filter setting.
     *
     * @param {ReleaseItem[]} items - Array of release items to filter
     * @param {'all'|'upcoming'|'released'} filter - Filter type
     * @returns {ReleaseItem[]} Filtered array of items
     */
    filterReleaseItems(items, filter) {
        // Use start of today for "upcoming" comparison to include items scheduled for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (filter) {
            case 'upcoming':
                return items.filter(item => item.status === 'scheduled' && item.date >= today);
            case 'released':
                return items.filter(item => item.status === 'released');
            default:
                return items;
        }
    }

    /**
     * Renders the calendar grid view for release items.
     *
     * @param {ReleaseItem[]} items - Release items to display
     * @param {Object<string, ReleaseGroup>} releaseGroups - Release group configurations
     * @returns {string} HTML string for the calendar grid
     */
    renderCalendarView(items, releaseGroups) {
        // Reset calendar item cache for index-based lookups (XSS prevention)
        this._calendarItemCache = [];

        const year = this.calendarState.currentDate.getFullYear();
        const month = this.calendarState.currentDate.getMonth();

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

        // Get previous month's trailing days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        const prevMonthDays = startDayOfWeek;

        // Calculate total cells needed
        const totalCells = Math.ceil((daysInMonth + startDayOfWeek) / 7) * 7;

        // Group items by date (using local timezone)
        const itemsByDate = {};
        items.forEach(item => {
            const dateKey = this.getLocalDateKey(item.date);
            if (!itemsByDate[dateKey]) {
                itemsByDate[dateKey] = [];
            }
            itemsByDate[dateKey].push(item);
        });

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

        let calendarHTML = `
            <div class="calendar-header">
                <button class="calendar-nav-btn" id="prev-month">&larr;</button>
                <h3 class="calendar-month-year">${monthNames[month]} ${year}</h3>
                <button class="calendar-nav-btn" id="next-month">&rarr;</button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-weekday">Sun</div>
                <div class="calendar-weekday">Mon</div>
                <div class="calendar-weekday">Tue</div>
                <div class="calendar-weekday">Wed</div>
                <div class="calendar-weekday">Thu</div>
                <div class="calendar-weekday">Fri</div>
                <div class="calendar-weekday">Sat</div>
        `;

        for (let i = 0; i < totalCells; i++) {
            let dayNumber;
            let isCurrentMonth = true;
            let cellDate;

            if (i < prevMonthDays) {
                // Previous month days
                dayNumber = prevMonthLastDay - prevMonthDays + i + 1;
                isCurrentMonth = false;
                cellDate = new Date(year, month - 1, dayNumber);
            } else if (i >= prevMonthDays + daysInMonth) {
                // Next month days
                dayNumber = i - prevMonthDays - daysInMonth + 1;
                isCurrentMonth = false;
                cellDate = new Date(year, month + 1, dayNumber);
            } else {
                // Current month days
                dayNumber = i - prevMonthDays + 1;
                cellDate = new Date(year, month, dayNumber);
            }

            const dateKey = this.getLocalDateKey(cellDate);
            const dayItems = itemsByDate[dateKey] || [];
            const hasItems = dayItems.length > 0;
            const isToday = this.isSameDate(cellDate, new Date());

            const itemsHTML = dayItems.slice(0, DASHBOARD_CONFIG.CALENDAR_MAX_ITEMS_PER_DAY).map((item, idx) => {
                const seriesClass = item.series ? this.getSeriesBadgeClass(item.series) : 'default';
                const icon = item.type === 'release_group' ? '🔗' : (item.status === 'released' ? '✓' : '📅');
                // Use index-based lookup to avoid embedding JSON in HTML (XSS prevention)
                const itemIndex = this._calendarItemCache ? this._calendarItemCache.length : 0;
                if (!this._calendarItemCache) this._calendarItemCache = [];
                this._calendarItemCache.push(item);
                // Safely handle missing or undefined title
                const title = item.title || 'Untitled';
                const truncatedTitle = title.substring(0, DASHBOARD_CONFIG.CALENDAR_TITLE_MAX_LENGTH);
                return `<div class="calendar-day-item ${item.status}" data-item-index="${itemIndex}">${icon} ${this.escapeHtml(truncatedTitle)}</div>`;
            }).join('');

            const moreCount = dayItems.length > DASHBOARD_CONFIG.CALENDAR_MAX_ITEMS_PER_DAY ? dayItems.length - DASHBOARD_CONFIG.CALENDAR_MAX_ITEMS_PER_DAY : 0;
            const moreHTML = moreCount > 0 ? `<div class="calendar-day-more">+${moreCount} more</div>` : '';

            calendarHTML += `
                <div class="calendar-day ${isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'today' : ''} ${hasItems ? 'has-items' : ''}" data-date="${dateKey}">
                    <div class="calendar-day-number">${dayNumber}</div>
                    <div class="calendar-day-items">
                        ${itemsHTML}
                        ${moreHTML}
                    </div>
                </div>
            `;
        }

        calendarHTML += '</div>';
        return calendarHTML;
    }

    /**
     * Renders the list view for release items.
     *
     * @param {ReleaseItem[]} items - Release items to display
     * @param {Object<string, ReleaseGroup>} releaseGroups - Release group configurations
     * @returns {string} HTML string for the list view
     */
    renderListView(items, releaseGroups) {
        if (items.length === 0) {
            return '<div class="text-center text-muted" style="padding: 3rem;">No releases found</div>';
        }

        // Group items by date (using local timezone)
        const itemsByDate = {};
        items.forEach(item => {
            const dateKey = this.getLocalDateKey(item.date);
            if (!itemsByDate[dateKey]) {
                itemsByDate[dateKey] = [];
            }
            itemsByDate[dateKey].push(item);
        });

        const sortedDates = Object.keys(itemsByDate).sort();

        let listHTML = '<div class="release-list">';

        sortedDates.forEach(dateKey => {
            const dayItems = itemsByDate[dateKey];
            const date = this.parseLocalDateKey(dateKey);
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            listHTML += `
                <div class="release-date-group">
                    <div class="release-date-header">
                        <h3>${formattedDate}</h3>
                        <span class="release-date-count">${dayItems.length} item${dayItems.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="release-items">
            `;

            dayItems.forEach(item => {
                const seriesClass = item.series ? this.getSeriesBadgeClass(item.series) : 'default';
                const statusClass = item.status === 'released' ? 'released' : 'scheduled';
                const icon = item.type === 'release_group' ? '🔗' : (item.status === 'released' ? '✓' : '📅');

                let subtitle = '';
                if (item.type === 'episode' && item.series) {
                    subtitle = `${item.series} / ${item.episode.episode}`;
                } else if (item.type === 'release_group') {
                    subtitle = `Release Group - ${item.itemCount} items`;
                } else {
                    subtitle = item.path || '';
                }

                const groupBadge = item.releaseGroup && releaseGroups[item.releaseGroup]
                    ? `<div class="release-group-badge">${this.escapeHtml(releaseGroups[item.releaseGroup].name || item.releaseGroup)}</div>`
                    : '';

                listHTML += `
                    <div class="release-list-item ${statusClass}">
                        <div class="release-list-icon">${icon}</div>
                        <div class="release-list-content">
                            <div class="release-list-title">${this.escapeHtml(item.title)}</div>
                            <div class="release-list-subtitle">${this.escapeHtml(subtitle)}</div>
                            ${item.series ? `<span class="series-badge ${seriesClass}">${this.escapeHtml(item.series)}</span>` : ''}
                            ${groupBadge}
                        </div>
                        <div class="release-list-status">
                            <span class="badge ${item.status === 'released' ? 'success' : 'warning'}">${item.status}</span>
                        </div>
                    </div>
                `;
            });

            listHTML += `
                    </div>
                </div>
            `;
        });

        listHTML += '</div>';
        return listHTML;
    }

    /**
     * Checks if two dates are the same calendar day.
     *
     * @param {Date} date1 - First date
     * @param {Date} date2 - Second date
     * @returns {boolean} True if same calendar day
     */
    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    /**
     * Gets a date key in YYYY-MM-DD format using local timezone.
     *
     * @param {Date} date - Date to convert
     * @returns {string} Date key string (YYYY-MM-DD)
     */
    getLocalDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Parses a YYYY-MM-DD date key as a local Date object.
     *
     * @param {string} dateKey - Date key string (YYYY-MM-DD)
     * @returns {Date} Parsed date in local timezone
     */
    parseLocalDateKey(dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    /**
     * Shows a modal with proper cleanup and keyboard support.
     * Handles overlay clicks, escape key, and manages modal state.
     *
     * @param {string} modalId - Unique ID for the modal element
     * @param {string} modalHTML - HTML content for the modal
     * @returns {void}
     */
    showModal(modalId, modalHTML) {
        // Remove any existing modal with same ID
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }

        // Remove any lingering modal keyboard listener
        if (this._modalKeyHandler) {
            document.removeEventListener('keydown', this._modalKeyHandler);
        }

        // Insert modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById(modalId);

        // Click on overlay to close
        const clickHandler = (e) => {
            if (e.target.id === modalId) {
                this.closeModal(modalId);
            }
        };
        modal.addEventListener('click', clickHandler);

        // Escape key to close
        this._modalKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modalId);
            }
        };
        document.addEventListener('keydown', this._modalKeyHandler);

        // Store handlers for cleanup
        modal._clickHandler = clickHandler;
    }

    /**
     * Closes and cleans up a modal.
     * Removes event listeners and DOM elements.
     *
     * @param {string} modalId - ID of the modal to close
     * @returns {void}
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Remove click listener
            if (modal._clickHandler) {
                modal.removeEventListener('click', modal._clickHandler);
            }
            modal.remove();
        }

        // Clean up status dropdown listeners to prevent memory leak
        this.closeStatusDropdowns();

        // Remove keyboard listener
        if (this._modalKeyHandler) {
            document.removeEventListener('keydown', this._modalKeyHandler);
            this._modalKeyHandler = null;
        }
    }

    /**
     * Creates a safe serializable version of a release item.
     * Avoids circular references for JSON stringification.
     *
     * @param {ReleaseItem} item - Release item to serialize
     * @returns {Object} Serializable object with essential properties
     */
    serializeReleaseItem(item) {
        const safeItem = {
            type: item.type,
            status: item.status,
            date: item.date.toISOString(),
            title: item.title,
            series: item.series,
            releaseGroup: item.releaseGroup,
            contentStatus: item.contentStatus,
            path: item.path,
            groupId: item.groupId,
            itemCount: item.itemCount
        };

        // Include minimal episode info if present
        if (item.episode) {
            safeItem.episode = {
                series: item.episode.series,
                episode: item.episode.episode,
                path: item.episode.path,
                metadata: item.episode.metadata ? {
                    title: item.episode.metadata.title,
                    description: item.episode.metadata.description,
                    content_status: item.episode.metadata.content_status,
                    release: item.episode.metadata.release
                } : null
            };
        }

        // Include minimal group info if present
        if (item.group) {
            safeItem.group = {
                name: item.group.name,
                status: item.group.status,
                description: item.group.description,
                items: item.group.items,
                dependencies: item.group.dependencies
            };
        }

        return safeItem;
    }

    /**
     * Attaches event listeners for the calendar view.
     * Handles view toggle, month navigation, and item clicks.
     *
     * @returns {void}
     */
    attachCalendarListeners() {
        // Use event delegation on the content element to avoid memory leaks
        const content = document.getElementById('content');
        if (!content) return;

        // Remove existing calendar listener if present (prevents memory leaks)
        if (this._calendarClickHandler) {
            content.removeEventListener('click', this._calendarClickHandler);
        }
        if (this._calendarChangeHandler) {
            content.removeEventListener('change', this._calendarChangeHandler);
        }

        // Create delegated click handler
        this._calendarClickHandler = (e) => {
            const target = e.target;

            // View mode toggle
            if (target.classList.contains('toggle-btn') && target.dataset.mode) {
                this.calendarState.viewMode = target.dataset.mode;
                this.renderCalendar();
                return;
            }

            // Month navigation - prev
            if (target.id === 'prev-month' || target.closest('#prev-month')) {
                this.calendarState.currentDate = new Date(
                    this.calendarState.currentDate.getFullYear(),
                    this.calendarState.currentDate.getMonth() - 1,
                    1
                );
                this.renderCalendar();
                return;
            }

            // Month navigation - next
            if (target.id === 'next-month' || target.closest('#next-month')) {
                this.calendarState.currentDate = new Date(
                    this.calendarState.currentDate.getFullYear(),
                    this.calendarState.currentDate.getMonth() + 1,
                    1
                );
                this.renderCalendar();
                return;
            }

            // Calendar day item click
            const dayItem = target.closest('.calendar-day-item');
            if (dayItem) {
                e.stopPropagation();
                // Use index-based lookup from cache (XSS prevention - no JSON in HTML)
                const itemIndex = parseInt(dayItem.dataset.itemIndex, 10);
                const itemData = this._calendarItemCache && this._calendarItemCache[itemIndex];
                if (itemData) {
                    this.showReleaseItemModal(itemData);
                }
                return;
            }

            // Calendar day click (show items for that day)
            const calendarDay = target.closest('.calendar-day.has-items');
            if (calendarDay && !target.closest('.calendar-day-item')) {
                const dateKey = calendarDay.dataset.date;
                this.showDayModal(dateKey);
                return;
            }
        };

        // Create delegated change handler
        this._calendarChangeHandler = (e) => {
            if (e.target.id === 'calendar-filter') {
                this.calendarState.filter = e.target.value;
                this.renderCalendar();
            }
        };

        content.addEventListener('click', this._calendarClickHandler);
        content.addEventListener('change', this._calendarChangeHandler);
    }

    /**
     * Shows a modal with all release items for a specific day.
     *
     * @async
     * @param {string} dateKey - Date key (YYYY-MM-DD) for the day to display
     * @returns {Promise<void>}
     */
    async showDayModal(dateKey) {
        // Use cached release items if available (from renderCalendar)
        let releaseItems = this._cachedReleaseItems;

        // Fallback to fetching if cache is empty
        if (!releaseItems || releaseItems.length === 0) {
            try {
                const episodesResult = await this.fetchAPI('/episodes');
                const releaseQueueResult = await this.fetchAPI('/releases').catch(() => ({ success: false, data: {} }));

                if (!episodesResult.success) {
                    console.error('Failed to load episodes for day modal');
                    releaseItems = [];
                } else {
                    const releaseQueue = releaseQueueResult.success ? releaseQueueResult.data : {};
                    releaseItems = this.collectReleaseItems(episodesResult.episodes, releaseQueue);
                }
            } catch (error) {
                console.error('Error loading day modal data:', error);
                releaseItems = [];
            }
        }

        const dayItems = releaseItems.filter(item => {
            const itemDateKey = this.getLocalDateKey(item.date);
            return itemDateKey === dateKey;
        });

        const date = this.parseLocalDateKey(dateKey);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const itemsHTML = dayItems.map(item => {
            const seriesClass = item.series ? this.getSeriesBadgeClass(item.series) : 'default';
            const statusClass = item.status === 'released' ? 'released' : 'scheduled';

            return `
                <div class="day-modal-item ${statusClass}">
                    <div class="day-modal-item-header">
                        <span class="badge ${item.status === 'released' ? 'success' : 'warning'}">${item.status}</span>
                        ${item.series ? `<span class="series-badge ${seriesClass}">${this.escapeHtml(item.series)}</span>` : ''}
                    </div>
                    <div class="day-modal-item-title">${this.escapeHtml(item.title)}</div>
                    ${item.type === 'release_group' ? `<div class="text-muted mt-1"><small>Release Group - ${item.itemCount} items</small></div>` : ''}
                </div>
            `;
        }).join('');

        const modalHTML = `
            <div class="modal-overlay" id="day-modal">
                <div class="modal">
                    <div class="modal-header">
                        <div>
                            <div class="modal-title">Releases for ${formattedDate}</div>
                            <div class="modal-subtitle">${dayItems.length} item${dayItems.length !== 1 ? 's' : ''}</div>
                        </div>
                        <button class="modal-close" data-modal-close="day-modal">×</button>
                    </div>
                    <div class="modal-body">
                        ${itemsHTML}
                    </div>
                </div>
            </div>
        `;

        this.showModal('day-modal', modalHTML);

        // Attach close button handler
        const closeBtn = document.querySelector('[data-modal-close="day-modal"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal('day-modal'));
        }
    }

    /**
     * Shows a modal with detailed information for a release item.
     *
     * @param {ReleaseItem} item - Release item to display
     * @returns {void}
     */
    showReleaseItemModal(item) {
        let detailsHTML = '';

        if (item.type === 'episode' && item.episode) {
            const metadata = item.episode.metadata || {};
            const release = metadata.release || {};

            detailsHTML = `
                <div class="release-item-details">
                    <div class="release-item-detail">
                        <span class="detail-label">Series:</span>
                        <span class="detail-value">${this.escapeHtml(item.series)}</span>
                    </div>
                    <div class="release-item-detail">
                        <span class="detail-label">Episode:</span>
                        <span class="detail-value">${this.escapeHtml(item.episode.episode)}</span>
                    </div>
                    <div class="release-item-detail">
                        <span class="detail-label">Status:</span>
                        <span class="badge ${this.getStatusClass(metadata.content_status)}">${metadata.content_status || 'draft'}</span>
                    </div>
                    ${release.release_group ? `
                        <div class="release-item-detail">
                            <span class="detail-label">Release Group:</span>
                            <span class="detail-value">${this.escapeHtml(release.release_group)}</span>
                        </div>
                    ` : ''}
                    ${metadata.description ? `
                        <div class="release-item-detail">
                            <span class="detail-label">Description:</span>
                            <p class="detail-value">${this.escapeHtml(metadata.description)}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (item.type === 'release_group' && item.group) {
            const group = item.group;
            const itemsHTML = group.items ? group.items.map(groupItem =>
                `<li>${this.escapeHtml(groupItem.path)} - ${this.escapeHtml(groupItem.distribution || 'N/A')}</li>`
            ).join('') : '';

            detailsHTML = `
                <div class="release-item-details">
                    <div class="release-item-detail">
                        <span class="detail-label">Group ID:</span>
                        <span class="detail-value">${this.escapeHtml(item.groupId)}</span>
                    </div>
                    <div class="release-item-detail">
                        <span class="detail-label">Status:</span>
                        <span class="badge ${this.getStatusClass(group.status)}">${group.status}</span>
                    </div>
                    ${group.description ? `
                        <div class="release-item-detail">
                            <span class="detail-label">Description:</span>
                            <p class="detail-value">${this.escapeHtml(group.description)}</p>
                        </div>
                    ` : ''}
                    ${group.items && group.items.length > 0 ? `
                        <div class="release-item-detail">
                            <span class="detail-label">Items (${group.items.length}):</span>
                            <ul class="release-group-items">${itemsHTML}</ul>
                        </div>
                    ` : ''}
                    ${group.dependencies && group.dependencies.length > 0 ? `
                        <div class="release-item-detail">
                            <span class="detail-label">Dependencies:</span>
                            <ul class="dependency-list">
                                ${group.dependencies.map(dep => `<li class="dependency-item">${this.escapeHtml(dep)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            detailsHTML = `
                <div class="release-item-details">
                    <div class="release-item-detail">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${this.escapeHtml(item.type)}</span>
                    </div>
                    <div class="release-item-detail">
                        <span class="detail-label">Path:</span>
                        <span class="detail-value">${this.escapeHtml(item.path || 'N/A')}</span>
                    </div>
                </div>
            `;
        }

        const formattedDate = item.date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const modalHTML = `
            <div class="modal-overlay" id="release-item-modal">
                <div class="modal">
                    <div class="modal-header">
                        <div>
                            <div class="modal-title">${this.escapeHtml(item.title)}</div>
                            <div class="modal-subtitle">${formattedDate}</div>
                        </div>
                        <button class="modal-close" data-modal-close="release-item-modal">×</button>
                    </div>
                    <div class="modal-body">
                        ${detailsHTML}
                    </div>
                </div>
            </div>
        `;

        this.showModal('release-item-modal', modalHTML);

        // Attach close button handler
        const closeBtn = document.querySelector('[data-modal-close="release-item-modal"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal('release-item-modal'));
        }
    }

    /**
     * Gets the CSS badge class for a status value.
     *
     * @param {string} status - Status value (e.g., 'draft', 'ready', 'released')
     * @returns {string} CSS class name ('warning', 'success', or 'error')
     */
    getStatusClass(status) {
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
     * Escapes HTML special characters to prevent XSS attacks.
     *
     * @param {string} text - Text to escape
     * @returns {string} HTML-safe escaped string
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
