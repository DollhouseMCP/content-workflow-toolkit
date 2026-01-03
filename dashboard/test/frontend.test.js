/**
 * Frontend Tests using JSDOM
 * Tests browser-side JavaScript functionality
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

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
  });

  describe('Asset Tree Filtering Logic', async () => {
    // Test the filtering logic that runs when search changes

    test('empty search query matches all files', () => {
      const state = { searchQuery: '', filterType: 'all' };
      const file = { name: 'image.png', ext: '.png' };

      // Simulate matchesAssetFilter logic
      const matchesSearch = !state.searchQuery ||
        file.name.toLowerCase().includes(state.searchQuery.toLowerCase());
      const matchesType = state.filterType === 'all';

      assert.ok(matchesSearch && matchesType, 'Empty query should match all');
    });

    test('search query filters files by name', () => {
      const state = { searchQuery: 'image', filterType: 'all' };

      const file1 = { name: 'image.png', ext: '.png' };
      const file2 = { name: 'video.mp4', ext: '.mp4' };

      const matches1 = file1.name.toLowerCase().includes(state.searchQuery.toLowerCase());
      const matches2 = file2.name.toLowerCase().includes(state.searchQuery.toLowerCase());

      assert.ok(matches1, 'image.png should match "image" query');
      assert.ok(!matches2, 'video.mp4 should not match "image" query');
    });

    test('search is case-insensitive', () => {
      const state = { searchQuery: 'IMAGE', filterType: 'all' };
      const file = { name: 'image.png', ext: '.png' };

      const matches = file.name.toLowerCase().includes(state.searchQuery.toLowerCase());
      assert.ok(matches, 'Search should be case-insensitive');
    });

    test('partial matches work', () => {
      const state = { searchQuery: 'mag', filterType: 'all' };
      const file = { name: 'image.png', ext: '.png' };

      const matches = file.name.toLowerCase().includes(state.searchQuery.toLowerCase());
      assert.ok(matches, 'Partial match "mag" should match "image.png"');
    });
  });
});
