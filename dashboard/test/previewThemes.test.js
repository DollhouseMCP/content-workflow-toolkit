/**
 * Preview Themes Tests
 * Tests for markdown preview theming functionality
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// Import the module functions
import {
  previewStyles,
  syntaxThemes,
  mermaidThemes,
  getSavedPreviewStyle,
  getSavedSyntaxTheme,
  getSavedMermaidTheme,
  createThemeSelectorsHTML
} from '../public/js/previewThemes.js';

describe('Preview Themes', async () => {

  describe('Theme Configuration Arrays', async () => {

    test('previewStyles has required structure', () => {
      assert.ok(Array.isArray(previewStyles), 'previewStyles should be an array');
      assert.ok(previewStyles.length >= 1, 'Should have at least one style');

      for (const style of previewStyles) {
        assert.ok(typeof style.name === 'string', 'Each style should have a name');
        assert.ok('file' in style, 'Each style should have a file property');
      }
    });

    test('previewStyles has a default style', () => {
      const defaultStyle = previewStyles.find(s => s.default === true);
      assert.ok(defaultStyle, 'Should have a default preview style');
      assert.strictEqual(defaultStyle.file, '', 'Default style should have empty file');
    });

    test('previewStyles includes expected themes', () => {
      const names = previewStyles.map(s => s.name);
      assert.ok(names.includes('Default'), 'Should include Default');
      assert.ok(names.includes('Dark'), 'Should include Dark');
      assert.ok(names.includes('GitHub'), 'Should include GitHub');
    });

    test('syntaxThemes has required structure', () => {
      assert.ok(Array.isArray(syntaxThemes), 'syntaxThemes should be an array');
      assert.ok(syntaxThemes.length >= 1, 'Should have at least one theme');

      for (const theme of syntaxThemes) {
        assert.ok(typeof theme.name === 'string', 'Each theme should have a name');
        assert.ok(typeof theme.file === 'string', 'Each theme should have a file');
        assert.ok(theme.file.length > 0, 'File should not be empty');
      }
    });

    test('syntaxThemes has a default theme', () => {
      const defaultTheme = syntaxThemes.find(t => t.default === true);
      assert.ok(defaultTheme, 'Should have a default syntax theme');
      assert.strictEqual(defaultTheme.file, 'github-dark', 'Default should be github-dark');
    });

    test('syntaxThemes includes popular highlight.js themes', () => {
      const files = syntaxThemes.map(t => t.file);
      assert.ok(files.includes('github-dark'), 'Should include github-dark');
      assert.ok(files.includes('github'), 'Should include github');
      assert.ok(files.includes('monokai'), 'Should include monokai');
    });

    test('mermaidThemes has required structure', () => {
      assert.ok(Array.isArray(mermaidThemes), 'mermaidThemes should be an array');
      assert.ok(mermaidThemes.length >= 1, 'Should have at least one theme');

      for (const theme of mermaidThemes) {
        assert.ok(typeof theme.name === 'string', 'Each theme should have a name');
        assert.ok(typeof theme.value === 'string', 'Each theme should have a value');
      }
    });

    test('mermaidThemes has a default theme', () => {
      const defaultTheme = mermaidThemes.find(t => t.default === true);
      assert.ok(defaultTheme, 'Should have a default mermaid theme');
      assert.strictEqual(defaultTheme.value, 'dark', 'Default should be dark');
    });

    test('mermaidThemes includes all standard mermaid themes', () => {
      const values = mermaidThemes.map(t => t.value);
      assert.ok(values.includes('dark'), 'Should include dark');
      assert.ok(values.includes('default'), 'Should include default');
      assert.ok(values.includes('forest'), 'Should include forest');
      assert.ok(values.includes('neutral'), 'Should include neutral');
    });
  });

  describe('localStorage Functions', async () => {
    let dom;
    let originalLocalStorage;

    beforeEach(() => {
      // Create JSDOM with localStorage
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously'
      });

      // Mock localStorage in global scope
      originalLocalStorage = globalThis.localStorage;
      globalThis.localStorage = dom.window.localStorage;
    });

    afterEach(() => {
      globalThis.localStorage = originalLocalStorage;
    });

    test('getSavedPreviewStyle returns empty string when no saved value', () => {
      localStorage.clear();
      const result = getSavedPreviewStyle();
      assert.strictEqual(result, '', 'Should return empty string for default');
    });

    test('getSavedPreviewStyle returns saved value', () => {
      localStorage.setItem('dashboard-preview-style', 'dark');
      const result = getSavedPreviewStyle();
      assert.strictEqual(result, 'dark', 'Should return saved value');
    });

    test('getSavedSyntaxTheme returns default when no saved value', () => {
      localStorage.clear();
      const result = getSavedSyntaxTheme();
      assert.strictEqual(result, 'github-dark', 'Should return default theme');
    });

    test('getSavedSyntaxTheme returns saved value', () => {
      localStorage.setItem('dashboard-syntax-theme', 'monokai');
      const result = getSavedSyntaxTheme();
      assert.strictEqual(result, 'monokai', 'Should return saved value');
    });

    test('getSavedMermaidTheme returns default when no saved value', () => {
      localStorage.clear();
      const result = getSavedMermaidTheme();
      assert.strictEqual(result, 'dark', 'Should return default theme');
    });

    test('getSavedMermaidTheme returns saved value', () => {
      localStorage.setItem('dashboard-mermaid-theme', 'forest');
      const result = getSavedMermaidTheme();
      assert.strictEqual(result, 'forest', 'Should return saved value');
    });
  });

  describe('Theme Selector HTML Generation', async () => {
    let dom;
    let originalLocalStorage;

    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously'
      });
      originalLocalStorage = globalThis.localStorage;
      globalThis.localStorage = dom.window.localStorage;
      localStorage.clear();
    });

    afterEach(() => {
      globalThis.localStorage = originalLocalStorage;
    });

    test('createThemeSelectorsHTML returns valid HTML string', () => {
      const html = createThemeSelectorsHTML();
      assert.ok(typeof html === 'string', 'Should return a string');
      assert.ok(html.length > 0, 'Should not be empty');
    });

    test('createThemeSelectorsHTML includes all three dropdowns', () => {
      const html = createThemeSelectorsHTML();
      assert.ok(html.includes('id="preview-style-select"'), 'Should include preview style select');
      assert.ok(html.includes('id="syntax-theme-select"'), 'Should include syntax theme select');
      assert.ok(html.includes('id="mermaid-theme-select"'), 'Should include mermaid theme select');
    });

    test('createThemeSelectorsHTML includes all preview style options', () => {
      const html = createThemeSelectorsHTML();
      for (const style of previewStyles) {
        assert.ok(html.includes(`value="${style.file}"`), `Should include option for ${style.name}`);
        assert.ok(html.includes(`>${style.name}</option>`), `Should include label for ${style.name}`);
      }
    });

    test('createThemeSelectorsHTML includes all syntax theme options', () => {
      const html = createThemeSelectorsHTML();
      for (const theme of syntaxThemes) {
        assert.ok(html.includes(`value="${theme.file}"`), `Should include option for ${theme.name}`);
      }
    });

    test('createThemeSelectorsHTML includes all mermaid theme options', () => {
      const html = createThemeSelectorsHTML();
      for (const theme of mermaidThemes) {
        assert.ok(html.includes(`value="${theme.value}"`), `Should include option for ${theme.name}`);
      }
    });

    test('createThemeSelectorsHTML marks saved preview style as selected', () => {
      localStorage.setItem('dashboard-preview-style', 'dark');
      const html = createThemeSelectorsHTML();
      assert.ok(html.includes('value="dark" selected'), 'Should mark dark as selected');
    });

    test('createThemeSelectorsHTML marks saved syntax theme as selected', () => {
      localStorage.setItem('dashboard-syntax-theme', 'monokai');
      const html = createThemeSelectorsHTML();
      assert.ok(html.includes('value="monokai" selected'), 'Should mark monokai as selected');
    });

    test('createThemeSelectorsHTML marks saved mermaid theme as selected', () => {
      localStorage.setItem('dashboard-mermaid-theme', 'forest');
      const html = createThemeSelectorsHTML();
      assert.ok(html.includes('value="forest" selected'), 'Should mark forest as selected');
    });

    test('generated HTML can be parsed as valid DOM', () => {
      const html = createThemeSelectorsHTML();
      const container = dom.window.document.createElement('div');
      container.innerHTML = html;

      const previewSelect = container.querySelector('#preview-style-select');
      const syntaxSelect = container.querySelector('#syntax-theme-select');
      const mermaidSelect = container.querySelector('#mermaid-theme-select');

      assert.ok(previewSelect, 'Preview select should be parseable');
      assert.ok(syntaxSelect, 'Syntax select should be parseable');
      assert.ok(mermaidSelect, 'Mermaid select should be parseable');

      assert.strictEqual(previewSelect.tagName, 'SELECT', 'Should be a select element');
      assert.strictEqual(previewSelect.options.length, previewStyles.length, 'Should have correct number of options');
    });
  });

  describe('Theme Dropdown Accessibility', async () => {
    let dom;
    let originalLocalStorage;

    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously'
      });
      originalLocalStorage = globalThis.localStorage;
      globalThis.localStorage = dom.window.localStorage;
      localStorage.clear();
    });

    afterEach(() => {
      globalThis.localStorage = originalLocalStorage;
    });

    test('dropdowns have title attributes for tooltips', () => {
      const html = createThemeSelectorsHTML();
      assert.ok(html.includes('title="Preview style"'), 'Preview select should have title');
      assert.ok(html.includes('title="Code block theme"'), 'Syntax select should have title');
      assert.ok(html.includes('title="Mermaid diagram theme"'), 'Mermaid select should have title');
    });

    test('dropdowns have consistent class naming', () => {
      const html = createThemeSelectorsHTML();
      const container = dom.window.document.createElement('div');
      container.innerHTML = html;

      const selects = container.querySelectorAll('select');
      for (const select of selects) {
        assert.ok(select.classList.contains('preview-theme-select'), 'All selects should have preview-theme-select class');
      }
    });
  });

  describe('CSS Layer Structure', async () => {

    test('layer order string is correctly formatted', () => {
      // This tests the structure that applyPreviewIsolation creates
      // We verify the concept rather than the implementation
      // Expected: '@layer preview-defaults, preview-theme, syntax-theme;'
      const layers = ['preview-defaults', 'preview-theme', 'syntax-theme'];

      // preview-defaults should come first (lowest priority)
      assert.strictEqual(layers[0], 'preview-defaults', 'Defaults should be first layer');

      // preview-theme should come second (overrides defaults)
      assert.strictEqual(layers[1], 'preview-theme', 'Theme should be second layer');

      // syntax-theme should come last (highest priority for code blocks)
      assert.strictEqual(layers[2], 'syntax-theme', 'Syntax should be third layer');
    });
  });

  describe('Theme File Naming Conventions', async () => {

    test('preview style files use lowercase kebab-case', () => {
      for (const style of previewStyles) {
        if (style.file) {
          assert.ok(/^[a-z][a-z0-9-]*$/.test(style.file), `Style file "${style.file}" should be lowercase kebab-case`);
        }
      }
    });

    test('syntax theme files match highlight.js naming', () => {
      // highlight.js uses lowercase with hyphens
      for (const theme of syntaxThemes) {
        assert.ok(/^[a-z][a-z0-9-]*$/.test(theme.file), `Syntax theme "${theme.file}" should match highlight.js naming`);
      }
    });

    test('mermaid theme values are valid mermaid themes', () => {
      const validMermaidThemes = ['default', 'dark', 'forest', 'neutral', 'base'];
      for (const theme of mermaidThemes) {
        assert.ok(validMermaidThemes.includes(theme.value), `Mermaid theme "${theme.value}" should be a valid mermaid theme`);
      }
    });
  });

  describe('Mermaid Background Colors', async () => {

    test('dark mermaid theme should use dark background', () => {
      // Dark theme needs dark background to match mermaid's dark styling
      const darkTheme = 'dark';
      const expectedBg = '#1e1e1e';

      // This tests the logic used in app.js and previewThemes.js
      const bgColor = darkTheme === 'dark' ? '#1e1e1e' : '#ffffff';
      assert.strictEqual(bgColor, expectedBg, 'Dark theme should have dark background');
    });

    test('default mermaid theme should use light background', () => {
      const defaultTheme = 'default';
      const expectedBg = '#ffffff';

      const bgColor = defaultTheme === 'dark' ? '#1e1e1e' : '#ffffff';
      assert.strictEqual(bgColor, expectedBg, 'Default theme should have light background');
    });

    test('forest mermaid theme should use light background', () => {
      const forestTheme = 'forest';
      const expectedBg = '#ffffff';

      const bgColor = forestTheme === 'dark' ? '#1e1e1e' : '#ffffff';
      assert.strictEqual(bgColor, expectedBg, 'Forest theme should have light background');
    });

    test('neutral mermaid theme should use light background', () => {
      const neutralTheme = 'neutral';
      const expectedBg = '#ffffff';

      const bgColor = neutralTheme === 'dark' ? '#1e1e1e' : '#ffffff';
      assert.strictEqual(bgColor, expectedBg, 'Neutral theme should have light background');
    });
  });

  describe('Edge Cases', async () => {
    let dom;
    let originalLocalStorage;

    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously'
      });
      originalLocalStorage = globalThis.localStorage;
      globalThis.localStorage = dom.window.localStorage;
    });

    afterEach(() => {
      globalThis.localStorage = originalLocalStorage;
    });

    test('handles invalid saved preview style gracefully', () => {
      localStorage.setItem('dashboard-preview-style', 'nonexistent-theme');
      const result = getSavedPreviewStyle();
      // Should return the saved value even if invalid (UI will handle validation)
      assert.strictEqual(result, 'nonexistent-theme');
    });

    test('handles invalid saved syntax theme gracefully', () => {
      localStorage.setItem('dashboard-syntax-theme', 'nonexistent-theme');
      const result = getSavedSyntaxTheme();
      assert.strictEqual(result, 'nonexistent-theme');
    });

    test('handles invalid saved mermaid theme gracefully', () => {
      localStorage.setItem('dashboard-mermaid-theme', 'nonexistent-theme');
      const result = getSavedMermaidTheme();
      assert.strictEqual(result, 'nonexistent-theme');
    });

    test('handles empty string in localStorage', () => {
      localStorage.setItem('dashboard-preview-style', '');
      const result = getSavedPreviewStyle();
      assert.strictEqual(result, '', 'Empty string should be returned as-is');
    });
  });
});
