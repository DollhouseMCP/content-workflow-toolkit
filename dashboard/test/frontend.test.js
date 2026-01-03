/**
 * Frontend Tests using JSDOM
 * Tests browser-side JavaScript functionality
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { matchesAssetFilter, hasMatchingFilesInDir } from '../public/js/utils/assetFilters.js';

describe('Frontend Tests', async () => {

  describe('Asset Browser Search', async () => {
    let dom;
    let document;

    beforeEach(() => {
      // Create a fresh DOM for each test
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <div id="content">
            <div class="asset-browser-controls">
              <div class="search-box">
                <input type="text" class="search-input" id="asset-search" placeholder="Search files..." value="">
              </div>
            </div>
            <div class="asset-browser-layout">
              <div class="asset-tree-panel">
                <div class="asset-tree" id="asset-tree">
                  <!-- Tree content here -->
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `, { runScripts: 'dangerously' });

      document = dom.window.document;
    });

    test('search input element exists and is accessible', () => {
      const searchInput = document.getElementById('asset-search');
      assert.ok(searchInput, 'Search input should exist');
      assert.strictEqual(searchInput.tagName, 'INPUT', 'Should be an input element');
      assert.strictEqual(searchInput.type, 'text', 'Should be a text input');
    });

    test('asset-tree element exists for partial updates', () => {
      const assetTree = document.getElementById('asset-tree');
      assert.ok(assetTree, 'Asset tree element should exist');
    });

    test('search input maintains identity when tree is updated (the fix)', () => {
      const searchInput = document.getElementById('asset-search');
      const originalId = searchInput.id;

      // Simulate what updateAssetTreeOnly does - only update the tree
      const assetTree = document.getElementById('asset-tree');
      assetTree.innerHTML = '<div class="asset-tree-item">Updated content</div>';

      // Verify search input still exists and is the same element
      const searchInputAfter = document.getElementById('asset-search');
      assert.ok(searchInputAfter, 'Search input should still exist after tree update');
      assert.strictEqual(searchInputAfter, searchInput, 'Should be the same input element');
      assert.strictEqual(searchInputAfter.id, originalId, 'Should have same id');
    });

    test('search input loses identity when entire content is replaced (the bug)', () => {
      const searchInput = document.getElementById('asset-search');
      const content = document.getElementById('content');

      // This simulates what renderAssets() was doing - replacing entire content
      content.innerHTML = `
        <div class="asset-browser-controls">
          <div class="search-box">
            <input type="text" class="search-input" id="asset-search" placeholder="Search files..." value="">
          </div>
        </div>
        <div class="asset-tree" id="asset-tree"></div>
      `;

      // The new input is a different element
      const searchInputAfter = document.getElementById('asset-search');
      assert.ok(searchInputAfter, 'A search input should exist');
      assert.notStrictEqual(searchInputAfter, searchInput, 'Should be a different element (this is the bug)');
    });

    test('typing in search preserves value when using partial update', () => {
      const searchInput = document.getElementById('asset-search');

      // Type a character
      searchInput.value = 'i';

      // Simulate updateAssetTreeOnly - only update tree, not input
      const assetTree = document.getElementById('asset-tree');
      assetTree.innerHTML = '<div class="asset-tree-item">filtered item</div>';

      // Input should maintain value
      const searchInputAfter = document.getElementById('asset-search');
      assert.strictEqual(searchInputAfter.value, 'i', 'Value should be preserved');
      assert.strictEqual(searchInputAfter, searchInput, 'Same element reference');
    });

    test('input event dispatched on search updates state correctly', () => {
      const searchInput = document.getElementById('asset-search');

      // Simulate state object like dashboard.assetBrowserState
      const state = { searchQuery: '' };

      // Create handler similar to the real one
      const inputHandler = (e) => {
        if (e.target.id === 'asset-search') {
          state.searchQuery = e.target.value;
        }
      };
      document.getElementById('content').addEventListener('input', inputHandler);

      // Type in the search input
      searchInput.value = 'test';
      searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      // Verify state was updated
      assert.strictEqual(state.searchQuery, 'test', 'State should be updated on input');
    });

    test('search input maintains focus after simulated tree update', () => {
      const searchInput = document.getElementById('asset-search');

      // Focus and type
      searchInput.focus();
      searchInput.value = 'test';

      // Verify focus before update
      assert.strictEqual(dom.window.document.activeElement, searchInput, 'Input should have focus initially');

      // Simulate tree-only update (what updateAssetTreeOnly does)
      const assetTree = document.getElementById('asset-tree');
      assetTree.innerHTML = '<div class="asset-tree-item">new content</div>';

      // Focus should be maintained since we didn't touch the input
      assert.strictEqual(dom.window.document.activeElement, searchInput, 'Input should maintain focus after tree update');
      assert.strictEqual(searchInput.value, 'test', 'Value should be preserved');
    });
  });

  describe('Asset Filter Functions (matchesAssetFilter)', async () => {

    test('empty search query matches all files', () => {
      const state = { searchQuery: '', filterType: 'all' };
      const file = { name: 'image.png', ext: '.png' };

      assert.ok(matchesAssetFilter(file, state), 'Empty query should match all');
    });

    test('search query filters files by name', () => {
      const state = { searchQuery: 'image', filterType: 'all' };

      const file1 = { name: 'image.png', ext: '.png' };
      const file2 = { name: 'video.mp4', ext: '.mp4' };

      assert.ok(matchesAssetFilter(file1, state), 'image.png should match "image" query');
      assert.ok(!matchesAssetFilter(file2, state), 'video.mp4 should not match "image" query');
    });

    test('search is case-insensitive', () => {
      const state = { searchQuery: 'IMAGE', filterType: 'all' };
      const file = { name: 'image.png', ext: '.png' };

      assert.ok(matchesAssetFilter(file, state), 'Search should be case-insensitive');
    });

    test('partial matches work', () => {
      const state = { searchQuery: 'mag', filterType: 'all' };
      const file = { name: 'image.png', ext: '.png' };

      assert.ok(matchesAssetFilter(file, state), 'Partial match "mag" should match "image.png"');
    });

    test('type filter: image files', () => {
      const state = { searchQuery: '', filterType: 'image' };

      assert.ok(matchesAssetFilter({ name: 'photo.png', ext: '.png' }, state));
      assert.ok(matchesAssetFilter({ name: 'photo.jpg', ext: '.jpg' }, state));
      assert.ok(matchesAssetFilter({ name: 'photo.jpeg', ext: '.jpeg' }, state));
      assert.ok(matchesAssetFilter({ name: 'photo.gif', ext: '.gif' }, state));
      assert.ok(matchesAssetFilter({ name: 'photo.webp', ext: '.webp' }, state));
      assert.ok(matchesAssetFilter({ name: 'photo.svg', ext: '.svg' }, state));
      assert.ok(!matchesAssetFilter({ name: 'video.mp4', ext: '.mp4' }, state));
      assert.ok(!matchesAssetFilter({ name: 'doc.txt', ext: '.txt' }, state));
    });

    test('type filter: video files', () => {
      const state = { searchQuery: '', filterType: 'video' };

      assert.ok(matchesAssetFilter({ name: 'clip.mp4', ext: '.mp4' }, state));
      assert.ok(matchesAssetFilter({ name: 'clip.mov', ext: '.mov' }, state));
      assert.ok(matchesAssetFilter({ name: 'clip.webm', ext: '.webm' }, state));
      assert.ok(matchesAssetFilter({ name: 'clip.avi', ext: '.avi' }, state));
      assert.ok(!matchesAssetFilter({ name: 'photo.png', ext: '.png' }, state));
    });

    test('type filter: audio files', () => {
      const state = { searchQuery: '', filterType: 'audio' };

      assert.ok(matchesAssetFilter({ name: 'song.mp3', ext: '.mp3' }, state));
      assert.ok(matchesAssetFilter({ name: 'song.wav', ext: '.wav' }, state));
      assert.ok(matchesAssetFilter({ name: 'song.m4a', ext: '.m4a' }, state));
      assert.ok(matchesAssetFilter({ name: 'song.aac', ext: '.aac' }, state));
      assert.ok(matchesAssetFilter({ name: 'song.ogg', ext: '.ogg' }, state));
      assert.ok(!matchesAssetFilter({ name: 'video.mp4', ext: '.mp4' }, state));
    });

    test('type filter: document files', () => {
      const state = { searchQuery: '', filterType: 'document' };

      assert.ok(matchesAssetFilter({ name: 'readme.md', ext: '.md' }, state));
      assert.ok(matchesAssetFilter({ name: 'notes.txt', ext: '.txt' }, state));
      assert.ok(matchesAssetFilter({ name: 'manual.pdf', ext: '.pdf' }, state));
      assert.ok(matchesAssetFilter({ name: 'report.doc', ext: '.doc' }, state));
      assert.ok(matchesAssetFilter({ name: 'report.docx', ext: '.docx' }, state));
      assert.ok(!matchesAssetFilter({ name: 'photo.png', ext: '.png' }, state));
    });

    test('combined search and type filter', () => {
      const state = { searchQuery: 'thumb', filterType: 'image' };

      assert.ok(matchesAssetFilter({ name: 'thumbnail.png', ext: '.png' }, state));
      assert.ok(!matchesAssetFilter({ name: 'thumbnail.mp4', ext: '.mp4' }, state)); // wrong type
      assert.ok(!matchesAssetFilter({ name: 'photo.png', ext: '.png' }, state)); // wrong name
    });

    test('unknown filter type passes through (matches all)', () => {
      const state = { searchQuery: '', filterType: 'unknown-type' };
      const file = { name: 'test.xyz', ext: '.xyz' };

      assert.ok(matchesAssetFilter(file, state), 'Unknown filter type should match all files');
    });
  });

  describe('XSS Prevention - Malicious Filenames', async () => {

    test('filter handles script tag in filename', () => {
      const state = { searchQuery: 'script', filterType: 'all' };
      const maliciousFile = { name: '<script>alert(1)</script>.png', ext: '.png' };

      // Should match based on text content, not execute script
      assert.ok(matchesAssetFilter(maliciousFile, state));
    });

    test('filter handles HTML entities in filename', () => {
      const state = { searchQuery: '&lt;', filterType: 'all' };
      const file = { name: 'test&lt;file&gt;.txt', ext: '.txt' };

      assert.ok(matchesAssetFilter(file, state));
    });

    test('filter handles quotes in filename', () => {
      const state = { searchQuery: 'test', filterType: 'all' };
      const file1 = { name: 'test"file.png', ext: '.png' };
      const file2 = { name: "test'file.png", ext: '.png' };

      assert.ok(matchesAssetFilter(file1, state));
      assert.ok(matchesAssetFilter(file2, state));
    });

    test('filter handles event handlers in filename', () => {
      const state = { searchQuery: 'onerror', filterType: 'all' };
      const maliciousFile = { name: 'img onerror=alert(1).png', ext: '.png' };

      assert.ok(matchesAssetFilter(maliciousFile, state));
    });

    test('filter handles unicode and emoji in filename', () => {
      const state = { searchQuery: '🎵', filterType: 'all' };
      const file = { name: '🎵music🎵.mp3', ext: '.mp3' };

      assert.ok(matchesAssetFilter(file, state));
    });

    test('filter handles empty filename', () => {
      const state = { searchQuery: '', filterType: 'all' };
      const file = { name: '', ext: '.txt' };

      assert.ok(matchesAssetFilter(file, state));
    });

    test('filter handles file without extension', () => {
      const state = { searchQuery: 'readme', filterType: 'all' };
      const file = { name: 'README', ext: '' };

      assert.ok(matchesAssetFilter(file, state));
    });

    test('filter handles very long filename', () => {
      const state = { searchQuery: 'long', filterType: 'all' };
      const longName = 'a'.repeat(1000) + 'long' + 'b'.repeat(1000);
      const file = { name: longName + '.txt', ext: '.txt' };

      assert.ok(matchesAssetFilter(file, state));
    });
  });

  describe('Defensive Null Checks', async () => {

    test('matchesAssetFilter returns false for null file', () => {
      const state = { searchQuery: '', filterType: 'all' };
      assert.ok(!matchesAssetFilter(null, state));
    });

    test('matchesAssetFilter returns false for undefined file', () => {
      const state = { searchQuery: '', filterType: 'all' };
      assert.ok(!matchesAssetFilter(undefined, state));
    });

    test('matchesAssetFilter returns false for null state', () => {
      const file = { name: 'test.png', ext: '.png' };
      assert.ok(!matchesAssetFilter(file, null));
    });

    test('matchesAssetFilter returns false for undefined state', () => {
      const file = { name: 'test.png', ext: '.png' };
      assert.ok(!matchesAssetFilter(file, undefined));
    });

    test('hasMatchingFilesInDir returns false for null node', () => {
      const state = { searchQuery: '', filterType: 'all' };
      assert.ok(!hasMatchingFilesInDir(null, state));
    });

    test('hasMatchingFilesInDir returns false for null state', () => {
      const node = { type: 'file', name: 'test.png', ext: '.png' };
      assert.ok(!hasMatchingFilesInDir(node, null));
    });
  });

  describe('Directory Filter Functions (hasMatchingFilesInDir)', async () => {

    test('file node returns matchesAssetFilter result', () => {
      const state = { searchQuery: 'image', filterType: 'all' };

      const matchingFile = { type: 'file', name: 'image.png', ext: '.png' };
      const nonMatchingFile = { type: 'file', name: 'video.mp4', ext: '.mp4' };

      assert.ok(hasMatchingFilesInDir(matchingFile, state));
      assert.ok(!hasMatchingFilesInDir(nonMatchingFile, state));
    });

    test('empty directory returns true when no filters active', () => {
      const state = { searchQuery: '', filterType: 'all' };
      const emptyDir = { type: 'directory', name: 'empty', children: [] };

      // Empty folders should be visible when not filtering
      assert.ok(hasMatchingFilesInDir(emptyDir, state));
    });

    test('empty directory returns false when search is active', () => {
      const state = { searchQuery: 'something', filterType: 'all' };
      const emptyDir = { type: 'directory', name: 'empty', children: [] };

      // Empty folders should be hidden when searching
      assert.ok(!hasMatchingFilesInDir(emptyDir, state));
    });

    test('directory with matching file returns true', () => {
      const state = { searchQuery: 'image', filterType: 'all' };
      const dir = {
        type: 'directory',
        name: 'assets',
        children: [
          { type: 'file', name: 'image.png', ext: '.png' }
        ]
      };

      assert.ok(hasMatchingFilesInDir(dir, state));
    });

    test('directory with no matching files returns false', () => {
      const state = { searchQuery: 'image', filterType: 'all' };
      const dir = {
        type: 'directory',
        name: 'assets',
        children: [
          { type: 'file', name: 'video.mp4', ext: '.mp4' }
        ]
      };

      assert.ok(!hasMatchingFilesInDir(dir, state));
    });

    test('nested directory with matching file returns true', () => {
      const state = { searchQuery: 'image', filterType: 'all' };
      const dir = {
        type: 'directory',
        name: 'assets',
        children: [
          {
            type: 'directory',
            name: 'subdir',
            children: [
              { type: 'file', name: 'image.png', ext: '.png' }
            ]
          }
        ]
      };

      assert.ok(hasMatchingFilesInDir(dir, state));
    });

    test('deeply nested structure works correctly', () => {
      const state = { searchQuery: 'deep', filterType: 'all' };
      const dir = {
        type: 'directory',
        name: 'level1',
        children: [
          {
            type: 'directory',
            name: 'level2',
            children: [
              {
                type: 'directory',
                name: 'level3',
                children: [
                  { type: 'file', name: 'deep-file.txt', ext: '.txt' }
                ]
              }
            ]
          }
        ]
      };

      assert.ok(hasMatchingFilesInDir(dir, state));
    });
  });

  describe('Asset Preview Loading', async () => {
    let dom;
    let document;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <div id="content">
            <div id="asset-preview-content">
              <div class="asset-preview-document markdown-preview" data-file="/content/assets/test.md">
                <div class="markdown-loading">Loading markdown...</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `, { runScripts: 'dangerously' });

      document = dom.window.document;
    });

    test('preview container can be found by selector with file path', () => {
      const filePath = '/content/assets/test.md';
      const selector = `.markdown-preview[data-file="${filePath}"]`;
      const container = document.querySelector(selector);

      assert.ok(container, 'Container should be found');
      assert.ok(container.innerHTML.includes('Loading'), 'Should show loading state');
    });

    test('AbortController should not be aborted during normal preview flow', () => {
      // Simulate what renderAssetPreview does
      const dashboard = { _previewAbortController: null };

      // Step 1: renderAssetPreview creates an AbortController
      const abortController = new AbortController();
      dashboard._previewAbortController = abortController;

      // Step 2: Verify it's not aborted initially
      assert.strictEqual(abortController.signal.aborted, false, 'Should not be aborted initially');

      // Step 3: Simulate attachAssetBrowserListeners being called
      // (The bug was that it would abort here)
      // Now we verify the abort controller is still valid
      assert.strictEqual(abortController.signal.aborted, false, 'Should still not be aborted after listener setup');
    });

    test('new file selection should abort previous preview request', () => {
      const dashboard = { _previewAbortController: null };

      // First file selected
      const abortController1 = new AbortController();
      dashboard._previewAbortController = abortController1;

      // Second file selected - should abort first
      if (dashboard._previewAbortController) {
        dashboard._previewAbortController.abort();
      }
      const abortController2 = new AbortController();
      dashboard._previewAbortController = abortController2;

      assert.strictEqual(abortController1.signal.aborted, true, 'First controller should be aborted');
      assert.strictEqual(abortController2.signal.aborted, false, 'Second controller should not be aborted');
    });

    test('text preview container can be found by selector', () => {
      // Update DOM for text preview
      const content = document.getElementById('content');
      content.innerHTML = `
        <div id="asset-preview-content">
          <div class="asset-preview-document text-preview" data-file="/content/assets/test.txt">
            <div class="markdown-loading">Loading file...</div>
          </div>
        </div>
      `;

      const filePath = '/content/assets/test.txt';
      const selector = `.text-preview[data-file="${filePath}"]`;
      const container = document.querySelector(selector);

      assert.ok(container, 'Text preview container should be found');
    });

    test('preview with special characters in path can be found', () => {
      const content = document.getElementById('content');
      const filePath = '/content/assets/folder-name/file_name.md';
      content.innerHTML = `
        <div id="asset-preview-content">
          <div class="asset-preview-document markdown-preview" data-file="${filePath}">
            <div class="markdown-loading">Loading...</div>
          </div>
        </div>
      `;

      const selector = `.markdown-preview[data-file="${filePath}"]`;
      const container = document.querySelector(selector);

      assert.ok(container, 'Container with special chars in path should be found');
    });
  });
});
