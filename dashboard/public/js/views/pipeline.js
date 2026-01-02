// Content Workflow Dashboard - Pipeline/Kanban View

import { escapeHtml } from '../utils.js';
import { renderEpisodeCard } from '../components/episodeCard.js';
import { attachInlineStatusHandlers } from '../components/statusDropdown.js';

/**
 * Render the pipeline/kanban view
 * @param {object} dashboard - Dashboard instance for state and methods
 * @param {Array} episodes - Array of episode objects
 * @param {object} releaseGroups - Release groups data
 */
export async function renderPipeline(dashboard) {
  const result = await dashboard.fetchAPI('/episodes');
  const releaseQueueResult = await dashboard.fetchAPI('/releases');
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
  if (!dashboard.pipelineState) {
    dashboard.pipelineState = {
      filterSeries: 'all',
      sortBy: 'created'
    };
  }

  // Filter and sort episodes
  let episodes = result.episodes;

  if (dashboard.pipelineState.filterSeries !== 'all') {
    episodes = episodes.filter(ep => ep.series === dashboard.pipelineState.filterSeries);
  }

  // Sort episodes
  episodes.sort((a, b) => {
    if (dashboard.pipelineState.sortBy === 'created') {
      // Sort by episode name (which includes date YYYY-MM-DD)
      return b.episode.localeCompare(a.episode);
    } else if (dashboard.pipelineState.sortBy === 'target_release') {
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
    `<option value="${series}" ${dashboard.pipelineState.filterSeries === series ? 'selected' : ''}>${escapeHtml(series)}</option>`
  ).join('');

  // Generate Kanban board HTML
  const kanbanHTML = Object.entries(columns).map(([status, data]) => {
    const cardsHTML = data.episodes.map(episode => renderEpisodeCard(episode, releaseGroups)).join('');

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
            <option value="all" ${dashboard.pipelineState.filterSeries === 'all' ? 'selected' : ''}>All Series</option>
            ${seriesOptions}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label" for="sort-filter">Sort by:</label>
          <select class="filter-select" id="sort-filter">
            <option value="created" ${dashboard.pipelineState.sortBy === 'created' ? 'selected' : ''}>Date Created</option>
            <option value="target_release" ${dashboard.pipelineState.sortBy === 'target_release' ? 'selected' : ''}>Target Release</option>
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
    dashboard.pipelineState.filterSeries = e.target.value;
    renderPipeline(dashboard);
  });

  document.getElementById('sort-filter').addEventListener('change', (e) => {
    dashboard.pipelineState.sortBy = e.target.value;
    renderPipeline(dashboard);
  });

  // New Episode button
  document.getElementById('new-episode-btn').addEventListener('click', () => {
    dashboard.showNewEpisodeModal();
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
        dashboard.showEpisodeModal(episode, releaseGroups);
      }
    });
  });

  // Attach inline status dropdown handlers
  attachInlineStatusHandlers(episodes, () => renderPipeline(dashboard));
}
