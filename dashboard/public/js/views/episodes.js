// Content Workflow Dashboard - Episodes Grid View

import { escapeHtml, getStatusClass } from '../utils.js';

/**
 * Render the episodes grid view
 * @param {object} dashboard - Dashboard instance for state and methods
 */
export async function renderEpisodes(dashboard) {
  const result = await dashboard.fetchAPI('/episodes');
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
          <div class="card-title">${escapeHtml(title)}</div>
          <div class="card-subtitle">${escapeHtml(episode.series)} / ${escapeHtml(episode.episode)}</div>
        </div>
        <div class="card-content">
          <div class="mb-2">
            <span class="badge ${getStatusClass(status)}">${status}</span>
          </div>
          ${metadata.description ? `<p class="mt-2">${escapeHtml(metadata.description)}</p>` : ''}
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
