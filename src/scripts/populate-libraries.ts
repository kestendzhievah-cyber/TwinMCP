import { Pool } from 'pg';
import { LibraryIndexService } from '../services/library-index.service';
import Redis from 'ioredis';
import { NpmPackageData, GitHubRepoData } from '../types/library.types';

const POPULAR_LIBRARIES = [
  'react', 'vue', 'angular', 'svelte', 'next', 'nuxt',
  'express', 'fastify', 'koa', 'hapi', 'nestjs',
  'lodash', 'axios', 'moment', 'dayjs', 'date-fns',
  'typescript', 'babel', 'webpack', 'vite', 'rollup',
  'jest', 'mocha', 'vitest', 'cypress', 'playwright',
  'eslint', 'prettier', 'husky', 'lint-staged',
  'react-router', 'redux', 'mobx', 'zustand', 'recoil',
  'mongoose', 'prisma', 'sequelize', 'typeorm',
  'passport', 'jsonwebtoken', 'bcrypt', 'argon2'
];

export class LibraryPopulator {
  constructor(
    private libraryIndexService: LibraryIndexService,
    private npmClient: any,
    private githubClient: any
  ) {}

  async populateInitialLibraries(): Promise<void> {
    console.log('Starting initial library population...');
    
    for (const libraryName of POPULAR_LIBRARIES) {
      try {
        await this.populateLibrary(libraryName);
        console.log(`✓ Populated ${libraryName}`);
      } catch (error) {
        console.error(`✗ Failed to populate ${libraryName}:`, error);
      }
    }
    
    console.log('Initial population completed');
  }

  private async populateLibrary(name: string): Promise<void> {
    // Récupération des données depuis NPM
    const npmData = await this.npmClient.getPackage(name);
    
    // Récupération des données depuis GitHub
    let githubData: any = null;
    if (npmData.repository?.url?.includes('github.com')) {
      const githubUrl = this.extractGithubUrl(npmData.repository.url);
      githubData = await this.githubClient.getRepo(githubUrl);
    }

    // Calcul des scores
    const qualityScore = this.calculateQualityScore(npmData, githubData);
    const popularityScore = this.calculatePopularityScore(npmData, githubData);
    const maintenanceScore = this.calculateMaintenanceScore(npmData, githubData);

    // Indexation
    await this.libraryIndexService.indexLibrary({
      name: npmData.name,
      displayName: npmData.name,
      description: npmData.description,
      githubUrl: githubData?.html_url,
      npmUrl: `https://www.npmjs.com/package/${npmData.name}`,
      homepageUrl: npmData.homepage,
      repositoryUrl: npmData.repository?.url,
      license: npmData.license,
      latestVersion: npmData['dist-tags']?.latest,
      totalDownloads: npmData.downloads || 0,
      weeklyDownloads: npmData.weeklyDownloads || 0,
      stars: githubData?.stargazers_count || 0,
      forks: githubData?.forks_count || 0,
      issues: githubData?.open_issues_count || 0,
      language: githubData?.language || 'JavaScript',
      status: this.determineStatus(npmData, githubData) as 'active' | 'deprecated' | 'archived',
      qualityScore,
      popularityScore,
      maintenanceScore,
      lastUpdatedAt: new Date(npmData.modified),
      lastCrawledAt: new Date()
    });
  }

  private extractGithubUrl(repositoryUrl: string): string {
    // Extraction du URL GitHub depuis various formats
    const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/\)]+)/);
    return match ? `${match[1]}/${match[2]}` : '';
  }

  private calculateQualityScore(npmData: NpmPackageData, githubData: GitHubRepoData | null): number {
    let score = 0;
    
    // Tests (25%)
    if (npmData.scripts?.['test']) score += 0.25;
    
    // Documentation (20%)
    if (npmData.readme || npmData.homepage) score += 0.20;
    
    // Build system (15%)
    if (npmData.scripts?.['build']) score += 0.15;
    
    // Linting (10%)
    if (npmData.devDependencies?.['eslint'] || npmData.devDependencies?.['prettier']) score += 0.10;
    
    // TypeScript support (15%)
    if (npmData.types || npmData.tsconfig) score += 0.15;
    
    // CI/CD (15%)
    if (githubData?.has_ci) score += 0.15;
    
    return Math.min(1, score);
  }

  private calculatePopularityScore(npmData: NpmPackageData, githubData: GitHubRepoData | null): number {
    const downloads = npmData.downloads || 0;
    const stars = githubData?.stargazers_count || 0;
    
    // Normalisation sur une échelle logarithmique
    const downloadScore = Math.log10(Math.max(1, downloads)) / 7; // Max ~10M downloads
    const starScore = Math.log10(Math.max(1, stars)) / 5; // Max ~100K stars
    
    return Math.min(1, (downloadScore + starScore) / 2);
  }

  private calculateMaintenanceScore(npmData: NpmPackageData, githubData: GitHubRepoData | null): number {
    let score = 0.5; // Base score
    
    // Recent activity (30%)
    const lastUpdate = new Date(npmData.modified || '');
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < 30) score += 0.30;
    else if (daysSinceUpdate < 90) score += 0.20;
    else if (daysSinceUpdate < 365) score += 0.10;
    
    // Open issues (20%)
    const openIssues = githubData?.open_issues_count || 0;
    if (openIssues < 10) score += 0.20;
    else if (openIssues < 50) score += 0.10;
    
    // Contributors (20%)
    const contributors = githubData?.contributors_count || 0;
    if (contributors > 10) score += 0.20;
    else if (contributors > 3) score += 0.10;
    
    // License (10%)
    if (npmData.license) score += 0.10;
    
    return Math.min(1, score);
  }

  private determineStatus(npmData: NpmPackageData, githubData: GitHubRepoData | null): string {
    if (npmData.deprecated) return 'deprecated';
    if (githubData?.archived) return 'archived';
    return 'active';
  }
}

// Simple NPM client implementation
class SimpleNpmClient {
  async getPackage(name: string): Promise<NpmPackageData> {
    const response = await fetch(`https://registry.npmjs.org/${name}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch package ${name}: ${response.statusText}`);
    }
    return response.json();
  }
}

// Simple GitHub client implementation
class SimpleGitHubClient {
  private token?: string;

  constructor(token?: string | undefined) {
    this.token = token;
  }

  async getRepo(repoPath: string): Promise<GitHubRepoData | null> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repoPath}`, { headers });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch repo ${repoPath}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check for CI/CD files
    const has_ci = await this.checkForCiFiles(repoPath);
    
    return {
      ...data,
      has_ci
    };
  }

  private async checkForCiFiles(repoPath: string): Promise<boolean> {
    const ciFiles = ['.github/workflows', '.travis.yml', '.gitlab-ci.yml', 'circle.yml'];
    
    for (const file of ciFiles) {
      try {
        const response = await fetch(`https://api.github.com/repos/${repoPath}/contents/${file}`);
        if (response.ok) return true;
      } catch {
        continue;
      }
    }
    
    return false;
  }
}

// Exécution
if (require.main === module) {
  const db = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');
  
  const libraryIndexService = new LibraryIndexService(db, redis);
  const populator = new LibraryPopulator(
    libraryIndexService,
    new SimpleNpmClient(),
    new SimpleGitHubClient(process.env['GITHUB_TOKEN'])
  );
  
  populator.populateInitialLibraries()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
