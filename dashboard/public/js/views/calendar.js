// Content Workflow Dashboard - Calendar View

import { DASHBOARD_CONFIG } from '../config.js';
import { escapeHtml, getSeriesBadgeClass, getStatusClass, isSameDate, getLocalDateKey, parseLocalDateKey } from '../utils.js';
import { showModal, closeModal } from '../modal.js';

// Cache for calendar items (used for modal lookups)
let _calendarItemCache = [];
let _cachedReleaseItems = [];

/**
 * Render the calendar view
 * @param {object} dashboard - Dashboard instance for state and methods
 */
export async function renderCalendar(dashboard) {
  const content = document.getElementById('content');

  let episodesResult, releaseQueueResult;
  try {
    [episodesResult, releaseQueueResult] = await Promise.all([
      dashboard.fetchAPI('/episodes'),
      dashboard.fetchAPI('/releases').catch(err => {
        console.warn('Failed to load release queue:', err);
        return { success: false, data: {} };
      })
    ]);
  } catch (error) {
    content.innerHTML = `<div class="error">Failed to load calendar data: ${escapeHtml(error.message)}</div>`;
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
  if (!dashboard.calendarState) {
    dashboard.calendarState = {
      currentDate: new Date(),
      viewMode: 'calendar', // 'calendar' or 'list'
      filter: 'all' // 'all', 'upcoming', 'released'
    };
  }

  const releaseQueue = releaseQueueResult.success ? releaseQueueResult.data : {};
  const releaseGroups = releaseQueue.release_groups || {};

  // Collect all release dates from episodes and release queue
  const releaseItems = collectReleaseItems(episodesResult.episodes, releaseQueue);

  // Cache release items for use in modals
  _cachedReleaseItems = releaseItems;

  // Filter items based on current filter
  const filteredItems = filterReleaseItems(releaseItems, dashboard.calendarState.filter);

  content.innerHTML = `
    <div class="view">
      <div class="section-header">
        <h2>Release Calendar</h2>
        <p>Scheduled and released content timeline</p>
      </div>

      ${releaseQueueWarning}

      <div class="calendar-controls">
        <div class="calendar-view-toggle">
          <button class="toggle-btn ${dashboard.calendarState.viewMode === 'calendar' ? 'active' : ''}" data-mode="calendar">Calendar View</button>
          <button class="toggle-btn ${dashboard.calendarState.viewMode === 'list' ? 'active' : ''}" data-mode="list">List View</button>
        </div>
        <div class="calendar-filter-group">
          <select class="filter-select" id="calendar-filter">
            <option value="all" ${dashboard.calendarState.filter === 'all' ? 'selected' : ''}>All Items</option>
            <option value="upcoming" ${dashboard.calendarState.filter === 'upcoming' ? 'selected' : ''}>Upcoming Only</option>
            <option value="released" ${dashboard.calendarState.filter === 'released' ? 'selected' : ''}>Released Only</option>
          </select>
        </div>
      </div>

      <div id="calendar-content">
        ${dashboard.calendarState.viewMode === 'calendar'
    ? renderCalendarView(filteredItems, releaseGroups, dashboard.calendarState)
    : renderListView(filteredItems, releaseGroups)}
      </div>
    </div>
  `;

  // Attach event listeners
  attachCalendarListeners(dashboard);
}

/**
 * Collect release items from episodes and release queue
 */
function collectReleaseItems(episodes, releaseQueue) {
  const items = [];

  // Helper to safely parse dates
  const parseDate = (dateString) => {
    if (!dateString) return null;

    // Check if it's a simple YYYY-MM-DD format
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date;
    }

    // For ISO 8601 or other formats
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
 * Filter release items based on filter type
 */
function filterReleaseItems(items, filter) {
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
 * Render the calendar grid view
 */
function renderCalendarView(items, releaseGroups, calendarState) {
  // Reset calendar item cache
  _calendarItemCache = [];

  const year = calendarState.currentDate.getFullYear();
  const month = calendarState.currentDate.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Get previous month's trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays = startDayOfWeek;

  // Calculate total cells needed
  const totalCells = Math.ceil((daysInMonth + startDayOfWeek) / 7) * 7;

  // Group items by date
  const itemsByDate = {};
  items.forEach(item => {
    const dateKey = getLocalDateKey(item.date);
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
      dayNumber = prevMonthLastDay - prevMonthDays + i + 1;
      isCurrentMonth = false;
      cellDate = new Date(year, month - 1, dayNumber);
    } else if (i >= prevMonthDays + daysInMonth) {
      dayNumber = i - prevMonthDays - daysInMonth + 1;
      isCurrentMonth = false;
      cellDate = new Date(year, month + 1, dayNumber);
    } else {
      dayNumber = i - prevMonthDays + 1;
      cellDate = new Date(year, month, dayNumber);
    }

    const dateKey = getLocalDateKey(cellDate);
    const dayItems = itemsByDate[dateKey] || [];
    const hasItems = dayItems.length > 0;
    const isToday = isSameDate(cellDate, new Date());

    const itemsHTML = dayItems.slice(0, DASHBOARD_CONFIG.CALENDAR_MAX_ITEMS_PER_DAY).map((item) => {
      const icon = item.type === 'release_group' ? '🔗' : (item.status === 'released' ? '✓' : '📅');
      const itemIndex = _calendarItemCache.length;
      _calendarItemCache.push(item);
      const title = item.title || 'Untitled';
      const truncatedTitle = title.substring(0, DASHBOARD_CONFIG.CALENDAR_TITLE_MAX_LENGTH);
      return `<div class="calendar-day-item ${item.status}" data-item-index="${itemIndex}">${icon} ${escapeHtml(truncatedTitle)}</div>`;
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
 * Render the list view
 */
function renderListView(items, releaseGroups) {
  if (items.length === 0) {
    return '<div class="text-center text-muted" style="padding: 3rem;">No releases found</div>';
  }

  // Group items by date
  const itemsByDate = {};
  items.forEach(item => {
    const dateKey = getLocalDateKey(item.date);
    if (!itemsByDate[dateKey]) {
      itemsByDate[dateKey] = [];
    }
    itemsByDate[dateKey].push(item);
  });

  const sortedDates = Object.keys(itemsByDate).sort();

  let listHTML = '<div class="release-list">';

  sortedDates.forEach(dateKey => {
    const dayItems = itemsByDate[dateKey];
    const date = parseLocalDateKey(dateKey);
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
      const seriesClass = item.series ? getSeriesBadgeClass(item.series) : 'default';
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
        ? `<div class="release-group-badge">${escapeHtml(releaseGroups[item.releaseGroup].name || item.releaseGroup)}</div>`
        : '';

      listHTML += `
        <div class="release-list-item ${statusClass}">
          <div class="release-list-icon">${icon}</div>
          <div class="release-list-content">
            <div class="release-list-title">${escapeHtml(item.title)}</div>
            <div class="release-list-subtitle">${escapeHtml(subtitle)}</div>
            ${item.series ? `<span class="series-badge ${seriesClass}">${escapeHtml(item.series)}</span>` : ''}
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
 * Attach calendar event listeners
 */
function attachCalendarListeners(dashboard) {
  const content = document.getElementById('content');
  if (!content) return;

  // Remove existing handlers
  if (dashboard._calendarClickHandler) {
    content.removeEventListener('click', dashboard._calendarClickHandler);
  }
  if (dashboard._calendarChangeHandler) {
    content.removeEventListener('change', dashboard._calendarChangeHandler);
  }

  // Create delegated click handler
  dashboard._calendarClickHandler = (e) => {
    const target = e.target;

    // View mode toggle
    if (target.classList.contains('toggle-btn') && target.dataset.mode) {
      dashboard.calendarState.viewMode = target.dataset.mode;
      renderCalendar(dashboard);
      return;
    }

    // Month navigation - prev
    if (target.id === 'prev-month' || target.closest('#prev-month')) {
      dashboard.calendarState.currentDate = new Date(
        dashboard.calendarState.currentDate.getFullYear(),
        dashboard.calendarState.currentDate.getMonth() - 1,
        1
      );
      renderCalendar(dashboard);
      return;
    }

    // Month navigation - next
    if (target.id === 'next-month' || target.closest('#next-month')) {
      dashboard.calendarState.currentDate = new Date(
        dashboard.calendarState.currentDate.getFullYear(),
        dashboard.calendarState.currentDate.getMonth() + 1,
        1
      );
      renderCalendar(dashboard);
      return;
    }

    // Calendar day item click
    const dayItem = target.closest('.calendar-day-item');
    if (dayItem) {
      e.stopPropagation();
      const itemIndex = parseInt(dayItem.dataset.itemIndex, 10);
      const itemData = _calendarItemCache[itemIndex];
      if (itemData) {
        showReleaseItemModal(itemData);
      }
      return;
    }

    // Calendar day click (show items for that day)
    const calendarDay = target.closest('.calendar-day.has-items');
    if (calendarDay && !target.closest('.calendar-day-item')) {
      const dateKey = calendarDay.dataset.date;
      showDayModal(dateKey, dashboard);
      return;
    }
  };

  // Create delegated change handler
  dashboard._calendarChangeHandler = (e) => {
    if (e.target.id === 'calendar-filter') {
      dashboard.calendarState.filter = e.target.value;
      renderCalendar(dashboard);
    }
  };

  content.addEventListener('click', dashboard._calendarClickHandler);
  content.addEventListener('change', dashboard._calendarChangeHandler);
}

/**
 * Show modal for a specific day's items
 */
async function showDayModal(dateKey, dashboard) {
  let releaseItems = _cachedReleaseItems;

  // Fallback to fetching if cache is empty
  if (!releaseItems || releaseItems.length === 0) {
    try {
      const episodesResult = await dashboard.fetchAPI('/episodes');
      const releaseQueueResult = await dashboard.fetchAPI('/releases').catch(() => ({ success: false, data: {} }));

      if (!episodesResult.success) {
        releaseItems = [];
      } else {
        const releaseQueue = releaseQueueResult.success ? releaseQueueResult.data : {};
        releaseItems = collectReleaseItems(episodesResult.episodes, releaseQueue);
      }
    } catch (error) {
      console.error('Error loading day modal data:', error);
      releaseItems = [];
    }
  }

  const dayItems = releaseItems.filter(item => {
    const itemDateKey = getLocalDateKey(item.date);
    return itemDateKey === dateKey;
  });

  const date = parseLocalDateKey(dateKey);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const itemsHTML = dayItems.map(item => {
    const seriesClass = item.series ? getSeriesBadgeClass(item.series) : 'default';
    const statusClass = item.status === 'released' ? 'released' : 'scheduled';

    return `
      <div class="day-modal-item ${statusClass}">
        <div class="day-modal-item-header">
          <span class="badge ${item.status === 'released' ? 'success' : 'warning'}">${item.status}</span>
          ${item.series ? `<span class="series-badge ${seriesClass}">${escapeHtml(item.series)}</span>` : ''}
        </div>
        <div class="day-modal-item-title">${escapeHtml(item.title)}</div>
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
          <button class="modal-close" data-modal-close="day-modal">x</button>
        </div>
        <div class="modal-body">
          ${itemsHTML}
        </div>
      </div>
    </div>
  `;

  showModal('day-modal', modalHTML);

  // Attach close button handler
  const closeBtn = document.querySelector('[data-modal-close="day-modal"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal('day-modal'));
  }
}

/**
 * Show modal for a release item
 */
function showReleaseItemModal(item) {
  let detailsHTML = '';

  if (item.type === 'episode' && item.episode) {
    const metadata = item.episode.metadata || {};
    const release = metadata.release || {};

    detailsHTML = `
      <div class="release-item-details">
        <div class="release-item-detail">
          <span class="detail-label">Series:</span>
          <span class="detail-value">${escapeHtml(item.series)}</span>
        </div>
        <div class="release-item-detail">
          <span class="detail-label">Episode:</span>
          <span class="detail-value">${escapeHtml(item.episode.episode)}</span>
        </div>
        <div class="release-item-detail">
          <span class="detail-label">Status:</span>
          <span class="badge ${getStatusClass(metadata.content_status)}">${metadata.content_status || 'draft'}</span>
        </div>
        ${release.release_group ? `
          <div class="release-item-detail">
            <span class="detail-label">Release Group:</span>
            <span class="detail-value">${escapeHtml(release.release_group)}</span>
          </div>
        ` : ''}
        ${metadata.description ? `
          <div class="release-item-detail">
            <span class="detail-label">Description:</span>
            <p class="detail-value">${escapeHtml(metadata.description)}</p>
          </div>
        ` : ''}
      </div>
    `;
  } else if (item.type === 'release_group' && item.group) {
    const group = item.group;
    const itemsHTML = group.items ? group.items.map(groupItem =>
      `<li>${escapeHtml(groupItem.path)} - ${escapeHtml(groupItem.distribution || 'N/A')}</li>`
    ).join('') : '';

    detailsHTML = `
      <div class="release-item-details">
        <div class="release-item-detail">
          <span class="detail-label">Group ID:</span>
          <span class="detail-value">${escapeHtml(item.groupId)}</span>
        </div>
        <div class="release-item-detail">
          <span class="detail-label">Status:</span>
          <span class="badge ${getStatusClass(group.status)}">${group.status}</span>
        </div>
        ${group.description ? `
          <div class="release-item-detail">
            <span class="detail-label">Description:</span>
            <p class="detail-value">${escapeHtml(group.description)}</p>
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
              ${group.dependencies.map(dep => `<li class="dependency-item">${escapeHtml(dep)}</li>`).join('')}
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
          <span class="detail-value">${escapeHtml(item.type)}</span>
        </div>
        <div class="release-item-detail">
          <span class="detail-label">Path:</span>
          <span class="detail-value">${escapeHtml(item.path || 'N/A')}</span>
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
            <div class="modal-title">${escapeHtml(item.title)}</div>
            <div class="modal-subtitle">${formattedDate}</div>
          </div>
          <button class="modal-close" data-modal-close="release-item-modal">x</button>
        </div>
        <div class="modal-body">
          ${detailsHTML}
        </div>
      </div>
    </div>
  `;

  showModal('release-item-modal', modalHTML);

  // Attach close button handler
  const closeBtn = document.querySelector('[data-modal-close="release-item-modal"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal('release-item-modal'));
  }
}
