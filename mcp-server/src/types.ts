// Types for the Content Workflow MCP Server

export interface EpisodeMetadata {
  content_status: 'draft' | 'ready' | 'staged' | 'released';
  title: string;
  description: string;
  tags?: string[];
  category?: number;
  privacy?: string;
  playlist?: string;
  scheduled_at?: string;
  thumbnail?: string;
  distribution?: {
    profile?: string;
    platforms?: string[];
  };
  release?: {
    target_date?: string;
    release_group?: string;
    depends_on?: string[];
    notes?: string;
  };
  recording?: {
    date?: string;
    duration_raw?: string;
    duration_final?: string;
    format?: string;
  };
  series?: {
    name?: string;
    episode_number?: number | null;
  };
  workflow?: {
    scripted?: boolean;
    recorded?: boolean;
    edited?: boolean;
    thumbnail_created?: boolean;
    uploaded?: boolean;
    published?: boolean;
  };
  analytics?: {
    youtube_id?: string;
    publish_date?: string;
    views_24h?: number;
    views_7d?: number;
    ctr?: number;
    avg_view_duration?: string;
  };
}

export interface Episode {
  path: string;
  series: string;
  episode: string;
  metadata: EpisodeMetadata;
  files?: FileInfo[];
}

export interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  ext: string;
}

export interface ReleaseQueueItem {
  path: string;
  status?: string;
  target_date?: string;
  distribution?: string;
  notes?: string;
  blocked_by?: string;
  blocked_since?: string;
  release_date?: string;
}

export interface ReleaseGroup {
  name: string;
  description: string;
  status: string;
  target_date: string;
  condition?: string;
  items: {
    path: string;
    type: string;
    distribution: string;
  }[];
  dependencies?: string[];
  release_order?: string[];
}

export interface ReleaseQueue {
  release_groups?: Record<string, ReleaseGroup>;
  staged?: ReleaseQueueItem[];
  blocked?: ReleaseQueueItem[];
  released?: ReleaseQueueItem[];
}

export interface PipelineStatus {
  draft: Episode[];
  ready: Episode[];
  staged: Episode[];
  released: Episode[];
  blocked: ReleaseQueueItem[];
  total: number;
}

export type WorkflowStage = 'scripted' | 'recorded' | 'edited' | 'thumbnail_created' | 'uploaded' | 'published';

export const VALID_WORKFLOW_STAGES: WorkflowStage[] = [
  'scripted',
  'recorded',
  'edited',
  'thumbnail_created',
  'uploaded',
  'published'
];

export const VALID_CONTENT_STATUSES = ['draft', 'ready', 'staged', 'released'] as const;

/**
 * Available series template types
 */
export type SeriesTemplate = 'default' | 'tutorial' | 'vlog' | 'podcast';

/**
 * Valid series template values
 */
export const VALID_SERIES_TEMPLATES: SeriesTemplate[] = [
  'default',
  'tutorial',
  'vlog',
  'podcast'
];

/**
 * Series metadata structure stored in series.yml
 */
export interface SeriesMetadata {
  name: string;
  slug: string;
  description: string;
  created: string;
  template?: SeriesTemplate;
  settings?: {
    default_distribution_profile?: string;
    default_format?: string;
  };
}

/**
 * Series info returned from series operations
 */
export interface SeriesInfo {
  name: string;
  slug: string;
  path: string;
  metadata: SeriesMetadata;
}
