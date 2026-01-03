// Content Workflow Dashboard - Distribution Profiles View

import { escapeHtml } from '../utils.js';

/**
 * Render the distribution profiles view
 * @param {object} dashboard - Dashboard instance for state and methods
 */
export async function renderDistribution(dashboard) {
  const result = await dashboard.fetchAPI('/distribution');
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
          <div class="card-title">${escapeHtml(profile.name || id)}</div>
          <div class="card-subtitle">${escapeHtml(id)}</div>
        </div>
        <div class="card-content">
          ${profile.description ? `<p class="mb-2">${escapeHtml(profile.description)}</p>` : ''}
          <div class="mt-2">
            <strong>Platforms:</strong>
            <div class="mt-1 text-muted"><small>${escapeHtml(platforms)}</small></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div class="view">
      ${Object.keys(profiles).length > 0 ? `
        <div class="card-grid">
          ${profilesHTML}
        </div>
      ` : '<p class="text-muted">No distribution profiles configured yet.</p>'}
    </div>
  `;
}
