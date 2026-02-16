import { NPMGitHubPopulatorService } from '../../src/services/library/npm-github-populator.service'

describe('NPMGitHubPopulatorService', () => {
  let service: NPMGitHubPopulatorService

  // Mock fetch that returns realistic NPM/GitHub responses
  function createMockFetch(responses: Record<string, any> = {}) {
    const defaultNPM = {
      name: 'lodash',
      description: 'Lodash modular utilities',
      'dist-tags': { latest: '4.17.21' },
      versions: {
        '4.17.21': {
          dependencies: {},
          devDependencies: { jest: '^29.0.0' },
        },
      },
      keywords: ['utility', 'modules'],
      license: 'MIT',
      homepage: 'https://lodash.com',
      repository: { type: 'git', url: 'https://github.com/lodash/lodash.git' },
      author: { name: 'John-David Dalton' },
      maintainers: [{ name: 'jdalton' }],
      time: { '4.17.21': '2021-02-20T00:00:00Z' },
    }

    const defaultDownloads = { downloads: 50000000 }

    const defaultGitHub = {
      full_name: 'lodash/lodash',
      description: 'A modern JavaScript utility library',
      stargazers_count: 58000,
      forks_count: 7000,
      open_issues_count: 100,
      watchers_count: 58000,
      language: 'JavaScript',
      license: { spdx_id: 'MIT' },
      pushed_at: '2024-01-15T00:00:00Z',
      default_branch: 'main',
      topics: ['javascript', 'utility'],
      archived: false,
    }

    return async (url: string) => {
      if (responses[url]) {
        return { ok: true, json: async () => responses[url], status: 200 }
      }
      if (url.includes('registry.npmjs.org')) {
        return { ok: true, json: async () => defaultNPM, status: 200 }
      }
      if (url.includes('api.npmjs.org/downloads')) {
        return { ok: true, json: async () => defaultDownloads, status: 200 }
      }
      if (url.includes('api.github.com/repos')) {
        return { ok: true, json: async () => defaultGitHub, status: 200 }
      }
      return { ok: false, json: async () => ({}), status: 404 }
    }
  }

  beforeEach(() => {
    service = new NPMGitHubPopulatorService()
    service.setFetchFunction(createMockFetch())
  })

  afterEach(() => {
    service.destroy()
  })

  describe('NPM fetch', () => {
    it('fetches package info from NPM', async () => {
      const info = await service.fetchNPMPackage('lodash')
      expect(info).not.toBeNull()
      expect(info!.name).toBe('lodash')
      expect(info!.version).toBe('4.17.21')
      expect(info!.license).toBe('MIT')
      expect(info!.weeklyDownloads).toBe(50000000)
    })

    it('returns null for failed fetch', async () => {
      service.setFetchFunction(async () => ({ ok: false, json: async () => ({}), status: 404 }))
      const info = await service.fetchNPMPackage('nonexistent')
      expect(info).toBeNull()
    })
  })

  describe('GitHub fetch', () => {
    it('fetches repo info from GitHub', async () => {
      const info = await service.fetchGitHubRepo('lodash', 'lodash')
      expect(info).not.toBeNull()
      expect(info!.stars).toBe(58000)
      expect(info!.language).toBe('JavaScript')
    })

    it('returns null for failed fetch', async () => {
      service.setFetchFunction(async () => ({ ok: false, json: async () => ({}), status: 404 }))
      const info = await service.fetchGitHubRepo('unknown', 'unknown')
      expect(info).toBeNull()
    })
  })

  describe('parseGitHubUrl', () => {
    it('parses HTTPS URL', () => {
      const result = service.parseGitHubUrl('https://github.com/lodash/lodash.git')
      expect(result).toEqual({ owner: 'lodash', repo: 'lodash' })
    })

    it('parses SSH URL', () => {
      const result = service.parseGitHubUrl('git@github.com:facebook/react.git')
      expect(result).toEqual({ owner: 'facebook', repo: 'react' })
    })

    it('parses short form', () => {
      const result = service.parseGitHubUrl('lodash/lodash')
      expect(result).toEqual({ owner: 'lodash', repo: 'lodash' })
    })

    it('returns null for invalid URL', () => {
      expect(service.parseGitHubUrl('not-a-url')).toBeNull()
    })
  })

  describe('Population', () => {
    it('populates a library from NPM + GitHub', async () => {
      const lib = await service.populateFromNPM('lodash')
      expect(lib).not.toBeNull()
      expect(lib!.name).toBe('lodash')
      expect(lib!.source).toBe('both')
      expect(lib!.npm).toBeDefined()
      expect(lib!.github).toBeDefined()
      expect(service.size).toBe(1)
    })

    it('populates NPM-only when no GitHub repo', async () => {
      service.setFetchFunction(async (url: string) => {
        if (url.includes('registry.npmjs.org')) {
          return {
            ok: true, status: 200,
            json: async () => ({
              name: 'no-repo', 'dist-tags': { latest: '1.0.0' },
              versions: { '1.0.0': {} }, description: 'No repo',
              keywords: [], license: 'ISC', maintainers: [], time: {},
            }),
          }
        }
        if (url.includes('api.npmjs.org')) {
          return { ok: true, status: 200, json: async () => ({ downloads: 100 }) }
        }
        return { ok: false, json: async () => ({}), status: 404 }
      })

      const lib = await service.populateFromNPM('no-repo')
      expect(lib).not.toBeNull()
      expect(lib!.source).toBe('npm')
      expect(lib!.github).toBeUndefined()
    })

    it('returns null for unknown package', async () => {
      service.setFetchFunction(async () => ({ ok: false, json: async () => ({}), status: 404 }))
      const lib = await service.populateFromNPM('nonexistent')
      expect(lib).toBeNull()
    })
  })

  describe('Batch population', () => {
    it('populates multiple packages', async () => {
      // Override fetch to return distinct names based on URL
      service.setFetchFunction(async (url: string) => {
        if (url.includes('registry.npmjs.org')) {
          const pkg = url.split('/').pop() || 'unknown'
          return {
            ok: true, status: 200,
            json: async () => ({
              name: pkg, 'dist-tags': { latest: '1.0.0' },
              versions: { '1.0.0': {} }, description: `${pkg} desc`,
              keywords: [], license: 'MIT', maintainers: [], time: {},
            }),
          }
        }
        if (url.includes('api.npmjs.org')) {
          return { ok: true, status: 200, json: async () => ({ downloads: 100 }) }
        }
        return { ok: false, json: async () => ({}), status: 404 }
      })

      const result = await service.populateBatch(['lodash', 'express'])
      expect(result.total).toBe(2)
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
      expect(service.size).toBe(2)
    })

    it('reports failures in batch', async () => {
      const callCount = { n: 0 }
      service.setFetchFunction(async (url: string) => {
        callCount.n++
        if (url.includes('bad-pkg')) return { ok: false, json: async () => ({}), status: 404 }
        if (url.includes('registry.npmjs.org')) {
          return {
            ok: true, status: 200,
            json: async () => ({
              name: 'good', 'dist-tags': { latest: '1.0.0' },
              versions: { '1.0.0': {} }, description: 'Good',
              keywords: [], license: 'MIT', maintainers: [], time: {},
            }),
          }
        }
        if (url.includes('api.npmjs.org')) {
          return { ok: true, status: 200, json: async () => ({ downloads: 0 }) }
        }
        return { ok: false, json: async () => ({}), status: 404 }
      })

      const result = await service.populateBatch(['good', 'bad-pkg'])
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors.length).toBe(1)
    })
  })

  describe('Metadata refresh', () => {
    it('refreshes all libraries', async () => {
      await service.populateFromNPM('lodash')
      expect(service.size).toBe(1)

      const result = await service.refreshAll()
      expect(result.succeeded).toBe(1)
    })

    it('refreshes a single library', async () => {
      await service.populateFromNPM('lodash')
      const refreshed = await service.refreshOne('npm:lodash')
      expect(refreshed).not.toBeNull()
      expect(refreshed!.name).toBe('lodash')
    })

    it('returns null for unknown library refresh', async () => {
      const result = await service.refreshOne('npm:unknown')
      expect(result).toBeNull()
    })
  })

  describe('Stale detection', () => {
    it('detects stale libraries', async () => {
      await service.populateFromNPM('lodash')
      // Just populated, should not be stale with 24h window
      expect(service.getStaleLibraries(24 * 60 * 60 * 1000).length).toBe(0)
      // Wait a tick so the timestamp is in the past relative to Date.now()
      await new Promise(r => setTimeout(r, 10))
      // With 1ms window, everything is stale
      expect(service.getStaleLibraries(1).length).toBe(1)
    })
  })
})
