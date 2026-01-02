// Content Workflow Dashboard - Release Queue View

import { escapeHtml, getStatusClass } from '../utils.js';

/**
 * Render the release queue view
 * @param {object} dashboard - Dashboard instance for state and methods
 */
export async function renderReleases(dashboard) {
  const result = await dashboard.fetchAPI('/releases');
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
          <div class="card-title">${escapeHtml(group.name || id)}</div>
          <div class="card-subtitle">${escapeHtml(id)}</div>
        </div>
        <div class="card-content">
          <div class="mb-2">
            <span class="badge ${getStatusClass(group.status)}">${group.status}</span>
          </div>
          ${group.description ? `<p class="mt-2">${escapeHtml(group.description)}</p>` : ''}
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
            <div>${escapeHtml(item.path)}</div>
            <div class="mt-1"><span class="badge ${getStatusClass(item.status)}">${item.status}</span></div>
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
            <div>${escapeHtml(item.path)}</div>
            <div class="mt-1 text-muted"><small>Blocked by: ${escapeHtml(item.blocked_by)}</small></div>
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
