export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: {
    login: string;
    id: number;
    type: string;
  };
  description: string;
  url: string;
  cloneUrl: string;
  homepage?: string;
  language: string;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  issues: number;
  openIssues: number;
  watchers: number;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date;
  size: number;
  isArchived: boolean;
  isDisabled: boolean;
  license?: {
    key: string;
    name: string;
    url?: string;
  };
  topics: string[];
}

export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
  createdAt: Date;
  publishedAt: Date;
  author: {
    login: string;
    id: number;
  };
  assets: GitHubAsset[];
  targetCommitish: string;
}

export interface GitHubAsset {
  id: number;
  name: string;
  contentType: string;
  size: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
  browserDownloadUrl: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  url: string;
  additions: number;
  deletions: number;
  changed: number;
  files: GitHubFile[];
}

export interface GitHubFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
}

export interface GitHubWebhookEvent {
  id: string;
  type: 'push' | 'release' | 'issues' | 'pull_request' | 'star';
  repository: GitHubRepository;
  payload: any;
  timestamp: Date;
  processed: boolean;
}

export interface MonitoringConfig {
  repository: {
    owner: string;
    name: string;
    branch?: string;
  };
  monitoring: {
    releases: boolean;
    commits: boolean;
    issues: boolean;
    stars: boolean;
    forks: boolean;
    dependencies: boolean;
  };
  notifications: {
    slack?: {
      webhook: string;
      channel: string;
    };
    email?: {
      recipients: string[];
    };
    webhook?: {
      url: string;
      secret?: string;
    };
  };
  schedule: {
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
    timezone: string;
  };
}

export interface MonitoringStats {
  repositoryId: number;
  lastChecked: Date;
  totalReleases: number;
  totalCommits: number;
  totalIssues: number;
  recentActivity: {
    releases: number;
    commits: number;
    issues: number;
    stars: number;
    forks: number;
  };
  errorCount: number;
  lastError?: string;
}

export interface DependencyChanges {
  packageJson?: any;
  dependenciesChanged: boolean;
  newDependencies: string[];
  removedDependencies: string[];
  updatedDependencies: Array<{ name: string; oldVersion: string; newVersion: string }>;
}

export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  error?: string;
  processedAt: Date;
}

export interface MonitoringHealthCheck {
  apiStatus: 'healthy' | 'degraded' | 'unhealthy';
  rateLimitRemaining: number;
  rateLimitReset: Date;
  activeRepositories: number;
  lastWebhookReceived?: Date;
  errorCount: number;
}
