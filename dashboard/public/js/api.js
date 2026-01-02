// Content Workflow Dashboard - API Functions

/**
 * Fetch data from the API
 * @param {string} endpoint - API endpoint (without /api prefix)
 * @returns {Promise<object>} API response data
 */
export async function fetchAPI(endpoint) {
  const response = await fetch(`/api${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Setup SSE connection for live updates
 * @param {function} onReload - Callback when reload event received
 * @param {function} onError - Callback on connection error
 * @returns {EventSource} The SSE event source
 */
export function setupLiveReload(onReload, onError) {
  const eventSource = new EventSource('/api/events');

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'reload') {
      console.log('Content changed, reloading view...');
      onReload();
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection error');
    onError();
  };

  return eventSource;
}
