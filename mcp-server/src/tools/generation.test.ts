import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

import type * as UtilsModule from '../utils.js';

// Test directory state
let testDir: string;
let seriesDir: string;

async function setupUtilsMock(): Promise<void> {
  vi.doMock('../utils.js', async () => {
    const actual = await vi.importActual<typeof UtilsModule>('../utils.js');
    return {
      ...actual,
      SERIES_DIR: seriesDir,
      BASE_DIR: testDir
    };
  });
}

async function importGenerationModule() {
  return await import('./generation.js');
}

async function createTestEpisode(
  series: string,
  episode: string,
  options: {
    script?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const episodePath = path.join(seriesDir, series, episode);
  await fs.mkdir(episodePath, { recursive: true });

  if (options.script !== undefined) {
    await fs.writeFile(path.join(episodePath, 'script.md'), options.script, 'utf8');
  }

  if (options.metadata) {
    await fs.writeFile(
      path.join(episodePath, 'metadata.yml'),
      yaml.dump(options.metadata),
      'utf8'
    );
  }
}

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-gen-test-'));
  seriesDir = path.join(testDir, 'series');
  await fs.mkdir(seriesDir, { recursive: true });
  await setupUtilsMock();
});

afterEach(async () => {
  vi.resetModules();

  if (testDir) {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Warning: Failed to cleanup test directory ${testDir}:`, error);
    }
  }

  testDir = '';
});

describe('generateDescription', () => {
  it('should generate description from script and metadata', async () => {
    const script = `# My Test Video

## Hook (0:00 - 0:30)
Opening hook content

## Main Content (0:30 - 5:00)
This is the main content section.

- This is an important key point to remember
- Another valuable lesson from this video
- Third point about the topic

## Conclusion (5:00 - 5:30)
Wrapping up the video.
`;

    await createTestEpisode('test-series', 'test-episode', {
      script,
      metadata: {
        title: 'My Test Video',
        description: 'A comprehensive guide to testing',
        content_status: 'draft'
      }
    });

    const { generateDescription } = await importGenerationModule();
    const result = await generateDescription('test-series', 'test-episode');

    expect(result.success).toBe(true);
    expect(result.source).toBe('template-based');
    expect(result.description).toContain('A comprehensive guide to testing');
    expect(result.description).toContain('What you\'ll learn:');
    expect(result.description).toContain('important key point');
    expect(result.description).toContain('Timestamps:');
    expect(result.description).toContain('0:00 - Hook');
    expect(result.description).toContain('0:30 - Main Content');
  });

  it('should use script title when metadata title is missing', async () => {
    const script = `# Script Title Here

## Section One
Some content here.
`;

    await createTestEpisode('test-series', 'no-title', {
      script,
      metadata: {
        content_status: 'draft'
      }
    });

    const { generateDescription } = await importGenerationModule();
    const result = await generateDescription('test-series', 'no-title');

    expect(result.success).toBe(true);
    expect(result.description).toContain('In this episode: Script Title Here');
  });

  it('should handle script without timestamps', async () => {
    const script = `# Video Without Timestamps

## Introduction
Welcome to the video.

## Main Topic
- Point one about the main topic
- Point two that explains more details
`;

    await createTestEpisode('test-series', 'no-timestamps', {
      script,
      metadata: {
        title: 'Video Without Timestamps',
        content_status: 'draft'
      }
    });

    const { generateDescription } = await importGenerationModule();
    const result = await generateDescription('test-series', 'no-timestamps');

    expect(result.success).toBe(true);
    expect(result.description).not.toContain('Timestamps:');
    expect(result.description).toContain('What you\'ll learn:');
  });

  it('should return error when script is missing', async () => {
    await createTestEpisode('test-series', 'no-script', {
      metadata: {
        title: 'Episode Without Script',
        content_status: 'draft'
      }
    });

    const { generateDescription } = await importGenerationModule();
    const result = await generateDescription('test-series', 'no-script');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Script file not found');
  });

  it('should return error when metadata is missing', async () => {
    await createTestEpisode('test-series', 'no-metadata', {
      script: '# Just a script\n\nNo metadata file.'
    });

    const { generateDescription } = await importGenerationModule();
    const result = await generateDescription('test-series', 'no-metadata');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Episode metadata not found');
  });

  it('should reject path traversal attempts', async () => {
    const { generateDescription } = await importGenerationModule();

    const result = await generateDescription('../etc', 'passwd');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid series or episode name');

    const result2 = await generateDescription('series', '../secret');
    expect(result2.success).toBe(false);
    expect(result2.error).toBe('Invalid series or episode name');
  });

  it('should skip hook/intro/outro sections for key points', async () => {
    const script = `# Test Video

## Hook
- This hook point should be skipped from key points
- Another hook point to skip

## Intro
- Intro point should also be skipped

## The Real Content
- This is a real key point that should appear
- Another real point for the description

## Outro
- Outro closing point to skip
`;

    await createTestEpisode('test-series', 'skip-sections', {
      script,
      metadata: { title: 'Test', content_status: 'draft' }
    });

    const { generateDescription } = await importGenerationModule();
    const result = await generateDescription('test-series', 'skip-sections');

    expect(result.success).toBe(true);
    expect(result.description).not.toContain('hook point should be skipped');
    expect(result.description).not.toContain('Intro point');
    expect(result.description).not.toContain('Outro closing');
    expect(result.description).toContain('real key point');
  });
});

describe('generateSocialPosts', () => {
  it('should generate posts for all platforms by default', async () => {
    await createTestEpisode('test-series', 'social-test', {
      script: `# Amazing Video

## Content
- Key insight about the topic here
`,
      metadata: {
        title: 'Amazing Video Title',
        description: 'This video is amazing',
        tags: ['tech', 'tutorial'],
        content_status: 'draft'
      }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'social-test');

    expect(result.success).toBe(true);
    expect(result.source).toBe('template-based');
    expect(result.posts?.twitter).toBeDefined();
    expect(result.posts?.linkedin).toBeDefined();
    expect(result.posts?.bluesky).toBeDefined();
    expect(result.posts?.threads).toBeDefined();
  });

  it('should filter platforms when specified', async () => {
    await createTestEpisode('test-series', 'filtered', {
      script: '# Video\n\n## Content\nSome content',
      metadata: { title: 'Video', content_status: 'draft' }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'filtered', ['twitter', 'bluesky']);

    expect(result.success).toBe(true);
    expect(result.posts?.twitter).toBeDefined();
    expect(result.posts?.bluesky).toBeDefined();
    expect(result.posts?.linkedin).toBeUndefined();
    expect(result.posts?.threads).toBeUndefined();
  });

  it('should include hashtags from tags', async () => {
    await createTestEpisode('test-series', 'hashtags', {
      script: '# Video\n\n## Stuff\nContent',
      metadata: {
        title: 'Hashtag Test',
        tags: ['AI', 'machine learning'],
        content_status: 'draft'
      }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'hashtags', ['twitter']);

    expect(result.success).toBe(true);
    expect(result.posts?.twitter).toContain('#AI');
    expect(result.posts?.twitter).toContain('#machinelearning');
    expect(result.posts?.twitter).toContain('#testseries');
  });

  it('should respect character limits', async () => {
    const longTitle = 'A'.repeat(200);

    await createTestEpisode('test-series', 'long-content', {
      script: `# ${longTitle}\n\n## Content\n- ${'B'.repeat(300)}`,
      metadata: { title: longTitle, content_status: 'draft' }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'long-content');

    expect(result.success).toBe(true);
    expect(result.posts?.twitter?.length).toBeLessThanOrEqual(280);
    expect(result.posts?.bluesky?.length).toBeLessThanOrEqual(300);
    expect(result.posts?.threads?.length).toBeLessThanOrEqual(500);
  });

  it('should work without script file', async () => {
    await createTestEpisode('test-series', 'no-script', {
      metadata: {
        title: 'Video Without Script',
        description: 'Description only',
        content_status: 'draft'
      }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'no-script');

    expect(result.success).toBe(true);
    expect(result.posts?.twitter).toContain('Video Without Script');
  });

  it('should return error when metadata is missing', async () => {
    await fs.mkdir(path.join(seriesDir, 'test-series', 'no-meta'), { recursive: true });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'no-meta');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Episode metadata not found');
  });

  it('should reject path traversal attempts', async () => {
    const { generateSocialPosts } = await importGenerationModule();

    const result = await generateSocialPosts('..', 'passwd');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid series or episode name');
  });

  it('should use episode slug as fallback title', async () => {
    await createTestEpisode('test-series', 'my-episode-slug', {
      script: '# \n\n## Content\nNo title in script',
      metadata: { content_status: 'draft' }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'my-episode-slug', ['threads']);

    expect(result.success).toBe(true);
    expect(result.posts?.threads).toContain('my-episode-slug');
  });

  it('should include warning when content is minimal', async () => {
    await createTestEpisode('test-series', 'minimal-content', {
      script: '# \n\n## Section\nNo key points here, just text.',
      metadata: { content_status: 'draft' }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'minimal-content');

    expect(result.success).toBe(true);
    expect(result.warning).toContain('minimal content');
  });

  it('should not include warning when content is sufficient', async () => {
    await createTestEpisode('test-series', 'good-content', {
      script: '# Great Video Title\n\n## Topic\n- Key point one for viewers\n- Key point two here',
      metadata: { title: 'Great Video', content_status: 'draft' }
    });

    const { generateSocialPosts } = await importGenerationModule();
    const result = await generateSocialPosts('test-series', 'good-content');

    expect(result.success).toBe(true);
    expect(result.warning).toBeUndefined();
  });
});
