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
    secret: process.env['GITHUB_WEBHOOK_SECRET'],
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
