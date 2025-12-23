// Content Workflow Dashboard - Frontend Application

class Dashboard {
    constructor() {
        this.currentView = 'episodes';
        this.data = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupLiveReload();
        await this.loadView('pipeline');
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

    async fetchAPI(endpoint) {
        const response = await fetch(`/api${endpoint}`);
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return await response.json();
    }

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
                <div class="section-header">
                    <h2>Content Pipeline</h2>
                    <p>Track content progress through your workflow</p>
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

        // Attach click listeners to episode cards
        document.querySelectorAll('.episode-card').forEach(card => {
            card.addEventListener('click', () => {
                const episodePath = card.dataset.episodePath;
                const episode = episodes.find(ep => ep.path === episodePath);
                if (episode) {
                    this.showEpisodeModal(episode, releaseGroups);
                }
            });
        });
    }

    renderEpisodeCard(episode, releaseGroups = {}) {
        const metadata = episode.metadata || {};
        const title = metadata.title || episode.episode;
        const series = episode.series;
        const workflow = metadata.workflow || {};
        const release = metadata.release || {};

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

        return `
            <div class="episode-card" data-episode-path="${episode.path}">
                <div class="episode-thumbnail ${hasThumbnail ? '' : 'placeholder'}" style="${thumbnailStyle}">
                    ${hasThumbnail ? '' : '🎬'}
                </div>
                <div class="episode-card-body">
                    <div class="episode-title">${this.escapeHtml(title)}</div>
                    <div class="episode-meta">
                        <div class="series-badge ${seriesBadgeClass}">${this.escapeHtml(series)}</div>
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

    getSeriesBadgeClass(series) {
        const normalized = series.toLowerCase().replace(/\s+/g, '-');
        const knownSeries = ['dollhouse-mcp', 'merview', 'mcp-aql', 'ailish'];
        return knownSeries.includes(normalized) ? normalized : 'default';
    }

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateString;
        }
    }

    showEpisodeModal(episode, releaseGroups = {}) {
        const metadata = episode.metadata || {};
        const workflow = metadata.workflow || {};
        const release = metadata.release || {};
        const recording = metadata.recording || {};
        const series = metadata.series || {};

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
                <div class="workflow-item">
                    <div class="workflow-checkbox ${checked ? 'checked' : ''}"></div>
                    <span>${item.label}</span>
                </div>
            `;
        }).join('');

        const modalHTML = `
            <div class="modal-overlay" id="episode-modal">
                <div class="modal">
                    <div class="modal-header">
                        <div>
                            <div class="modal-title">${this.escapeHtml(metadata.title || episode.episode)}</div>
                            <div class="modal-subtitle">${this.escapeHtml(episode.series)} / ${this.escapeHtml(episode.episode)}</div>
                        </div>
                        <button class="modal-close" onclick="document.getElementById('episode-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="modal-section">
                            <h3>Description</h3>
                            <p>${this.escapeHtml(metadata.description || 'No description available')}</p>
                        </div>

                        <div class="modal-section">
                            <h3>Status & Release</h3>
                            <div class="metadata-grid">
                                <div class="metadata-item">
                                    <div class="metadata-label">Content Status</div>
                                    <div class="metadata-value">
                                        <span class="badge ${this.getStatusClass(metadata.content_status)}">${metadata.content_status || 'draft'}</span>
                                    </div>
                                </div>
                                <div class="metadata-item">
                                    <div class="metadata-label">Target Date</div>
                                    <div class="metadata-value">${this.escapeHtml(release.target_date || 'Not set')}</div>
                                </div>
                                ${releaseGroup ? `
                                    <div class="metadata-item">
                                        <div class="metadata-label">Release Group</div>
                                        <div class="metadata-value">${this.escapeHtml(releaseGroup.name || releaseGroupId)}</div>
                                    </div>
                                ` : ''}
                                <div class="metadata-item">
                                    <div class="metadata-label">Series</div>
                                    <div class="metadata-value">${this.escapeHtml(series.name || episode.series)}</div>
                                </div>
                            </div>
                        </div>

                        <div class="modal-section">
                            <h3>Workflow Progress</h3>
                            <div class="workflow-checklist">
                                ${workflowHTML}
                            </div>
                        </div>

                        ${recording.date || recording.duration_final ? `
                            <div class="modal-section">
                                <h3>Recording Details</h3>
                                <div class="metadata-grid">
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
                                    ${recording.format ? `
                                        <div class="metadata-item">
                                            <div class="metadata-label">Format</div>
                                            <div class="metadata-value">${this.escapeHtml(recording.format)}</div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}

                        <div class="modal-section">
                            <h3>Path</h3>
                            <p class="text-muted"><small>${this.escapeHtml(episode.path)}</small></p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Close on overlay click
        document.getElementById('episode-modal').addEventListener('click', (e) => {
            if (e.target.id === 'episode-modal') {
                e.target.remove();
            }
        });
    }

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

    async renderAssets() {
        const result = await this.fetchAPI('/assets');
        const content = document.getElementById('content');

        if (!result.success) {
            content.innerHTML = '<div class="error">Failed to load assets</div>';
            return;
        }

        const renderTree = (node, level = 0) => {
            if (node.type === 'file') {
                return `
                    <div class="list-item" style="padding-left: ${level * 2}rem;">
                        <span>📄 ${this.escapeHtml(node.name)}</span>
                        <small class="text-muted ml-2">${node.ext}</small>
                    </div>
                `;
            }

            let html = `
                <div class="list-item" style="padding-left: ${level * 2}rem; font-weight: 500;">
                    <span>📁 ${this.escapeHtml(node.name)}/</span>
                </div>
            `;

            if (node.children && node.children.length > 0) {
                html += node.children.map(child => renderTree(child, level + 1)).join('');
            }

            return html;
        };

        content.innerHTML = `
            <div class="view">
                <div class="section-header">
                    <h2>Assets</h2>
                    <p>Browse media assets and files</p>
                </div>
                <div class="list">
                    ${renderTree(result.data)}
                </div>
            </div>
        `;
    }

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
