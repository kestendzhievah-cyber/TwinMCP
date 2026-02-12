import { GitHubMonitoringService } from '../src/services/github-monitoring.service';
import { MonitoringConfig } from '../src/types/github-monitoring.types';
import { Pool } from 'pg';
import Redis from 'ioredis';

describe('GitHubMonitoringService', () => {
  let service: GitHubMonitoringService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    } as any;

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      keys: jest.fn(),
      lrange: jest.fn(),
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
        open_issues_count: 10,
        html_url: 'https://github.com/owner/test-repo',
        clone_url: 'https://github.com/owner/test-repo.git',
        homepage: 'https://test-repo.com',
        language: 'TypeScript',
        default_branch: 'main',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        pushed_at: '2023-01-01T00:00:00Z',
        size: 1000,
        archived: false,
        disabled: false,
        owner: {
          login: 'owner',
          id: 67890,
          type: 'User'
        },
        license: {
          key: 'mit',
          name: 'MIT License',
          url: 'https://opensource.org/licenses/MIT'
        },
        topics: ['typescript', 'testing']
      };

      const mockLanguages = { TypeScript: 1000, JavaScript: 500 };

      // Mock Octokit responses
      const mockOctokit = {
        repos: {
          get: jest.fn().mockResolvedValue({ data: mockRepo }),
          listLanguages: jest.fn().mockResolvedValue({ data: mockLanguages })
        },
        rateLimit: {
          get: jest.fn().mockResolvedValue({
            data: {
              resources: {
                core: {
                  remaining: 5000,
                  reset: Date.now() / 1000 + 3600
                }
              }
            }
          })
        }
      };

      // Replace the service's octokit with mock
      (service as any).octokit = mockOctokit;

      const result = await service.getRepository('owner', 'test-repo');

      expect(result).toBeDefined();
      expect(result?.name).toBe('test-repo');
      expect(result?.fullName).toBe('owner/test-repo');
      expect(result?.stars).toBe(100);
      expect(result?.forks).toBe(50);
      expect(result?.homepage).toBe('https://test-repo.com');
      expect(result?.language).toBe('TypeScript');
      expect(result?.languages).toEqual(mockLanguages);
      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'test-repo'
      });
    });

    it('should return null when repository not found', async () => {
      const mockOctokit = {
        repos: {
          get: jest.fn().mockRejectedValue(new Error('Not Found')),
          rateLimit: {
            get: jest.fn().mockResolvedValue({
              data: {
                resources: {
                  core: { remaining: 5000, reset: Date.now() / 1000 + 3600 }
                }
              }
            })
          }
        }
      };

      (service as any).octokit = mockOctokit;

      const result = await service.getRepository('owner', 'nonexistent-repo');

      expect(result).toBeNull();
    });
  });

  describe('getReleases', () => {
    it('should fetch repository releases', async () => {
      const mockReleases = [
        {
          id: 1,
          tag_name: 'v1.0.0',
          name: 'First Release',
          body: 'Release notes for v1.0.0',
          prerelease: false,
          draft: false,
          published_at: '2023-01-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
          author: {
            login: 'owner',
            id: 67890
          },
          assets: []
        },
        {
          id: 2,
          tag_name: 'v1.1.0',
          name: 'Second Release',
          body: 'Release notes for v1.1.0',
          prerelease: true,
          draft: false,
          published_at: '2023-01-02T00:00:00Z',
          created_at: '2023-01-02T00:00:00Z',
          author: {
            login: 'owner',
            id: 67890
          },
          assets: []
        }
      ];

      const mockOctokit = {
        repos: {
          listReleases: jest.fn().mockResolvedValue({ data: mockReleases }),
          rateLimit: {
            get: jest.fn().mockResolvedValue({
              data: {
                resources: {
                  core: { remaining: 5000, reset: Date.now() / 1000 + 3600 }
                }
              }
            })
          }
        }
      };

      (service as any).octokit = mockOctokit;

      const result = await service.getReleases('owner', 'test-repo');

      expect(result).toHaveLength(2);
      expect(result[0].tagName).toBe('v1.0.0');
      expect(result[0].name).toBe('First Release');
      expect(result[0].prerelease).toBe(false);
      expect(result[1].tagName).toBe('v1.1.0');
      expect(result[1].prerelease).toBe(true);
      expect(mockOctokit.repos.listReleases).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'test-repo',
        per_page: 50
      });
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

      const mockPreviousPackageJson = {
        dependencies: {
          react: '^17.0.0',
          'old-package': '^1.0.0'
        },
        devDependencies: {
          jest: '^28.0.0'
        }
      };

      const mockOctokit = {
        repos: {
          getContent: jest.fn().mockResolvedValue({
            data: {
              type: 'file',
              content: Buffer.from(JSON.stringify(mockPackageJson)).toString('base64')
            }
          }),
          rateLimit: {
            get: jest.fn().mockResolvedValue({
              data: {
                resources: {
                  core: { remaining: 5000, reset: Date.now() / 1000 + 3600 }
                }
              }
            })
          }
        }
      };

      (service as any).octokit = mockOctokit;

      mockRedis.get.mockResolvedValue(JSON.stringify(mockPreviousPackageJson));

      const result = await service.checkDependencies('owner', 'test-repo');

      expect(result.packageJson).toEqual(mockPackageJson);
      expect(result.dependenciesChanged).toBe(true);
      expect(result.newDependencies).toContain('new-package');
      expect(result.removedDependencies).toContain('old-package');
      expect(result.updatedDependencies).toContainEqual({
        name: 'react',
        oldVersion: '^17.0.0',
        newVersion: '^18.0.0'
      });
      expect(result.updatedDependencies).toContainEqual({
        name: 'jest',
        oldVersion: '^28.0.0',
        newVersion: '^29.0.0'
      });
    });

    it('should handle no previous version', async () => {
      const mockPackageJson = {
        dependencies: {
          react: '^18.0.0'
        }
      };

      const mockOctokit = {
        repos: {
          getContent: jest.fn().mockResolvedValue({
            data: {
              type: 'file',
              content: Buffer.from(JSON.stringify(mockPackageJson)).toString('base64')
            }
          }),
          rateLimit: {
            get: jest.fn().mockResolvedValue({
              data: {
                resources: {
                  core: { remaining: 5000, reset: Date.now() / 1000 + 3600 }
                }
              }
            })
          }
        }
      };

      (service as any).octokit = mockOctokit;

      mockRedis.get.mockResolvedValue(null);

      const result = await service.checkDependencies('owner', 'test-repo');

      expect(result.packageJson).toEqual(mockPackageJson);
      expect(result.dependenciesChanged).toBe(false);
      expect(result.newDependencies).toHaveLength(0);
      expect(result.removedDependencies).toHaveLength(0);
      expect(result.updatedDependencies).toHaveLength(0);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when rate limit is high', async () => {
      const mockOctokit = {
        rateLimit: {
          get: jest.fn().mockResolvedValue({
            data: {
              resources: {
                core: {
                  remaining: 4000,
                  reset: Date.now() / 1000 + 3600
                }
              }
            }
          })
        }
      };

      mockDb.query.mockResolvedValue({
        rows: [{ count: '5' }]
      });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.keys.mockResolvedValue([]);

      (service as any).octokit = mockOctokit;

      const result = await service.healthCheck();

      expect(result.apiStatus).toBe('healthy');
      expect(result.rateLimitRemaining).toBe(4000);
      expect(result.activeRepositories).toBe(5);
      expect(result.errorCount).toBe(0);
      expect(result.lastWebhookReceived).toBeUndefined();
    });

    it('should return degraded status when rate limit is medium', async () => {
      const mockOctokit = {
        rateLimit: {
          get: jest.fn().mockResolvedValue({
            data: {
              resources: {
                core: {
                  remaining: 50,
                  reset: Date.now() / 1000 + 3600
                }
              }
            }
          })
        }
      };

      mockDb.query.mockResolvedValue({
        rows: [{ count: '3' }]
      });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.keys.mockResolvedValue([]);

      (service as any).octokit = mockOctokit;

      const result = await service.healthCheck();

      expect(result.apiStatus).toBe('degraded');
      expect(result.rateLimitRemaining).toBe(50);
    });

    it('should return unhealthy status when rate limit is low', async () => {
      const mockOctokit = {
        rateLimit: {
          get: jest.fn().mockResolvedValue({
            data: {
              resources: {
                core: {
                  remaining: 5,
                  reset: Date.now() / 1000 + 3600
                }
              }
            }
          })
        }
      };

      mockDb.query.mockResolvedValue({
        rows: [{ count: '2' }]
      });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.keys.mockResolvedValue([]);

      (service as any).octokit = mockOctokit;

      const result = await service.healthCheck();

      expect(result.apiStatus).toBe('unhealthy');
      expect(result.rateLimitRemaining).toBe(5);
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring for a repository', async () => {
      const config: MonitoringConfig = {
        repository: {
          owner: 'owner',
          name: 'test-repo'
        },
        monitoring: {
          releases: true,
          commits: false,
          issues: false,
          stars: false,
          forks: false,
          dependencies: false
        },
        notifications: {},
        schedule: {
          frequency: 'daily',
          timezone: 'UTC'
        }
      };

      const mockRepo = {
        id: 12345,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        description: 'Test repository',
        stargazers_count: 100,
        forks_count: 50,
        open_issues_count: 10,
        html_url: 'https://github.com/owner/test-repo',
        clone_url: 'https://github.com/owner/test-repo.git',
        language: 'TypeScript',
        default_branch: 'main',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        pushed_at: '2023-01-01T00:00:00Z',
        size: 1000,
        archived: false,
        disabled: false,
        owner: {
          login: 'owner',
          id: 67890,
          type: 'User'
        },
        license: null,
        topics: []
      };

      const mockOctokit = {
        repos: {
          get: jest.fn().mockResolvedValue({ data: mockRepo }),
          listLanguages: jest.fn().mockResolvedValue({ data: {} }),
          listReleases: jest.fn().mockResolvedValue({ data: [] }),
          listCommits: jest.fn().mockResolvedValue({ data: [] }),
          getContent: jest.fn().mockResolvedValue({
            data: { type: 'dir' }
          }),
          rateLimit: {
            get: jest.fn().mockResolvedValue({
              data: {
                resources: {
                  core: { remaining: 5000, reset: Date.now() / 1000 + 3600 }
                }
              }
            })
          }
        }
      };

      (service as any).octokit = mockOctokit;

      await service.startMonitoring(config);

      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'test-repo'
      });
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should throw error when repository not found', async () => {
      const config: MonitoringConfig = {
        repository: {
          owner: 'owner',
          name: 'nonexistent-repo'
        },
        monitoring: {
          releases: true,
          commits: false,
          issues: false,
          stars: false,
          forks: false,
          dependencies: false
        },
        notifications: {},
        schedule: {
          frequency: 'daily',
          timezone: 'UTC'
        }
      };

      const mockOctokit = {
        repos: {
          get: jest.fn().mockRejectedValue(new Error('Not Found')),
          rateLimit: {
            get: jest.fn().mockResolvedValue({
              data: {
                resources: {
                  core: { remaining: 5000, reset: Date.now() / 1000 + 3600 }
                }
              }
            })
          }
        }
      };

      (service as any).octokit = mockOctokit;

      await expect(service.startMonitoring(config)).rejects.toThrow(
        'Repository owner/nonexistent-repo not found'
      );
    });
  });
});
