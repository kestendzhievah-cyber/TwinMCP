/**
 * ML-based Ranking Service.
 *
 * Intelligent library ranking using machine learning features:
 *   - Feature extraction (popularity, recency, quality, relevance)
 *   - Learning-to-rank with weighted scoring
 *   - Click-through rate (CTR) learning
 *   - Personalized ranking based on user history
 *   - A/B testing of ranking models
 *   - Ranking explanation
 */

export interface RankingFeatures {
  popularity: number       // 0-1: downloads, stars, forks
  recency: number          // 0-1: last update freshness
  quality: number          // 0-1: quality score
  relevance: number        // 0-1: text/semantic match
  maintenance: number      // 0-1: active maintenance
  communityHealth: number  // 0-1: issues response, contributors
  documentation: number    // 0-1: readme, examples, API docs
  security: number         // 0-1: no known vulnerabilities
}

export interface RankingModel {
  id: string
  name: string
  weights: RankingFeatures
  bias: number
  version: number
  trainedAt: string
  metrics: { ndcg: number; mrr: number; precision: number }
  active: boolean
}

export interface RankedItem {
  itemId: string
  score: number
  features: RankingFeatures
  explanation: RankingExplanation
  position: number
}

export interface RankingExplanation {
  topFactors: Array<{ feature: string; contribution: number; value: number }>
  totalScore: number
  modelUsed: string
}

export interface ClickEvent {
  queryId: string
  itemId: string
  position: number
  clicked: boolean
  timestamp: string
  dwellTimeMs?: number
}

export interface UserProfile {
  userId: string
  preferredLanguages: string[]
  preferredCategories: string[]
  clickHistory: Array<{ itemId: string; count: number }>
  boostFactors: Partial<RankingFeatures>
}

export class MLRankingService {
  private models: Map<string, RankingModel> = new Map()
  private clickEvents: ClickEvent[] = []
  private userProfiles: Map<string, UserProfile> = new Map()
  private idCounter = 0

  constructor() {
    this.initializeDefaultModel()
  }

  // ── Model Management ───────────────────────────────────────

  createModel(name: string, weights: RankingFeatures, bias: number = 0): RankingModel {
    const model: RankingModel = {
      id: `model-${++this.idCounter}`, name, weights, bias,
      version: 1, trainedAt: new Date().toISOString(),
      metrics: { ndcg: 0, mrr: 0, precision: 0 }, active: false,
    }
    this.models.set(model.id, model)
    return model
  }

  getModel(id: string): RankingModel | undefined { return this.models.get(id) }
  getModels(): RankingModel[] { return Array.from(this.models.values()) }
  getActiveModel(): RankingModel | undefined { return this.getModels().find(m => m.active) }

  activateModel(id: string): boolean {
    const model = this.models.get(id)
    if (!model) return false
    for (const m of this.models.values()) m.active = false
    model.active = true
    return true
  }

  // ── Feature Extraction ─────────────────────────────────────

  extractFeatures(item: {
    downloads?: number; stars?: number; forks?: number;
    lastUpdated?: string; qualityScore?: number;
    textMatchScore?: number; hasReadme?: boolean;
    openIssues?: number; contributors?: number;
    vulnerabilities?: number;
  }): RankingFeatures {
    const now = Date.now()
    const lastUpdated = item.lastUpdated ? new Date(item.lastUpdated).getTime() : now - 365 * 86400000
    const daysSinceUpdate = (now - lastUpdated) / 86400000

    return {
      popularity: Math.min(1, ((item.downloads || 0) / 1000000 + (item.stars || 0) / 10000 + (item.forks || 0) / 5000) / 3),
      recency: Math.max(0, 1 - daysSinceUpdate / 365),
      quality: item.qualityScore ?? 0.5,
      relevance: item.textMatchScore ?? 0,
      maintenance: daysSinceUpdate < 90 ? 1 : daysSinceUpdate < 180 ? 0.7 : daysSinceUpdate < 365 ? 0.4 : 0.1,
      communityHealth: Math.min(1, ((item.contributors || 0) / 50)),
      documentation: item.hasReadme ? 0.8 : 0.2,
      security: item.vulnerabilities === 0 ? 1 : item.vulnerabilities === undefined ? 0.5 : Math.max(0, 1 - (item.vulnerabilities * 0.2)),
    }
  }

  // ── Ranking ────────────────────────────────────────────────

  /** Score a single item using the active model. */
  scoreItem(features: RankingFeatures, modelId?: string): number {
    const model = modelId ? this.models.get(modelId) : this.getActiveModel()
    if (!model) return 0

    let score = model.bias
    const featureKeys = Object.keys(features) as (keyof RankingFeatures)[]
    for (const key of featureKeys) {
      score += features[key] * model.weights[key]
    }
    // Sigmoid normalization
    return 1 / (1 + Math.exp(-score))
  }

  /** Rank a list of items. */
  rankItems(items: Array<{ id: string; features: RankingFeatures }>, userId?: string, modelId?: string): RankedItem[] {
    const model = modelId ? this.models.get(modelId) : this.getActiveModel()
    if (!model) return []

    const userProfile = userId ? this.userProfiles.get(userId) : undefined

    const scored = items.map(item => {
      let features = item.features
      // Apply user personalization boosts
      if (userProfile?.boostFactors) {
        features = { ...features }
        for (const [key, boost] of Object.entries(userProfile.boostFactors)) {
          if (boost !== undefined) {
            (features as any)[key] = Math.min(1, features[key as keyof RankingFeatures] + boost * 0.2)
          }
        }
      }

      const score = this.scoreItem(features, model.id)
      const explanation = this.explainRanking(features, model)

      return { itemId: item.id, score, features, explanation, position: 0 }
    })

    scored.sort((a, b) => b.score - a.score)
    scored.forEach((item, idx) => { item.position = idx + 1 })
    return scored
  }

  /** Explain why an item was ranked at its position. */
  explainRanking(features: RankingFeatures, model: RankingModel): RankingExplanation {
    const contributions: Array<{ feature: string; contribution: number; value: number }> = []
    const featureKeys = Object.keys(features) as (keyof RankingFeatures)[]

    for (const key of featureKeys) {
      contributions.push({
        feature: key,
        contribution: features[key] * model.weights[key],
        value: features[key],
      })
    }

    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

    return {
      topFactors: contributions.slice(0, 3),
      totalScore: this.scoreItem(features, model.id),
      modelUsed: model.name,
    }
  }

  // ── Click-Through Learning ─────────────────────────────────

  recordClick(queryId: string, itemId: string, position: number, clicked: boolean, dwellTimeMs?: number): void {
    this.clickEvents.push({ queryId, itemId, position, clicked, timestamp: new Date().toISOString(), dwellTimeMs })
  }

  getClickThroughRate(itemId: string): number {
    const events = this.clickEvents.filter(e => e.itemId === itemId)
    if (events.length === 0) return 0
    return events.filter(e => e.clicked).length / events.length
  }

  /** Train model weights from click data (simplified gradient update). */
  trainFromClicks(modelId: string, learningRate: number = 0.01): boolean {
    const model = this.models.get(modelId)
    if (!model || this.clickEvents.length === 0) return false

    // Group by query
    const queries = new Map<string, ClickEvent[]>()
    for (const event of this.clickEvents) {
      if (!queries.has(event.queryId)) queries.set(event.queryId, [])
      queries.get(event.queryId)!.push(event)
    }

    // Simple: boost weights for features of clicked items at lower positions
    let updates = 0
    for (const events of queries.values()) {
      const clicked = events.filter(e => e.clicked)
      for (const event of clicked) {
        // Position bias: clicks at lower positions are more valuable
        const positionBoost = 1 / Math.log2(event.position + 1)
        const dwellBoost = event.dwellTimeMs ? Math.min(1, event.dwellTimeMs / 30000) : 0.5
        const boost = learningRate * positionBoost * dwellBoost
        // Apply small boost to all weights (simplified)
        const keys = Object.keys(model.weights) as (keyof RankingFeatures)[]
        for (const key of keys) {
          model.weights[key] += boost * 0.1
        }
        updates++
      }
    }

    if (updates > 0) {
      model.version++
      model.trainedAt = new Date().toISOString()
    }
    return updates > 0
  }

  getClickEvents(): ClickEvent[] { return [...this.clickEvents] }

  // ── User Profiles ──────────────────────────────────────────

  setUserProfile(userId: string, profile: Partial<UserProfile>): UserProfile {
    const existing = this.userProfiles.get(userId) || {
      userId, preferredLanguages: [], preferredCategories: [],
      clickHistory: [], boostFactors: {},
    }
    Object.assign(existing, profile, { userId })
    this.userProfiles.set(userId, existing)
    return existing
  }

  getUserProfile(userId: string): UserProfile | undefined { return this.userProfiles.get(userId) }

  // ── Model Evaluation ───────────────────────────────────────

  evaluateModel(modelId: string, testData: Array<{ features: RankingFeatures; relevant: boolean }>): { ndcg: number; mrr: number; precision: number } {
    const model = this.models.get(modelId)
    if (!model || testData.length === 0) return { ndcg: 0, mrr: 0, precision: 0 }

    const scored = testData.map(d => ({ ...d, score: this.scoreItem(d.features, modelId) }))
    scored.sort((a, b) => b.score - a.score)

    // Precision@10
    const top10 = scored.slice(0, Math.min(10, scored.length))
    const precision = top10.filter(d => d.relevant).length / top10.length

    // MRR
    const firstRelevant = scored.findIndex(d => d.relevant)
    const mrr = firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0

    // NDCG@10
    const dcg = top10.reduce((sum, d, i) => sum + (d.relevant ? 1 : 0) / Math.log2(i + 2), 0)
    const idealRelevant = testData.filter(d => d.relevant).length
    const idcg = Array.from({ length: Math.min(idealRelevant, 10) }, (_, i) => 1 / Math.log2(i + 2)).reduce((s, v) => s + v, 0)
    const ndcg = idcg > 0 ? dcg / idcg : 0

    model.metrics = { ndcg: Math.round(ndcg * 1000) / 1000, mrr: Math.round(mrr * 1000) / 1000, precision: Math.round(precision * 1000) / 1000 }
    return model.metrics
  }

  // ── Internal ───────────────────────────────────────────────

  private initializeDefaultModel(): void {
    const model = this.createModel('default-v1', {
      popularity: 0.15, recency: 0.10, quality: 0.20, relevance: 0.30,
      maintenance: 0.08, communityHealth: 0.05, documentation: 0.07, security: 0.05,
    })
    this.activateModel(model.id)
  }
}

export const mlRankingService = new MLRankingService()
