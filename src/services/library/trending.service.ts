/**
 * Trending Libraries Service.
 *
 * Tracks library popularity over time and computes trending scores
 * based on download velocity, search frequency, and recent activity.
 *
 * Works in-memory for testability; production would back this with DB queries.
 */

export interface LibraryStats {
  id: string
  name: string
  description?: string
  weeklyDownloads: number
  previousWeekDownloads: number
  monthlyDownloads: number
  stars: number
  searchCount: number
  lastUpdated: string
  tags: string[]
}

export interface TrendingResult {
  library: LibraryStats
  trendingScore: number
  velocity: number
  reason: string
}

export interface ComparisonResult {
  libraries: LibraryStats[]
  dimensions: {
    popularity: Record<string, number>
    growth: Record<string, number>
    activity: Record<string, number>
    overall: Record<string, number>
  }
  recommendation?: string
}

export class TrendingService {
  private libraries: Map<string, LibraryStats> = new Map()

  /** Register or update a library's stats. */
  upsertLibrary(stats: LibraryStats): void {
    this.libraries.set(stats.id, stats)
  }

  /** Get a library by ID. */
  getLibrary(id: string): LibraryStats | undefined {
    return this.libraries.get(id)
  }

  /** Get all libraries. */
  getAllLibraries(): LibraryStats[] {
    return Array.from(this.libraries.values())
  }

  /**
   * Compute trending libraries ranked by trending score.
   * Score = download velocity * search boost * recency factor.
   */
  getTrending(limit: number = 10): TrendingResult[] {
    const results: TrendingResult[] = []

    for (const lib of this.libraries.values()) {
      const velocity = this.computeVelocity(lib)
      const searchBoost = Math.log2(Math.max(lib.searchCount, 1) + 1)
      const recencyFactor = this.computeRecencyFactor(lib.lastUpdated)
      const trendingScore = velocity * searchBoost * recencyFactor

      let reason = 'Stable'
      if (velocity > 2) reason = 'Rapid growth in downloads'
      else if (velocity > 1.2) reason = 'Growing steadily'
      else if (searchBoost > 3) reason = 'High search interest'
      else if (recencyFactor > 0.9) reason = 'Recently updated'

      results.push({ library: lib, trendingScore, velocity, reason })
    }

    return results
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit)
  }

  /**
   * Get rising libraries — those with the highest week-over-week growth.
   */
  getRising(limit: number = 10): TrendingResult[] {
    return this.getTrending(limit * 2)
      .filter(r => r.velocity > 1.0)
      .slice(0, limit)
  }

  /**
   * Compare two or more libraries across multiple dimensions.
   */
  compare(libraryIds: string[]): ComparisonResult {
    const libs = libraryIds
      .map(id => this.libraries.get(id))
      .filter((l): l is LibraryStats => l !== undefined)

    if (libs.length === 0) {
      return { libraries: [], dimensions: { popularity: {}, growth: {}, activity: {}, overall: {} } }
    }

    const maxDownloads = Math.max(...libs.map(l => l.weeklyDownloads), 1)
    const maxStars = Math.max(...libs.map(l => l.stars), 1)

    const popularity: Record<string, number> = {}
    const growth: Record<string, number> = {}
    const activity: Record<string, number> = {}
    const overall: Record<string, number> = {}

    for (const lib of libs) {
      const popScore = (lib.weeklyDownloads / maxDownloads) * 0.6 + (lib.stars / maxStars) * 0.4
      popularity[lib.id] = Math.round(popScore * 100) / 100

      const vel = this.computeVelocity(lib)
      growth[lib.id] = Math.round(vel * 100) / 100

      const recency = this.computeRecencyFactor(lib.lastUpdated)
      activity[lib.id] = Math.round(recency * 100) / 100

      overall[lib.id] = Math.round((popScore * 0.4 + vel * 0.1 + recency * 0.3 + (lib.searchCount / Math.max(...libs.map(l => l.searchCount), 1)) * 0.2) * 100) / 100
    }

    // Recommendation
    const best = libs.reduce((a, b) => (overall[a.id] >= overall[b.id] ? a : b))
    const recommendation = libs.length >= 2
      ? `${best.name} scores highest overall (${overall[best.id]})`
      : undefined

    return { libraries: libs, dimensions: { popularity, growth, activity, overall }, recommendation }
  }

  // ── Internal ───────────────────────────────────────────────

  private computeVelocity(lib: LibraryStats): number {
    if (lib.previousWeekDownloads === 0) {
      return lib.weeklyDownloads > 0 ? 5.0 : 0
    }
    return lib.weeklyDownloads / lib.previousWeekDownloads
  }

  private computeRecencyFactor(lastUpdated: string): number {
    const daysSince = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince <= 7) return 1.0
    if (daysSince <= 30) return 0.8
    if (daysSince <= 90) return 0.5
    return 0.2
  }
}

export const trendingService = new TrendingService()
