# E6-Story6-1-Monitoring-GitHub-API.md

## Epic 6: Crawling Service

### Story 6.1: Monitoring GitHub API

**Description**: Surveillance des releases et mises à jour des bibliothèques

---

## Objectif

Développer un service de monitoring complet qui surveille les releases GitHub, les mises à jour de bibliothèques et les changements significatifs pour maintenir l'index de documentation à jour.

---

## Prérequis

- Clé API GitHub avec permissions appropriées
- Service de stockage (Epic4) opérationnel
- Système de notification configuré
- Base de données pour le tracking des changements

---

## Spécifications Techniques

### 1. Architecture du Monitoring

#### 1.1 Types et Interfaces

```typescript
// src/types/github-monitoring.types.ts
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
    url: string;
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
```

#### 1.2 Configuration du Service

```typescript
// src/config/github-monitoring.config.ts
export const GITHUB_MONITORING_CONFIG = {
  api: {
    baseUrl: 'https://api.github.com',
    version: '2022-11-28',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  },
  rateLimit: {
    requestsPerHour: 5000,
    resetBuffer: 60, // Secondes de buffer avant le reset
    burstLimit: 30
  },
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    events: ['push', 'release', 'issues', 'pull_request', 'star'],
    timeout: 10000
  },
  monitoring: {
    defaultBranch: 'main',
    maxCommitsPerCheck: 100,
    maxReleasesPerCheck: 50,
    staleThreshold: 30, // jours
    dependencyFiles: ['package.json', 'yarn.lock', 'package-lock.json', 'pnpm-lock.yaml']
  },
  notifications: {
    batchSize: 10,
    retryAttempts: 3,
    debounceMs: 5000
  }
};
```

### 2. Service de Monitoring GitHub

#### 2.1 GitHub Monitoring Service

```typescript
// src/services/github-monitoring.service.ts
import Octokit from '@octokit/rest';
import { Webhooks } from '@octokit/webhooks';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { 
  GitHubRepository, 
  GitHubRelease, 
  GitHubCommit, 
  GitHubWebhookEvent,
  MonitoringConfig,
  MonitoringStats
} from '../types/github-monitoring.types';

export class GitHubMonitoringService {
  private octokit: Octokit;
  private webhooks: Webhooks;
  private rateLimitTracker: Map<string, number[]> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis,
    private config: {
      githubToken: string;
      webhookSecret?: string;
    }
  ) {
    this.octokit = new Octokit({
      auth: this.config.githubToken,
      userAgent: 'TwinMe-Crawler/1.0',
      timeZone: 'UTC',
      throttle: {
        onRateLimit: (retryAfter, options) => {
          console.warn(`Rate limit exceeded, retrying after ${retryAfter} seconds`);
          return true;
        },
        onAbuseLimit: () => {
          console.warn('Abuse limit detected');
          return false;
        }
      }
    });

    if (this.config.webhookSecret) {
      this.webhooks = new Webhooks({
        secret: this.config.webhookSecret
      });
    }
  }

  async startMonitoring(config: MonitoringConfig): Promise<void> {
    console.log(`Starting monitoring for ${config.repository.owner}/${config.repository.name}`);

    // 1. Vérification que le repository existe
    const repository = await this.getRepository(config.repository.owner, config.repository.name);
    if (!repository) {
      throw new Error(`Repository ${config.repository.owner}/${config.repository.name} not found`);
    }

    // 2. Configuration des webhooks si nécessaire
    if (config.schedule.frequency === 'realtime') {
      await this.setupWebhooks(repository, config);
    }

    // 3. Démarrage du monitoring selon la fréquence
    await this.scheduleMonitoring(config);

    // 4. Premier scan immédiat
    await this.performFullScan(config);
  }

  async getRepository(owner: string, name: string): Promise<GitHubRepository | null> {
    try {
      const response = await this.octokit.repos.get({
        owner,
        name
      });

      const repo = response.data;
      
      // Récupération des langages utilisés
      const languagesResponse = await this.octokit.repos.listLanguages({
        owner,
        name
      });

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: {
          login: repo.owner.login,
          id: repo.owner.id,
          type: repo.owner.type
        },
        description: repo.description || '',
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        homepage: repo.homepage || undefined,
        language: repo.language || '',
        languages: languagesResponse.data,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        issues: repo.open_issues_count,
        openIssues: repo.open_issues_count,
        watchers: repo.watchers_count,
        defaultBranch: repo.default_branch,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at),
        pushedAt: new Date(repo.pushed_at),
        size: repo.size,
        isArchived: repo.archived,
        isDisabled: repo.disabled,
        license: repo.license ? {
          key: repo.license.key,
          name: repo.license.name,
          url: repo.license.url || ''
        } : undefined,
        topics: repo.topics || []
      };
    } catch (error) {
      console.error(`Error fetching repository ${owner}/${name}:`, error);
      return null;
    }
  }

  async getReleases(owner: string, name: string, limit: number = 50): Promise<GitHubRelease[]> {
    try {
      await this.checkRateLimit();
      
      const response = await this.octokit.repos.listReleases({
        owner,
        name,
        per_page: limit
      });

      return response.data.map(release => ({
        id: release.id,
        tagName: release.tag_name,
        name: release.name || release.tag_name,
        body: release.body || '',
        prerelease: release.prerelease,
        draft: release.draft,
        createdAt: new Date(release.created_at),
        publishedAt: new Date(release.published_at),
        author: {
          login: release.author.login,
          id: release.author.id
        },
        assets: release.assets.map(asset => ({
          id: asset.id,
          name: asset.name,
          contentType: asset.content_type,
          size: asset.size,
          downloadCount: asset.download_count,
          createdAt: new Date(asset.created_at),
          updatedAt: new Date(asset.updated_at),
          browserDownloadUrl: asset.browser_download_url
        })),
        targetCommitish: release.target_commitish
      }));
    } catch (error) {
      console.error(`Error fetching releases for ${owner}/${name}:`, error);
      return [];
    }
  }

  async getRecentCommits(owner: string, name: string, branch?: string, limit: number = 100): Promise<GitHubCommit[]> {
    try {
      await this.checkRateLimit();
      
      const response = await this.octokit.repos.listCommits({
        owner,
        name,
        sha: branch,
        per_page: limit
      });

      const commits: GitHubCommit[] = [];

      for (const commit of response.data) {
        try {
          const detailedCommit = await this.octokit.repos.getCommit({
            owner,
            name,
            ref: commit.sha
          });

          commits.push({
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              name: commit.commit.author.name,
              email: commit.commit.author.email,
              date: new Date(commit.commit.author.date)
            },
            url: commit.html_url,
            additions: detailedCommit.data.stats.additions,
            deletions: detailedCommit.data.stats.deletions,
            changed: detailedCommit.data.stats.changed,
            files: detailedCommit.data.files.map(file => ({
              filename: file.filename,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
              patch: file.patch || '',
              status: file.status as any
            }))
          });
        } catch (error) {
          // Si on ne peut pas récupérer les détails, on utilise les infos de base
          commits.push({
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              name: commit.commit.author.name,
              email: commit.commit.author.email,
              date: new Date(commit.commit.author.date)
            },
            url: commit.html_url,
            additions: 0,
            deletions: 0,
            changed: 0,
            files: []
          });
        }
      }

      return commits;
    } catch (error) {
      console.error(`Error fetching commits for ${owner}/${name}:`, error);
      return [];
    }
  }

  async checkDependencies(owner: string, name: string, branch?: string): Promise<{
    packageJson?: any;
    dependenciesChanged: boolean;
    newDependencies: string[];
    removedDependencies: string[];
    updatedDependencies: Array<{ name: string; oldVersion: string; newVersion: string }>;
  }> {
    try {
      await this.checkRateLimit();
      
      // Récupération du package.json
      const packageJsonResponse = await this.octokit.repos.getContent({
        owner,
        name,
        path: 'package.json',
        ref: branch
      });

      if (packageJsonResponse.data.type !== 'file') {
        return { dependenciesChanged: false, newDependencies: [], removedDependencies: [], updatedDependencies: [] };
      }

      const content = Buffer.from(packageJsonResponse.data.content, 'base64').toString();
      const packageJson = JSON.parse(content);

      // Comparaison avec la version précédente en base
      const previousVersion = await this.getPreviousPackageJson(owner, name);
      
      if (!previousVersion) {
        return {
          packageJson,
          dependenciesChanged: false,
          newDependencies: [],
          removedDependencies: [],
          updatedDependencies: []
        };
      }

      const currentDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const previousDeps = { ...previousVersion.dependencies, ...previousVersion.devDependencies };

      const newDependencies = Object.keys(currentDeps).filter(dep => !previousDeps[dep]);
      const removedDependencies = Object.keys(previousDeps).filter(dep => !currentDeps[dep]);
      const updatedDependencies: Array<{ name: string; oldVersion: string; newVersion: string }> = [];

      for (const [dep, version] of Object.entries(currentDeps)) {
        if (previousDeps[dep] && previousDeps[dep] !== version) {
          updatedDependencies.push({ name: dep, oldVersion: previousDeps[dep], newVersion: version });
        }
      }

      return {
        packageJson,
        dependenciesChanged: newDependencies.length > 0 || removedDependencies.length > 0 || updatedDependencies.length > 0,
        newDependencies,
        removedDependencies,
        updatedDependencies
      };
    } catch (error) {
      console.error(`Error checking dependencies for ${owner}/${name}:`, error);
      return { dependenciesChanged: false, newDependencies: [], removedDependencies: [], updatedDependencies: [] };
    }
  }

  private async setupWebhooks(repository: GitHubRepository, config: MonitoringConfig): Promise<void> {
    try {
      // Vérification si le webhook existe déjà
      const existingWebhooks = await this.octokit.repos.listWebhooks({
        owner: repository.owner.login,
        name: repository.name
      });

      const webhookUrl = process.env.GITHUB_WEBHOOK_URL;
      if (!webhookUrl) {
        console.warn('GitHub webhook URL not configured, skipping webhook setup');
        return;
      }

      const existingWebhook = existingWebhooks.data.find(webhook => 
        webhook.config.url === webhookUrl
      );

      if (!existingWebhook) {
        // Création du webhook
        await this.octokit.repos.createWebhook({
          owner: repository.owner.login,
          name: repository.name,
          name: 'web',
          active: true,
          events: config.schedule.frequency === 'realtime' ? ['push', 'release', 'issues'] : ['release'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: this.config.webhookSecret,
            insecure_ssl: false
          }
        });

        console.log(`Webhook created for ${repository.fullName}`);
      }
    } catch (error) {
      console.error(`Error setting up webhooks for ${repository.fullName}:`, error);
    }
  }

  private async scheduleMonitoring(config: MonitoringConfig): Promise<void> {
    const scheduleKey = `monitoring:schedule:${config.repository.owner}/${config.repository.name}`;
    
    // Configuration du scheduler selon la fréquence
    const schedules = {
      hourly: '0 * * * *',
      daily: '0 2 * * *',
      weekly: '0 2 * * 0'
    };

    if (config.schedule.frequency !== 'realtime') {
      const cron = schedules[config.schedule.frequency];
      if (cron) {
        await this.redis.set(scheduleKey, JSON.stringify({
          config,
          cron,
          active: true,
          lastRun: null
        }));
      }
    }
  }

  private async performFullScan(config: MonitoringConfig): Promise<void> {
    const { owner, name } = config.repository;
    console.log(`Performing full scan for ${owner}/${name}`);

    try {
      const repository = await this.getRepository(owner, name);
      if (!repository) return;

      const stats: MonitoringStats = {
        repositoryId: repository.id,
        lastChecked: new Date(),
        totalReleases: 0,
        totalCommits: 0,
        totalIssues: repository.openIssues,
        recentActivity: {
          releases: 0,
          commits: 0,
          issues: 0,
          stars: 0,
          forks: 0
        },
        errorCount: 0
      };

      // Monitoring des releases
      if (config.monitoring.releases) {
        const releases = await this.getReleases(owner, name);
        stats.totalReleases = releases.length;
        stats.recentActivity.releases = releases.filter(r => 
          (Date.now() - new Date(r.publishedAt).getTime()) < 7 * 24 * 60 * 60 * 1000
        ).length;

        // Déclenchement des notifications pour les nouvelles releases
        await this.checkNewReleases(owner, name, releases);
      }

      // Monitoring des commits
      if (config.monitoring.commits) {
        const commits = await this.getRecentCommits(owner, name, repository.defaultBranch);
        stats.totalCommits = commits.length;
        stats.recentActivity.commits = commits.filter(c => 
          (Date.now() - new Date(c.author.date).getTime()) < 7 * 24 * 60 * 60 * 1000
        ).length;
      }

      // Monitoring des dépendances
      if (config.monitoring.dependencies) {
        const depChanges = await this.checkDependencies(owner, name, repository.defaultBranch);
        if (depChanges.dependenciesChanged) {
          await this.notifyDependencyChanges(config, depChanges);
        }
      }

      // Sauvegarde des stats
      await this.saveMonitoringStats(config.repository.owner, config.repository.name, stats);

      console.log(`Scan completed for ${owner}/${name}:`, stats);

    } catch (error) {
      console.error(`Error during full scan for ${owner}/${name}:`, error);
      await this.logMonitoringError(config.repository.owner, config.repository.name, error.message);
    }
  }

  private async checkNewReleases(owner: string, name: string, releases: GitHubRelease[]): Promise<void> {
    const lastReleaseKey = `last_release:${owner}/${name}`;
    const lastReleaseTime = await this.redis.get(lastReleaseKey);

    const newReleases = releases.filter(release => {
      if (!lastReleaseTime) return true;
      return new Date(release.publishedAt) > new Date(lastReleaseTime);
    });

    if (newReleases.length > 0) {
      // Mise à jour du timestamp de la dernière release
      const latestRelease = newReleases[0];
      await this.redis.set(lastReleaseKey, latestRelease.publishedAt);

      // Notification des nouvelles releases
      await this.notifyNewReleases(owner, name, newReleases);
    }
  }

  private async notifyNewReleases(owner: string, name: string, releases: GitHubRelease[]): Promise<void> {
    // Implémentation des notifications (Slack, email, webhook)
    for (const release of releases) {
      console.log(`New release for ${owner}/${name}: ${release.tagName}`);
      
      // Envoi des notifications selon la configuration
      // TODO: Implémenter les différents canaux de notification
    }
  }

  private async notifyDependencyChanges(config: MonitoringConfig, changes: any): Promise<void> {
    console.log(`Dependency changes detected for ${config.repository.owner}/${config.repository.name}:`, changes);
    
    // TODO: Implémenter les notifications de changements de dépendances
  }

  private async saveMonitoringStats(owner: string, name: string, stats: MonitoringStats): Promise<void> {
    const key = `monitoring:stats:${owner}/${name}`;
    await this.redis.setex(key, 86400, JSON.stringify(stats)); // TTL 24h

    // Sauvegarde en base pour l'historique
    await this.db.query(`
      INSERT INTO monitoring_stats (
        repository_owner, repository_name, stats, created_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (repository_owner, repository_name) 
      DO UPDATE SET stats = EXCLUDED.stats, created_at = NOW()
    `, [owner, name, JSON.stringify(stats)]);
  }

  private async logMonitoringError(owner: string, name: string, error: string): Promise<void> {
    const errorKey = `monitoring:errors:${owner}/${name}`;
    await this.redis.lpush(errorKey, JSON.stringify({
      error,
      timestamp: new Date()
    }));
    await this.redis.ltrim(errorKey, 0, 99); // Garder les 100 dernières erreurs
  }

  private async getPreviousPackageJson(owner: string, name: string): Promise<any> {
    const key = `package_json:${owner}/${name}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async checkRateLimit(): Promise<void> {
    try {
      const rateLimit = await this.octokit.rateLimit.get();
      const remaining = rateLimit.data.resources.core.remaining;
      const reset = new Date(rateLimit.data.resources.core.reset * 1000);

      if (remaining < 100) {
        const waitTime = reset.getTime() - Date.now() + 60000; // +1min de buffer
        console.warn(`Rate limit low (${remaining} remaining), waiting ${waitTime}ms`);
        await this.delay(waitTime);
      }
    } catch (error) {
      console.error('Error checking rate limit:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Méthodes pour les webhooks
  async handleWebhookEvent(event: GitHubWebhookEvent): Promise<void> {
    console.log(`Processing webhook event: ${event.type} for ${event.repository.fullName}`);

    try {
      switch (event.type) {
        case 'release':
          await this.handleReleaseEvent(event);
          break;
        case 'push':
          await this.handlePushEvent(event);
          break;
        case 'issues':
          await this.handleIssuesEvent(event);
          break;
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      // Marquer l'événement comme traité
      await this.markWebhookEventProcessed(event.id);

    } catch (error) {
      console.error(`Error processing webhook event ${event.id}:`, error);
    }
  }

  private async handleReleaseEvent(event: GitHubWebhookEvent): Promise<void> {
    const release = event.payload.release;
    console.log(`New release: ${release.tag_name} for ${event.repository.fullName}`);
    
    // Traitement de la release
    await this.processNewRelease(event.repository, release);
  }

  private async handlePushEvent(event: GitHubWebhookEvent): Promise<void> {
    const push = event.payload;
    const branch = push.ref.replace('refs/heads/', '');
    
    console.log(`New push to ${branch} in ${event.repository.fullName}`);
    
    // Vérification des changements de dépendances
    if (push.commits.some((commit: any) => 
      commit.modified.some((file: string) => 
        GITHUB_MONITORING_CONFIG.monitoring.dependencyFiles.includes(file)
      )
    )) {
      const depChanges = await this.checkDependencies(
        event.repository.owner.login,
        event.repository.name,
        branch
      );
      
      if (depChanges.dependenciesChanged) {
        await this.notifyDependencyChanges({
          repository: {
            owner: event.repository.owner.login,
            name: event.repository.name
          },
          monitoring: { dependencies: true },
          notifications: {},
          schedule: { frequency: 'realtime', timezone: 'UTC' }
        }, depChanges);
      }
    }
  }

  private async handleIssuesEvent(event: GitHubWebhookEvent): Promise<void> {
    const issue = event.payload.issue;
    const action = event.payload.action;
    
    console.log(`Issue ${action}: #${issue.number} in ${event.repository.fullName}`);
    
    // Traitement des événements d'issues
  }

  private async processNewRelease(repository: GitHubRepository, release: any): Promise<void> {
    // Implémentation du traitement des nouvelles releases
    // Indexation de la documentation, mise à jour de la base, etc.
  }

  private async markWebhookEventProcessed(eventId: string): Promise<void> {
    await this.redis.setex(`webhook:processed:${eventId}`, 86400, 'true');
  }
}
```

### 3. Base de Données pour le Monitoring

#### 3.1 Schéma de Monitoring

```sql
-- src/db/schema/monitoring-schema.sql
-- Table pour les repositories monitorés
CREATE TABLE monitored_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id INTEGER NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(511) NOT NULL,
    default_branch VARCHAR(255) NOT NULL DEFAULT 'main',
    monitoring_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_monitored_repo UNIQUE (owner, name)
);

-- Table pour les releases détectées
CREATE TABLE detected_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES monitored_repositories(id) ON DELETE CASCADE,
    release_id INTEGER NOT NULL,
    tag_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    body TEXT,
    prerelease BOOLEAN DEFAULT false,
    draft BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    author_login VARCHAR(255),
    assets_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_release UNIQUE (repository_id, release_id)
);

-- Table pour les changements de dépendances
CREATE TABLE dependency_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES monitored_repositories(id) ON DELETE CASCADE,
    commit_sha VARCHAR(40),
    branch VARCHAR(255),
    changes JSONB NOT NULL, -- { new: [], removed: [], updated: [] }
    package_json JSONB,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT false
);

-- Table pour les statistiques de monitoring
CREATE TABLE monitoring_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES monitored_repositories(id) ON DELETE CASCADE,
    stats JSONB NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les événements webhook
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    repository_id UUID REFERENCES monitored_repositories(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX idx_monitored_repositories_active ON monitored_repositories(is_active);
CREATE INDEX idx_monitored_repositories_last_checked ON monitored_repositories(last_checked);
CREATE INDEX idx_detected_releases_published_at ON detected_releases(published_at DESC);
CREATE INDEX idx_dependency_changes_detected_at ON dependency_changes(detected_at DESC);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX idx_monitoring_stats_recorded_at ON monitoring_stats(recorded_at DESC);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_monitoring_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monitored_repositories_updated_at
    BEFORE UPDATE ON monitored_repositories
    FOR EACH ROW EXECUTE FUNCTION update_monitoring_timestamps();
```

---

## Tâches Détaillées

### 1. Configuration GitHub API
- [ ] Configurer Octokit avec authentification
- [ ] Implémenter le rate limiting
- [ ] Configurer les webhooks
- [ ] Gérer les erreurs d'API

### 2. Service de Monitoring
- [ ] Développer GitHubMonitoringService
- [ ] Implémenter la surveillance des releases
- [ ] Ajouter le monitoring des commits
- [ ] Détecter les changements de dépendances

### 3. Base de Données
- [ ] Créer le schéma de monitoring
- [ ] Implémenter le stockage des stats
- [ ] Ajouter le tracking des événements
- [ ] Optimiser les index

### 4. Notifications
- [ ] Implémenter les notifications Slack
- [ ] Ajouter les notifications email
- [ ] Configurer les webhooks personnalisés
- [ ] Gérer le batching des notifications

---

## Validation

### Tests du Service

```typescript
// __tests__/github-monitoring.service.test.ts
describe('GitHubMonitoringService', () => {
  let service: GitHubMonitoringService;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    mockOctokit = {
      repos: {
        get: jest.fn(),
        listReleases: jest.fn(),
        listCommits: jest.fn(),
        getContent: jest.fn()
      },
      rateLimit: {
        get: jest.fn()
      }
    } as any;

    service = new GitHubMonitoringService(
      mockDb,
      mockRedis,
      {
        githubToken: 'test-token',
        webhookSecret: 'test-secret'
      }
    );
  });

  describe('getRepository', () => {
    it('should fetch repository information', async () => {
      const mockRepo = {
        id: 12345,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        description: 'Test repository',
        stargazers_count: 100,
        forks_count: 50,
        open_issues_count: 10
      };

      mockOctokit.repos.get.mockResolvedValue({ data: mockRepo });
      mockOctokit.repos.listLanguages.mockResolvedValue({ data: { TypeScript: 1000, JavaScript: 500 } });

      const result = await service.getRepository('owner', 'test-repo');

      expect(result).toBeDefined();
      expect(result?.name).toBe('test-repo');
      expect(result?.stars).toBe(100);
      expect(result?.languages).toEqual({ TypeScript: 1000, JavaScript: 500 });
    });
  });

  describe('getReleases', () => {
    it('should fetch repository releases', async () => {
      const mockReleases = [
        {
          id: 1,
          tag_name: 'v1.0.0',
          name: 'First Release',
          prerelease: false,
          draft: false,
          published_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockOctokit.repos.listReleases.mockResolvedValue({ data: mockReleases });

      const result = await service.getReleases('owner', 'test-repo');

      expect(result).toHaveLength(1);
      expect(result[0].tagName).toBe('v1.0.0');
      expect(result[0].prerelease).toBe(false);
    });
  });

  describe('checkDependencies', () => {
    it('should detect dependency changes', async () => {
      const mockPackageJson = {
        dependencies: {
          react: '^18.0.0',
          'new-package': '^1.0.0'
        },
        devDependencies: {
          jest: '^29.0.0'
        }
      };

      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          content: Buffer.from(JSON.stringify(mockPackageJson)).toString('base64')
        }
      });

      const result = await service.checkDependencies('owner', 'test-repo');

      expect(result.packageJson).toBeDefined();
      expect(result.dependenciesChanged).toBe(false); // Pas de version précédente
    });
  });
});
```

---

## Architecture

### Composants

1. **GitHubMonitoringService**: Service principal de monitoring
2. **Octokit Client**: Client GitHub API avec rate limiting
3. **Webhooks Handler**: Gestion des événements webhook
4. **Database Layer**: Stockage des stats et événements
5. **Notification Service**: Envoi des alertes

### Flux de Monitoring

```
Schedule/Trigger → API GitHub → Data Processing → Storage → Notifications
```

---

## Performance

### Optimisations

- **Rate Limiting**: Gestion intelligente des limites d'API
- **Batch Processing**: Traitement par lots des requêtes
- **Caching**: Cache Redis pour les données récentes
- **Async Processing**: File d'attente pour les tâches lourdes

### Métriques Cibles

- **API Response**: < 2 secondes pour la plupart des requêtes
- **Webhook Processing**: < 500ms par événement
- **Full Repository Scan**: < 30 secondes
- **Error Rate**: < 1% des requêtes

---

## Monitoring

### Métriques

- `github.api.requests_total`: Nombre de requêtes API
- `github.api.rate_limit_remaining`: Rate limit restant
- `github.releases.detected`: Releases détectées
- `github.webhooks.processed`: Webhooks traités
- `github.errors.count`: Erreurs de monitoring

---

## Livrables

1. **GitHubMonitoringService**: Service complet
2. **Database Schema**: Tables de monitoring
3. **Webhook Handler**: Gestion des événements
4. **Notification System**: Alertes configurables
5. **Monitoring Dashboard**: Stats et métriques

---

## Critères de Succès

- [ ] Monitoring GitHub fonctionnel
- [ ] Détection des releases < 5min
- [ ] Webhooks traités en temps réel
- [ ] Notifications fiables
- [ ] Tests avec couverture > 90%
- [ ] Documentation complète

---

## Suivi

### Post-Implémentation

1. **Performance Monitoring**: Surveillance des temps de réponse
2. **Error Tracking**: Suivi des erreurs d'API
3. **Notification Optimization**: Ajustement des alertes
4. **Coverage Expansion**: Ajout de nouveaux repositories
