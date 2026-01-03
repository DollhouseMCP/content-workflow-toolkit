// Content Generation Tools for the MCP Server
// Template-based generation that extracts content from script and metadata

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { SERIES_DIR, readYamlFile } from '../utils.js';
import type { EpisodeMetadata } from '../types.js';

/**
 * Extract sections from a markdown script
 */
function extractScriptSections(content: string): {
  title: string;
  sections: { heading: string; content: string }[];
  timestamps: { time: string; label: string }[];
} {
  const lines = content.split('\n');
  const sections: { heading: string; content: string }[] = [];
  const timestamps: { time: string; label: string }[] = [];
  let title = '';
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    // Extract title (first H1)
    if (line.startsWith('# ') && !title) {
      title = line.substring(2).trim();
      continue;
    }

    // Extract H2 sections
    if (line.startsWith('## ')) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
      }
      currentHeading = line.substring(3).trim();
      currentContent = [];

      // Check for timestamp in heading like "## Hook (0:00 - 0:30)"
      const timestampMatch = currentHeading.match(/\((\d+:\d+)/);
      if (timestampMatch) {
        const labelMatch = currentHeading.match(/^([^(]+)/);
        timestamps.push({
          time: timestampMatch[1],
          label: labelMatch ? labelMatch[1].trim() : currentHeading
        });
      }
      continue;
    }

    if (currentHeading) {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentHeading) {
    sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
  }

  return { title, sections, timestamps };
}

/**
 * Extract key points from script sections
 */
function extractKeyPoints(sections: { heading: string; content: string }[]): string[] {
  const keyPoints: string[] = [];

  for (const section of sections) {
    // Skip intro/hook sections for key points
    const heading = section.heading.toLowerCase();
    if (heading.includes('hook') || heading.includes('intro') || heading.includes('outro')) {
      continue;
    }

    // Extract bullet points from content (multiline mode for ^ anchor)
    const bullets = section.content.match(/^[-*]\s+.+$/gm);
    if (bullets) {
      for (const bullet of bullets.slice(0, 3)) {
        const point = bullet.replace(/^[-*]\s+/, '').trim();
        if (point && point.length > 10) {
          keyPoints.push(point);
        }
      }
    }
  }

  return keyPoints.slice(0, 5); // Max 5 key points
}

/**
 * Generate a description from the script.md file
 * Uses template-based extraction from script content
 */
export async function generateDescription(
  series: string,
  episode: string
): Promise<{ success: boolean; description?: string; source?: string; error?: string }> {
  try {
    // Validate path parameters
    if (series.includes('..') || series.includes('/') || series.includes('\\') ||
        episode.includes('..') || episode.includes('/') || episode.includes('\\')) {
      return { success: false, error: 'Invalid series or episode name' };
    }

    const episodePath = path.join(SERIES_DIR, series, episode);
    const scriptPath = path.join(episodePath, 'script.md');
    const metadataPath = path.join(episodePath, 'metadata.yml');

    // Read script
    let scriptContent: string;
    try {
      scriptContent = await fs.readFile(scriptPath, 'utf8');
    } catch {
      return { success: false, error: 'Script file not found' };
    }

    // Read metadata
    let metadata: EpisodeMetadata;
    try {
      metadata = await readYamlFile<EpisodeMetadata>(metadataPath);
    } catch {
      return { success: false, error: 'Episode metadata not found' };
    }

    // Extract content from script
    const { title, sections, timestamps } = extractScriptSections(scriptContent);
    const keyPoints = extractKeyPoints(sections);

    // Build description
    const descriptionParts: string[] = [];

    // Title/intro from metadata or script
    const episodeTitle = metadata.title || title || episode;
    if (metadata.description) {
      descriptionParts.push(metadata.description);
    } else if (episodeTitle) {
      descriptionParts.push(`In this episode: ${episodeTitle}`);
    }

    descriptionParts.push('');

    // Key points
    if (keyPoints.length > 0) {
      descriptionParts.push('What you\'ll learn:');
      for (const point of keyPoints) {
        descriptionParts.push(`• ${point}`);
      }
      descriptionParts.push('');
    }

    // Timestamps
    if (timestamps.length > 0) {
      descriptionParts.push('Timestamps:');
      for (const ts of timestamps) {
        descriptionParts.push(`${ts.time} - ${ts.label}`);
      }
      descriptionParts.push('');
    }

    // Footer template
    descriptionParts.push('---');
    descriptionParts.push('');
    descriptionParts.push('🔔 Subscribe for more content!');
    descriptionParts.push('👍 Like if you found this helpful');
    descriptionParts.push('💬 Leave a comment with your thoughts');

    return {
      success: true,
      description: descriptionParts.join('\n'),
      source: 'template-based'
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to generate description: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Generate social media posts for an episode
 * Uses template-based generation from metadata and script
 */
export async function generateSocialPosts(
  series: string,
  episode: string,
  platforms?: string[]
): Promise<{
  success: boolean;
  posts?: {
    twitter?: string;
    linkedin?: string;
    bluesky?: string;
    threads?: string;
  };
  source?: string;
  warning?: string;
  error?: string;
}> {
  try {
    // Validate path parameters
    if (series.includes('..') || series.includes('/') || series.includes('\\') ||
        episode.includes('..') || episode.includes('/') || episode.includes('\\')) {
      return { success: false, error: 'Invalid series or episode name' };
    }

    const episodePath = path.join(SERIES_DIR, series, episode);
    const scriptPath = path.join(episodePath, 'script.md');
    const metadataPath = path.join(episodePath, 'metadata.yml');

    // Read metadata
    let metadata: EpisodeMetadata;
    try {
      metadata = await readYamlFile<EpisodeMetadata>(metadataPath);
    } catch {
      return { success: false, error: 'Episode metadata not found' };
    }

    // Read script for additional context
    let scriptContent = '';
    try {
      scriptContent = await fs.readFile(scriptPath, 'utf8');
    } catch {
      // Script is optional for social posts
    }

    const { title: scriptTitle, sections } = scriptContent
      ? extractScriptSections(scriptContent)
      : { title: '', sections: [] };

    const episodeTitle = metadata.title || scriptTitle || episode;
    const keyPoints = extractKeyPoints(sections);

    // Track if we have minimal content for warning
    const hasMinimalContent = !metadata.title && !scriptTitle && keyPoints.length === 0;

    // Generate hashtags from tags or series
    const hashtags: string[] = [];
    if (metadata.tags && Array.isArray(metadata.tags)) {
      for (const tag of metadata.tags.slice(0, 3)) {
        hashtags.push(`#${tag.replace(/\s+/g, '')}`);
      }
    }
    if (series) {
      hashtags.push(`#${series.replace(/[^a-zA-Z0-9]/g, '')}`);
    }
    const hashtagStr = hashtags.join(' ');

    // Default to all platforms
    const targetPlatforms = platforms || ['twitter', 'linkedin', 'bluesky', 'threads'];

    const posts: {
      twitter?: string;
      linkedin?: string;
      bluesky?: string;
      threads?: string;
    } = {};

    // Twitter/X (280 chars)
    if (targetPlatforms.includes('twitter')) {
      const twitterPost = [
        `🎬 New video: ${episodeTitle}`,
        '',
        keyPoints[0] ? `💡 ${keyPoints[0].substring(0, 100)}...` : '',
        '',
        `Watch now! 👇`,
        hashtagStr
      ].filter(Boolean).join('\n').substring(0, 280);

      posts.twitter = twitterPost;
    }

    // LinkedIn (longer, professional)
    if (targetPlatforms.includes('linkedin')) {
      const linkedinParts = [
        `🎬 Just published: "${episodeTitle}"`,
        ''
      ];

      if (metadata.description) {
        linkedinParts.push(metadata.description.substring(0, 200));
        linkedinParts.push('');
      }

      if (keyPoints.length > 0) {
        linkedinParts.push('Key takeaways:');
        for (const point of keyPoints.slice(0, 3)) {
          linkedinParts.push(`✅ ${point}`);
        }
        linkedinParts.push('');
      }

      linkedinParts.push('Link in comments! 👇');
      linkedinParts.push('');
      linkedinParts.push(hashtagStr);

      posts.linkedin = linkedinParts.join('\n');
    }

    // Bluesky (300 chars)
    if (targetPlatforms.includes('bluesky')) {
      const blueskyPost = [
        `🎬 New: ${episodeTitle}`,
        '',
        keyPoints[0] ? `${keyPoints[0].substring(0, 150)}` : (metadata.description?.substring(0, 150) || ''),
        '',
        '🔗 Link in bio'
      ].filter(Boolean).join('\n').substring(0, 300);

      posts.bluesky = blueskyPost;
    }

    // Threads (500 chars, casual)
    if (targetPlatforms.includes('threads')) {
      const threadsParts = [
        `new video just dropped 🎬`,
        '',
        episodeTitle,
        ''
      ];

      if (keyPoints[0]) {
        threadsParts.push(`tl;dr: ${keyPoints[0].substring(0, 100)}`);
        threadsParts.push('');
      }

      threadsParts.push('link in bio ✨');

      posts.threads = threadsParts.join('\n').substring(0, 500);
    }

    const result: {
      success: boolean;
      posts: typeof posts;
      source: string;
      warning?: string;
    } = {
      success: true,
      posts,
      source: 'template-based'
    };

    if (hasMinimalContent) {
      result.warning = 'Generated with minimal content. Consider adding a title to metadata or script for better posts.';
    }

    return result;

  } catch (error) {
    return {
      success: false,
      error: `Failed to generate social posts: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
