import { logger } from '../utils/logger';
import { Octokit } from '@octokit/rest';
import { Webhooks } from '@octokit/webhooks';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { 
  GitHubRepository, 
  GitHubRelease, 
  GitHubCommit, 
  GitHubWebhookEvent,
  MonitoringConfig,
  MonitoringStats,
  DependencyChanges,
  WebhookProcessingResult,
  MonitoringHealthCheck
} from '../types/github-monitoring.types';
import { GITHUB_MONITORING_CONFIG } from '../config/github-monitoring.config';

export class GitHubMonitoringService {
  private octokit: Octokit;
  // TODO: Implement webhooks usage
  // private webhooks?: Webhooks;
  // private rateLimitTracker: Map<string, number[]> = new Map(); // TODO: Implement rate limiting tracking

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
        onRateLimit: (retryAfter: number, _options: any) => {
          logger.warn(`Rate limit exceeded, retrying after ${retryAfter} seconds`);
          return true;
        },
        onAbuseLimit: () => {
          logger.warn('Abuse limit detected');
          return false;
        }
      }
    });

    // TODO: Implement webhooks usage when needed
    // if (this.config.webhookSecret) {
    //   this.webhooks = new Webhooks({
    //     secret: this.config.webhookSecret
    //   });
    // }
  }

  async startMonitoring(config: MonitoringConfig): Promise<void> {
    logger.info(`Starting monitoring for ${config.repository.owner}/${config.repository.name}`);

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
        repo: name
      });

      const repo = response.data;
      
      // Récupération des langages utilisés
      const languagesResponse = await this.octokit.repos.listLanguages({
        owner,
        repo: name
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
        ...(repo.homepage && { homepage: repo.homepage }),
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
        ...(repo.license && { 
          license: {
            key: repo.license.key,
            name: repo.license.name,
            url: repo.license.url || ''
          }
        }),
        topics: repo.topics || []
      } as GitHubRepository;
    } catch (error) {
      logger.error(`Error fetching repository ${owner}/${name}:`, error);
      return null;
    }
  }

  async getReleases(owner: string, name: string, limit: number = 50): Promise<GitHubRelease[]> {
    try {
      await this.checkRateLimit();
      
      const response = await this.octokit.repos.listReleases({
        owner,
        repo: name,
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
        publishedAt: new Date(release.published_at || release.created_at),
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
      logger.error(`Error fetching releases for ${owner}/${name}:`, error);
      return [];
    }
  }

  async getRecentCommits(owner: string, name: string, branch?: string, limit: number = 100): Promise<GitHubCommit[]> {
    try {
      await this.checkRateLimit();
      
      const response = await this.octokit.repos.listCommits({
        owner,
        repo: name,
        ...(branch && { sha: branch }),
        per_page: limit
      });

      const commits: GitHubCommit[] = [];

      for (const commit of response.data) {
        try {
          const detailedCommit = await this.octokit.repos.getCommit({
            owner,
            repo: name,
            ref: commit.sha
          });

          commits.push({
            sha: commit.sha,
            message: commit.commit.message || '',
            author: {
              name: commit.commit.author?.name || '',
              email: commit.commit.author?.email || '',
              date: new Date(commit.commit.author?.date || Date.now())
            },
            url: commit.html_url,
            additions: detailedCommit.data.stats?.additions || 0,
            deletions: detailedCommit.data.stats?.deletions || 0,
            changed: detailedCommit.data.stats?.total || 0,
            files: detailedCommit.data.files?.map(file => ({
              filename: file.filename,
              additions: file.additions || 0,
              deletions: file.deletions || 0,
              changes: file.changes || 0,
              patch: file.patch || '',
              status: file.status as any
            })) || []
          });
        } catch (error) {
          // Si on ne peut pas récupérer les détails, on utilise les infos de base
          commits.push({
            sha: commit.sha,
            message: commit.commit.message || '',
            author: {
              name: commit.commit.author?.name || '',
              email: commit.commit.author?.email || '',
              date: new Date(commit.commit.author?.date || Date.now())
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
      logger.error(`Error fetching commits for ${owner}/${name}:`, error);
      return [];
    }
  }

  async checkDependencies(owner: string, name: string, branch?: string): Promise<DependencyChanges> {
    try {
      await this.checkRateLimit();
      
      // Récupération du package.json
      const packageJsonResponse = await this.octokit.repos.getContent({
        owner,
        repo: name,
        path: 'package.json',
        ...(branch && { ref: branch })
      });

      if (Array.isArray(packageJsonResponse.data) || packageJsonResponse.data.type !== 'file') {
        return { dependenciesChanged: false, newDependencies: [], removedDependencies: [], updatedDependencies: [] };
      }

      const content = Buffer.from((packageJsonResponse.data as any).content, 'base64').toString();
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
          updatedDependencies.push({ name: dep, oldVersion: String(previousDeps[dep]), newVersion: String(version) });
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
      logger.error(`Error checking dependencies for ${owner}/${name}:`, error);
      return { dependenciesChanged: false, newDependencies: [], removedDependencies: [], updatedDependencies: [] };
    }
  }

  async healthCheck(): Promise<MonitoringHealthCheck> {
    try {
      const rateLimit = await this.octokit.rateLimit.get();
      const remaining = rateLimit.data.resources.core.remaining;
      const reset = new Date(rateLimit.data.resources.core.reset * 1000);

      // Compter les repositories actifs
      const activeReposResult = await this.db.query(
        'SELECT COUNT(*) as count FROM monitored_repositories WHERE is_active = true'
      );
      const activeRepositories = parseInt(activeReposResult.rows[0]?.count || '0', 10);

      // Dernier webhook reçu
      const lastWebhookResult = await this.redis.get('webhook:last_received');
      const lastWebhookReceived = lastWebhookResult ? new Date(lastWebhookResult) : undefined;

      // Compter les erreurs récentes
      const errorCount = await this.getRecentErrorCount();

      return {
        apiStatus: remaining > 100 ? 'healthy' : remaining > 10 ? 'degraded' : 'unhealthy',
        rateLimitRemaining: remaining,
        rateLimitReset: reset,
        activeRepositories,
        ...(lastWebhookReceived && { lastWebhookReceived }),
        errorCount
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        apiStatus: 'unhealthy',
        rateLimitRemaining: 0,
        rateLimitReset: new Date(),
        activeRepositories: 0,
        errorCount: 1
      };
    }
  }

  private async setupWebhooks(repository: GitHubRepository, config: MonitoringConfig): Promise<void> {
    try {
      // Vérification si le webhook existe déjà
      const existingWebhooks = await this.octokit.repos.listWebhooks({
        owner: repository.owner.login,
        repo: repository.name
      });

      const webhookUrl = process.env['GITHUB_WEBHOOK_URL'];
      if (!webhookUrl) {
        logger.warn('GitHub webhook URL not configured, skipping webhook setup');
        return;
      }

      const existingWebhook = existingWebhooks.data.find(webhook => 
        webhook.config.url === webhookUrl
      );

      if (!existingWebhook) {
        // Création du webhook
        await this.octokit.repos.createWebhook({
          owner: repository.owner.login,
          repo: repository.name,
          name: 'web',
          active: true,
          events: config.schedule.frequency === 'realtime' ? ['push', 'release', 'issues'] : ['release'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            ...(this.config.webhookSecret && { secret: this.config.webhookSecret }),
            insecure_ssl: 0
          }
        });

        logger.info(`Webhook created for ${repository.fullName}`);
      }
    } catch (error) {
      logger.error(`Error setting up webhooks for ${repository.fullName}:`, error);
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
    logger.info(`Performing full scan for ${owner}/${name}`);

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

      logger.info(`Scan completed for ${owner}/${name}:`, stats);

    } catch (error) {
      logger.error(`Error during full scan for ${owner}/${name}:`, error);
      await this.logMonitoringError(config.repository.owner, config.repository.name, (error as Error).message);
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
      if (latestRelease) {
        await this.redis.set(lastReleaseKey, latestRelease.publishedAt.toISOString());
      }

      // Notification des nouvelles releases
      await this.notifyNewReleases(owner, name, newReleases);
    }
  }

  private async notifyNewReleases(owner: string, name: string, releases: GitHubRelease[]): Promise<void> {
    // Implémentation des notifications (Slack, email, webhook)
    for (const release of releases) {
      logger.info(`New release for ${owner}/${name}: ${release.tagName}`);
      
      // Envoi des notifications selon la configuration
      // TODO: Implémenter les différents canaux de notification
    }
  }

  private async notifyDependencyChanges(config: MonitoringConfig, changes: DependencyChanges): Promise<void> {
    logger.info(`Dependency changes detected for ${config.repository.owner}/${config.repository.name}:`, changes);
    
    // TODO: Implémenter les notifications de changements de dépendances
  }

  private async saveMonitoringStats(owner: string, name: string, stats: MonitoringStats): Promise<void> {
    const key = `monitoring:stats:${owner}/${name}`;
    await this.redis.setex(key, 86400, JSON.stringify(stats)); // TTL 24h

    // Sauvegarde en base pour l'historique
    await this.db.query(`
      INSERT INTO monitoring_stats (
        repository_owner, repository_name, stats, recorded_at
      ) VALUES ($1, $2, $3, NOW())
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

  private async getRecentErrorCount(): Promise<number> {
    const keys = await this.redis.keys('monitoring:errors:*');
    let totalErrors = 0;
    
    for (const key of keys) {
      const errors = await this.redis.lrange(key, 0, -1);
      totalErrors += errors.length;
    }
    
    return totalErrors;
  }

  private async checkRateLimit(): Promise<void> {
    try {
      const rateLimit = await this.octokit.rateLimit.get();
      const remaining = rateLimit.data.resources.core.remaining;
      const reset = new Date(rateLimit.data.resources.core.reset * 1000);

      if (remaining < 100) {
        const waitTime = reset.getTime() - Date.now() + 60000; // +1min de buffer
        logger.warn(`Rate limit low (${remaining} remaining), waiting ${waitTime}ms`);
        await this.delay(waitTime);
      }
    } catch (error) {
      logger.error('Error checking rate limit:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Méthodes pour les webhooks
  async handleWebhookEvent(event: GitHubWebhookEvent): Promise<WebhookProcessingResult> {
    logger.info(`Processing webhook event: ${event.type} for ${event.repository.fullName}`);

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
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      // Marquer l'événement comme traité
      await this.markWebhookEventProcessed(event.id);
      
      return {
        success: true,
        eventId: event.id,
        processedAt: new Date()
      };

    } catch (error) {
      logger.error(`Error processing webhook event ${event.id}:`, error);
      return {
        success: false,
        eventId: event.id,
        error: (error as Error).message,
        processedAt: new Date()
      };
    }
  }

  private async handleReleaseEvent(event: GitHubWebhookEvent): Promise<void> {
    const release = event.payload.release;
    logger.info(`New release: ${release.tag_name} for ${event.repository.fullName}`);
    
    // Traitement de la release
    await this.processNewRelease(event.repository, release);
  }

  private async handlePushEvent(event: GitHubWebhookEvent): Promise<void> {
    const push = event.payload;
    const branch = push.ref.replace('refs/heads/', '');
    
    logger.info(`New push to ${branch} in ${event.repository.fullName}`);
    
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
          monitoring: { dependencies: true, releases: false, commits: false, issues: false, stars: false, forks: false },
          notifications: {},
          schedule: { frequency: 'realtime', timezone: 'UTC' }
        }, depChanges);
      }
    }
  }

  private async handleIssuesEvent(event: GitHubWebhookEvent): Promise<void> {
    const issue = event.payload.issue;
    const action = event.payload.action;
    
    logger.info(`Issue ${action}: #${issue.number} in ${event.repository.fullName}`);
    
    // Traitement des événements d'issues
  }

  private async processNewRelease(_repository: GitHubRepository, _release: any): Promise<void> {
    // Implémentation du traitement des nouvelles releases
    // Indexation de la documentation, mise à jour de la base, etc.
    logger.info('Processing new release...');
  }

  private async markWebhookEventProcessed(eventId: string): Promise<void> {
    await this.redis.setex(`webhook:processed:${eventId}`, 86400, 'true');
    await this.redis.set('webhook:last_received', new Date().toISOString());
  }
}
