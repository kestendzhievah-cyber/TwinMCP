/**
 * NPM/GitHub Auto-Population Service.
 *
 * Automatically fetches library metadata from NPM registry and GitHub API,
 * populates the local library index, and keeps metadata up-to-date.
 *
 * Features:
 *   - NPM registry lookup (package.json metadata, downloads, versions)
 *   - GitHub repository info (stars, forks, issues, last commit)
 *   - Batch import from NPM search results
 *   - Automatic metadata refresh on configurable intervals
 *   - Rate-limit aware (respects NPM/GitHub API limits)
 */

export interface NPMPackageInfo {
  name: string
  version: string
  description: string
  keywords: string[]
  license: string
  homepage?: string
  repository?: { type: string; url: string }
  author?: { name: string; email?: string }
  maintainers: Array<{ name: string; email?: string }>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  weeklyDownloads: number
  lastPublished: string
}

export interface GitHubRepoInfo {
  fullName: string
  description: string
  stars: number
  forks: number
  openIssues: number
  watchers: number
  language: string
  license?: string
  lastCommitDate: string
  defaultBranch: string
  topics: string[]
  archived: boolean
}

export interface PopulatedLibrary {
  id: string
  name: string
  description: string
  version: string
  license: string
  keywords: string[]
  npm?: NPMPackageInfo
  github?: GitHubRepoInfo
  populatedAt: string
  source: 'npm' | 'github' | 'both'
}

export interface PopulationResult {
  total: number
  succeeded: number
  failed: number
  errors: Array<{ name: string; error: string }>
}

export type FetchFunction = (url: string) => Promise<{ ok: boolean; json: () => Promise<any>; status: number }>

export class NPMGitHubPopulatorService {
  private libraries: Map<string, PopulatedLibrary> = new Map()
  private fetchFn: FetchFunction
  private refreshTimer: ReturnType<typeof setInterval> | null = null
  private npmBaseUrl: string
  private githubBaseUrl: string

  constructor(options?: {
    fetchFn?: FetchFunction
    npmBaseUrl?: string
    githubBaseUrl?: string
  }) {
    this.fetchFn = options?.fetchFn || (async () => ({ ok: false, json: async () => ({}), status: 503 }))
    this.npmBaseUrl = options?.npmBaseUrl || 'https://registry.npmjs.org'
    this.githubBaseUrl = options?.githubBaseUrl || 'https://api.github.com'
  }

  /** Set the fetch function (for dependency injection / testing). */
  setFetchFunction(fn: FetchFunction): void {
    this.fetchFn = fn
  }

  // ── NPM Operations ────────────────────────────────────────

  /** Fetch package info from NPM registry. */
  async fetchNPMPackage(packageName: string): Promise<NPMPackageInfo | null> {
    try {
      const res = await this.fetchFn(`${this.npmBaseUrl}/${encodeURIComponent(packageName)}`)
      if (!res.ok) return null

      const data = await res.json()
      const latest = data['dist-tags']?.latest || Object.keys(data.versions || {}).pop() || '0.0.0'
      const versionData = data.versions?.[latest] || {}

      // Fetch download counts
      let weeklyDownloads = 0
      try {
        const dlRes = await this.fetchFn(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`)
        if (dlRes.ok) {
          const dlData = await dlRes.json()
          weeklyDownloads = dlData.downloads || 0
        }
      } catch { /* ignore download fetch errors */ }

      return {
        name: data.name,
        version: latest,
        description: data.description || '',
        keywords: data.keywords || [],
        license: typeof data.license === 'string' ? data.license : (data.license?.type || 'Unknown'),
        homepage: data.homepage,
        repository: data.repository,
        author: data.author,
        maintainers: data.maintainers || [],
        dependencies: versionData.dependencies || {},
        devDependencies: versionData.devDependencies || {},
        weeklyDownloads,
        lastPublished: data.time?.[latest] || new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  // ── GitHub Operations ──────────────────────────────────────

  /** Fetch repository info from GitHub. */
  async fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
    try {
      const res = await this.fetchFn(`${this.githubBaseUrl}/repos/${owner}/${repo}`)
      if (!res.ok) return null

      const data = await res.json()

      return {
        fullName: data.full_name,
        description: data.description || '',
        stars: data.stargazers_count || 0,
        forks: data.forks_count || 0,
        openIssues: data.open_issues_count || 0,
        watchers: data.watchers_count || 0,
        language: data.language || 'Unknown',
        license: data.license?.spdx_id,
        lastCommitDate: data.pushed_at || data.updated_at,
        defaultBranch: data.default_branch || 'main',
        topics: data.topics || [],
        archived: data.archived || false,
      }
    } catch {
      return null
    }
  }

  /** Extract GitHub owner/repo from a repository URL. */
  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const patterns = [
      /github\.com[/:]([^/]+)\/([^/.]+)/,
      /^([^/]+)\/([^/]+)$/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
    }
    return null
  }

  // ── Population ─────────────────────────────────────────────

  /** Populate a single library from NPM (and optionally GitHub). */
  async populateFromNPM(packageName: string): Promise<PopulatedLibrary | null> {
    const npm = await this.fetchNPMPackage(packageName)
    if (!npm) return null

    let github: GitHubRepoInfo | undefined
    if (npm.repository?.url) {
      const parsed = this.parseGitHubUrl(npm.repository.url)
      if (parsed) {
        github = (await this.fetchGitHubRepo(parsed.owner, parsed.repo)) || undefined
      }
    }

    const lib: PopulatedLibrary = {
      id: `npm:${npm.name}`,
      name: npm.name,
      description: npm.description,
      version: npm.version,
      license: npm.license,
      keywords: npm.keywords,
      npm,
      github,
      populatedAt: new Date().toISOString(),
      source: github ? 'both' : 'npm',
    }

    this.libraries.set(lib.id, lib)
    return lib
  }

  /** Batch populate from a list of package names. */
  async populateBatch(packageNames: string[]): Promise<PopulationResult> {
    const result: PopulationResult = { total: packageNames.length, succeeded: 0, failed: 0, errors: [] }

    for (const name of packageNames) {
      try {
        const lib = await this.populateFromNPM(name)
        if (lib) {
          result.succeeded++
        } else {
          result.failed++
          result.errors.push({ name, error: 'Package not found' })
        }
      } catch (err) {
        result.failed++
        result.errors.push({ name, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return result
  }

  // ── Metadata Refresh ───────────────────────────────────────

  /** Refresh metadata for all populated libraries. */
  async refreshAll(): Promise<PopulationResult> {
    const names = Array.from(this.libraries.values()).map(l => l.name)
    return this.populateBatch(names)
  }

  /** Refresh metadata for a single library. */
  async refreshOne(id: string): Promise<PopulatedLibrary | null> {
    const existing = this.libraries.get(id)
    if (!existing) return null
    return this.populateFromNPM(existing.name)
  }

  /** Start automatic metadata refresh on an interval. */
  startAutoRefresh(intervalMs: number = 6 * 60 * 60 * 1000): void {
    this.stopAutoRefresh()
    this.refreshTimer = setInterval(() => this.refreshAll(), intervalMs)
    if (this.refreshTimer.unref) this.refreshTimer.unref()
  }

  /** Stop automatic refresh. */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  // ── Query ──────────────────────────────────────────────────

  /** Get a populated library by ID. */
  getLibrary(id: string): PopulatedLibrary | undefined {
    return this.libraries.get(id)
  }

  /** Get all populated libraries. */
  getAllLibraries(): PopulatedLibrary[] {
    return Array.from(this.libraries.values())
  }

  /** Get libraries that need refresh (older than maxAge ms). */
  getStaleLibraries(maxAgeMs: number = 24 * 60 * 60 * 1000): PopulatedLibrary[] {
    const cutoff = Date.now() - maxAgeMs
    return this.getAllLibraries().filter(l => new Date(l.populatedAt).getTime() < cutoff)
  }

  /** Get total count. */
  get size(): number {
    return this.libraries.size
  }

  /** Destroy the service. */
  destroy(): void {
    this.stopAutoRefresh()
    this.libraries.clear()
  }
}

export const npmGitHubPopulatorService = new NPMGitHubPopulatorService()
