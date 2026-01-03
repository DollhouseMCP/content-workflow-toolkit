// Content Workflow Dashboard - Episode Card Component

import { escapeHtml, formatDate, getSeriesBadgeClass, getStatusClass } from '../utils.js';

/**
 * Render an episode card for the pipeline/kanban view
 * @param {object} episode - Episode data object
 * @param {object} releaseGroups - Release groups data
 * @returns {string} HTML string for the episode card
 */
export function renderEpisodeCard(episode, releaseGroups = {}) {
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
  const seriesBadgeClass = getSeriesBadgeClass(series);

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
    ? `<div class="target-date">📅 ${formatDate(targetDate)}</div>`
    : '';

  // Release group badge
  const releaseGroupId = release.release_group;
  const releaseGroup = releaseGroupId && releaseGroups[releaseGroupId];
  const releaseGroupHTML = releaseGroup
    ? `<div class="release-group-badge">${escapeHtml(releaseGroup.name || releaseGroupId)}</div>`
    : '';

  // Inline status dropdown
  const statusDropdownHTML = `
    <div class="status-dropdown-container" data-episode-series="${escapeHtml(episode.series)}" data-episode-id="${escapeHtml(episode.episode)}">
      <span class="badge ${getStatusClass(contentStatus)} status-badge-clickable" data-current-status="${contentStatus}">${contentStatus}</span>
    </div>
  `;

  return `
    <div class="episode-card" data-episode-path="${episode.path}">
      <div class="episode-thumbnail ${hasThumbnail ? '' : 'placeholder'}" style="${thumbnailStyle}">
        ${hasThumbnail ? '' : '🎬'}
      </div>
      <div class="episode-card-body">
        <div class="episode-title">${escapeHtml(title)}</div>
        <div class="episode-meta">
          <div class="series-badge ${seriesBadgeClass}">${escapeHtml(series)}</div>
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
