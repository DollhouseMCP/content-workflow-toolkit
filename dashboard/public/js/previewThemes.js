// Preview Theme Configuration
// Styles for Markdown preview, Code blocks, and Mermaid diagrams

/**
 * Available preview styles (markdown document styles)
 */
export const previewStyles = [
  { name: 'Default', file: '', default: true },
  { name: 'Clean', file: 'clean' },
  { name: 'Dark', file: 'dark' },
  { name: 'GitHub', file: 'github' }
];

/**
 * Available syntax highlighting themes for code blocks (highlight.js CDN)
 */
export const syntaxThemes = [
  { name: 'GitHub Dark', file: 'github-dark', default: true },
  { name: 'GitHub Light', file: 'github' },
  { name: 'VS Code Dark+', file: 'vs2015' },
  { name: 'Monokai', file: 'monokai' },
  { name: 'Atom One Dark', file: 'atom-one-dark' },
  { name: 'Atom One Light', file: 'atom-one-light' },
  { name: 'Nord', file: 'nord' },
  { name: 'Tokyo Night Dark', file: 'tokyo-night-dark' },
  { name: 'Tokyo Night Light', file: 'tokyo-night-light' }
];

/**
 * Available Mermaid diagram themes
 */
export const mermaidThemes = [
  { name: 'Dark', value: 'dark', default: true },
  { name: 'Default', value: 'default' },
  { name: 'Forest', value: 'forest' },
  { name: 'Neutral', value: 'neutral' },
  { name: 'Base', value: 'base' }
];

// Storage keys
const STORAGE_KEYS = {
  previewStyle: 'dashboard-preview-style',
  syntaxTheme: 'dashboard-syntax-theme',
  mermaidTheme: 'dashboard-mermaid-theme'
};

/**
 * Get saved preview style or default
 */
export function getSavedPreviewStyle() {
  return localStorage.getItem(STORAGE_KEYS.previewStyle) || '';
}

/**
 * Get saved syntax theme or default
 */
export function getSavedSyntaxTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.syntaxTheme);
  if (saved) return saved;
  const defaultTheme = syntaxThemes.find(t => t.default);
  return defaultTheme?.file || 'github-dark';
}

/**
 * Get saved mermaid theme or default
 */
export function getSavedMermaidTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.mermaidTheme);
  if (saved) return saved;
  const defaultTheme = mermaidThemes.find(t => t.default);
  return defaultTheme?.value || 'dark';
}

/**
 * Load preview style CSS
 */
export function loadPreviewStyle(styleFile) {
  const existingLink = document.getElementById('preview-style-css');
  if (existingLink) {
    existingLink.remove();
  }

  localStorage.setItem(STORAGE_KEYS.previewStyle, styleFile);

  if (!styleFile) {
    return; // Default style, no CSS to load
  }

  const link = document.createElement('link');
  link.id = 'preview-style-css';
  link.rel = 'stylesheet';
  link.href = `/styles/${styleFile}.css`;
  document.head.appendChild(link);
}

/**
 * Load syntax theme CSS from CDN
 */
export function loadSyntaxTheme(themeFile) {
  const existingLink = document.getElementById('syntax-theme-css');
  if (existingLink) {
    existingLink.remove();
  }

  localStorage.setItem(STORAGE_KEYS.syntaxTheme, themeFile);

  const link = document.createElement('link');
  link.id = 'syntax-theme-css';
  link.rel = 'stylesheet';
  link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${themeFile}.min.css`;
  document.head.appendChild(link);
}

/**
 * Apply mermaid theme and re-render diagrams
 */
export async function applyMermaidTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.mermaidTheme, theme);

  // Reinitialize mermaid with new theme
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: 'strict'
    });

    // Re-render any existing diagrams
    const diagrams = document.querySelectorAll('.mermaid[data-processed="true"]');
    for (const diagram of diagrams) {
      const code = diagram.getAttribute('data-mermaid-source');
      if (code) {
        diagram.removeAttribute('data-processed');
        diagram.innerHTML = code;
        try {
          const { svg } = await window.mermaid.render(`mermaid-${Date.now()}`, code);
          diagram.innerHTML = svg;
          diagram.setAttribute('data-processed', 'true');
        } catch (e) {
          console.warn('Failed to re-render mermaid diagram:', e);
        }
      }
    }
  }
}

/**
 * Initialize theme system - load saved preferences
 */
export function initializeThemes() {
  // Load saved preview style
  const previewStyle = getSavedPreviewStyle();
  loadPreviewStyle(previewStyle);

  // Load saved syntax theme
  const syntaxTheme = getSavedSyntaxTheme();
  loadSyntaxTheme(syntaxTheme);

  // Initialize mermaid with saved theme
  const mermaidTheme = getSavedMermaidTheme();
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'strict'
    });
  }
}

/**
 * Create theme selector dropdowns HTML
 */
export function createThemeSelectorsHTML() {
  const savedPreview = getSavedPreviewStyle();
  const savedSyntax = getSavedSyntaxTheme();
  const savedMermaid = getSavedMermaidTheme();

  const previewOptions = previewStyles.map(t =>
    `<option value="${t.file}" ${t.file === savedPreview ? 'selected' : ''}>${t.name}</option>`
  ).join('');

  const syntaxOptions = syntaxThemes.map(t =>
    `<option value="${t.file}" ${t.file === savedSyntax ? 'selected' : ''}>${t.name}</option>`
  ).join('');

  const mermaidOptions = mermaidThemes.map(t =>
    `<option value="${t.value}" ${t.value === savedMermaid ? 'selected' : ''}>${t.name}</option>`
  ).join('');

  return `
    <div class="preview-theme-selectors">
      <select class="preview-theme-select" id="preview-style-select" title="Preview style">
        ${previewOptions}
      </select>
      <select class="preview-theme-select" id="syntax-theme-select" title="Code block theme">
        ${syntaxOptions}
      </select>
      <select class="preview-theme-select" id="mermaid-theme-select" title="Mermaid diagram theme">
        ${mermaidOptions}
      </select>
    </div>
  `;
}

/**
 * Attach event listeners to theme selectors
 */
export function attachThemeSelectorHandlers() {
  const previewSelect = document.getElementById('preview-style-select');
  const syntaxSelect = document.getElementById('syntax-theme-select');
  const mermaidSelect = document.getElementById('mermaid-theme-select');

  if (previewSelect) {
    previewSelect.addEventListener('change', (e) => {
      loadPreviewStyle(e.target.value);
    });
  }

  if (syntaxSelect) {
    syntaxSelect.addEventListener('change', (e) => {
      loadSyntaxTheme(e.target.value);
    });
  }

  if (mermaidSelect) {
    mermaidSelect.addEventListener('change', (e) => {
      applyMermaidTheme(e.target.value);
    });
  }
}
