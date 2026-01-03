// Preview Theme Configuration
// Styles for Markdown preview, Code blocks, and Mermaid diagrams
// Uses CSS isolation techniques from Merview to prevent style bleeding

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
 * Apply base isolation styles to prevent dashboard styles from bleeding into preview
 * This creates a CSS reset boundary for the preview pane
 */
function applyPreviewIsolation() {
  let isolationStyle = document.getElementById('preview-isolation');
  if (isolationStyle) return; // Already applied

  isolationStyle = document.createElement('style');
  isolationStyle.id = 'preview-isolation';
  isolationStyle.textContent = `
    /* CSS Cascade Layers for proper style isolation */
    @layer dashboard-base, preview-reset, preview-styles, syntax-theme;

    /* Reset preview pane to prevent dashboard style bleeding */
    @layer preview-reset {
      .markdown-preview {
        all: initial;
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        color: #333;
        background: #fff;
        padding: 20px;
        overflow-y: auto;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
      }

      .markdown-preview * {
        box-sizing: border-box;
      }

      /* Ensure mermaid diagrams render correctly */
      .markdown-preview .mermaid {
        background: transparent;
        text-align: center;
        margin: 1em 0;
      }

      .markdown-preview .mermaid svg {
        max-width: 100%;
        height: auto;
      }
    }
  `;
  document.head.appendChild(isolationStyle);
}

/**
 * Apply syntax override - isolate code blocks from preview style contamination
 * Adapted from Merview's applySyntaxOverride function
 */
function applySyntaxOverride() {
  let syntaxOverride = document.getElementById('syntax-override');
  if (!syntaxOverride) {
    syntaxOverride = document.createElement('style');
    syntaxOverride.id = 'syntax-override';
    document.head.appendChild(syntaxOverride);
  }

  // Basic structure for code blocks - prevent preview styles from affecting them
  syntaxOverride.textContent = `
    @layer syntax-theme {
      .markdown-preview pre {
        margin: 1em 0;
        padding: 0;
        background: transparent !important;
        border: none !important;
      }

      .markdown-preview pre code.hljs {
        display: block;
        padding: 1em;
        overflow-x: auto;
        border-radius: 6px;
        white-space: pre;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important;
        font-size: 0.9em;
        line-height: 1.5;
        tab-size: 4;
      }

      /* Inline code (not in pre) */
      .markdown-preview code:not(.hljs):not(pre code) {
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important;
        font-size: 0.9em;
        padding: 0.2em 0.4em;
        border-radius: 3px;
      }
    }
  `;
}

/**
 * Load preview style CSS with proper layer wrapping
 */
export async function loadPreviewStyle(styleFile) {
  const existingStyle = document.getElementById('preview-style-css');
  if (existingStyle) {
    existingStyle.remove();
  }

  localStorage.setItem(STORAGE_KEYS.previewStyle, styleFile);

  if (!styleFile) {
    return; // Default style, no CSS to load
  }

  try {
    // Fetch the CSS file
    const response = await fetch(`/styles/${styleFile}.css`);
    if (!response.ok) {
      console.warn(`Failed to load preview style: ${styleFile}`);
      return;
    }

    const cssText = await response.text();

    // Create style element wrapped in CSS layer
    const styleElement = document.createElement('style');
    styleElement.id = 'preview-style-css';
    styleElement.textContent = `@layer preview-styles { ${cssText} }`;
    document.head.appendChild(styleElement);

    // Extract and apply background color to preview container
    const bgMatch = cssText.match(/\.markdown-preview\s*\{[^}]*background:\s*([^;]+)/);
    if (bgMatch) {
      const preview = document.querySelector('.markdown-preview');
      if (preview) {
        preview.style.background = bgMatch[1].trim();
      }
    }
  } catch (error) {
    console.warn('Error loading preview style:', error);
  }
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

  // Reapply syntax override after theme loads
  link.onload = () => applySyntaxOverride();
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
 * Initialize theme system - load saved preferences and apply isolation
 */
export function initializeThemes() {
  // Apply isolation styles first
  applyPreviewIsolation();

  // Apply syntax override
  applySyntaxOverride();

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
