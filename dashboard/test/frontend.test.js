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
  });

  describe('Directory Filter Functions (hasMatchingFilesInDir)', async () => {

    test('file node returns matchesAssetFilter result', () => {
      const state = { searchQuery: 'image', filterType: 'all' };

      const matchingFile = { type: 'file', name: 'image.png', ext: '.png' };
      const nonMatchingFile = { type: 'file', name: 'video.mp4', ext: '.mp4' };

      assert.ok(hasMatchingFilesInDir(matchingFile, state));
      assert.ok(!hasMatchingFilesInDir(nonMatchingFile, state));
    });

    test('empty directory returns false', () => {
      const state = { searchQuery: '', filterType: 'all' };
      const emptyDir = { type: 'directory', name: 'empty', children: [] };

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
});
