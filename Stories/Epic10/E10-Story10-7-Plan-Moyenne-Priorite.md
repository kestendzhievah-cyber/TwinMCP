# E10-Story10-7-Plan-Moyenne-Priorite.md

## Plan d'Implémentation - Moyenne Priorité

**Date**: 2026-01-18  
**Priorité**: MOYENNE  
**Durée estimée**: 8-10 semaines  
**Dépendances**: Fonctionnalités critiques + Haute priorité

---

## 🎯 Objectifs

Implémenter les 3 fonctionnalités à moyenne priorité pour optimiser les performances et l'intelligence du système:

1. **Library Resolution Avancé** - Fuzzy matching, scoring, recommandations
2. **Contexte Intelligent** - Assemblage automatique et optimisation
3. **Scalabilité** - Auto-scaling, load balancing, optimisations

---

## 📋 1. LIBRARY RESOLUTION AVANCÉ

### Objectif
Améliorer la résolution de bibliothèques avec fuzzy matching, scoring intelligent et recommandations.

### État Actuel
- Résolution basique: 35%
- Fuzzy matching: 0%
- Scoring: 0%
- Recommandations: 0%

### Plan d'Action (3 semaines)

#### Semaine 1: Fuzzy Matching & Recherche Avancée

**Dépendances:**
```bash
npm install fuse.js
npm install natural
npm install leven
npm install string-similarity
```

**Fuzzy Search Service:**
```typescript
// src/services/library/fuzzy-search.service.ts
import Fuse from 'fuse.js';
import { distance as levenshtein } from 'leven';
import { compareTwoStrings } from 'string-similarity';

export class FuzzySearchService {
  private fuse: Fuse<Library>;
  
  constructor(libraries: Library[]) {
    this.fuse = new Fuse(libraries, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'description', weight: 0.3 },
        { name: 'keywords', weight: 0.2 },
        { name: 'tags', weight: 0.1 }
      ],
      threshold: 0.4,
      includeScore: true,
      useExtendedSearch: true
    });
  }
  
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    // 1. Fuse.js search
    const fuseResults = this.fuse.search(query, {
      limit: options.limit || 20
    });
    
    // 2. Calculate additional similarity scores
    const enrichedResults = fuseResults.map(result => {
      const library = result.item;
      
      return {
        library,
        scores: {
          fuse: 1 - (result.score || 0),
          levenshtein: this.levenshteinSimilarity(query, library.name),
          jaro: compareTwoStrings(query.toLowerCase(), library.name.toLowerCase()),
          semantic: 0 // Will be calculated with embeddings
        },
        finalScore: 0 // Will be calculated
      };
    });
    
    // 3. Calculate final weighted score
    return enrichedResults.map(r => ({
      ...r,
      finalScore: this.calculateFinalScore(r.scores)
    })).sort((a, b) => b.finalScore - a.finalScore);
  }
  
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = levenshtein(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }
  
  private calculateFinalScore(scores: Scores): number {
    return (
      scores.fuse * 0.3 +
      scores.levenshtein * 0.2 +
      scores.jaro * 0.2 +
      scores.semantic * 0.3
    );
  }
  
  async searchWithSemantics(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // 1. Get fuzzy results
    const fuzzyResults = this.search(query, { limit: 50 });
    
    // 2. Generate query embedding
    const queryEmbedding = await this.embeddingService.generate(query);
    
    // 3. Calculate semantic similarity for top results
    for (const result of fuzzyResults) {
      const libraryEmbedding = await this.getLibraryEmbedding(result.library.id);
      result.scores.semantic = this.cosineSimilarity(queryEmbedding, libraryEmbedding);
      result.finalScore = this.calculateFinalScore(result.scores);
    }
    
    // 4. Re-sort by final score
    return fuzzyResults
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, options.limit || 10);
  }
}
```

**Multi-Criteria Search:**
```typescript
// src/services/library/multi-criteria-search.service.ts
export class MultiCriteriaSearchService {
  async search(criteria: SearchCriteria): Promise<Library[]> {
    const filters: any[] = [];
    
    // Name/description filter
    if (criteria.query) {
      filters.push({
        OR: [
          { name: { contains: criteria.query, mode: 'insensitive' } },
          { description: { contains: criteria.query, mode: 'insensitive' } }
        ]
      });
    }
    
    // Language filter
    if (criteria.language) {
      filters.push({ language: criteria.language });
    }
    
    // License filter
    if (criteria.license) {
      filters.push({ license: { in: criteria.license } });
    }
    
    // Tags filter
    if (criteria.tags && criteria.tags.length > 0) {
      filters.push({
        tags: { hasSome: criteria.tags }
      });
    }
    
    // Popularity filter
    if (criteria.minDownloads) {
      filters.push({ downloads: { gte: criteria.minDownloads } });
    }
    
    // Quality score filter
    if (criteria.minQualityScore) {
      filters.push({ qualityScore: { gte: criteria.minQualityScore } });
    }
    
    // Last updated filter
    if (criteria.updatedAfter) {
      filters.push({ lastUpdated: { gte: criteria.updatedAfter } });
    }
    
    const results = await prisma.library.findMany({
      where: { AND: filters },
      orderBy: this.getOrderBy(criteria.sortBy),
      take: criteria.limit || 20,
      skip: criteria.offset || 0,
      include: {
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 1
        },
        tags: true,
        maintainers: true
      }
    });
    
    return results;
  }
  
  private getOrderBy(sortBy?: string): any {
    switch (sortBy) {
      case 'popularity':
        return { downloads: 'desc' };
      case 'quality':
        return { qualityScore: 'desc' };
      case 'recent':
        return { lastUpdated: 'desc' };
      case 'name':
        return { name: 'asc' };
      default:
        return { relevanceScore: 'desc' };
    }
  }
}
```

#### Semaine 2: Scoring Intelligent

**Quality Score Calculator:**
```typescript
// src/services/library/quality-score.service.ts
export class QualityScoreService {
  async calculateScore(libraryId: string): Promise<QualityScore> {
    const library = await this.getLibraryWithMetrics(libraryId);
    
    const scores = {
      popularity: this.calculatePopularityScore(library),
      maintenance: this.calculateMaintenanceScore(library),
      documentation: this.calculateDocumentationScore(library),
      testing: this.calculateTestingScore(library),
      security: this.calculateSecurityScore(library),
      community: this.calculateCommunityScore(library)
    };
    
    const weights = {
      popularity: 0.2,
      maintenance: 0.25,
      documentation: 0.15,
      testing: 0.15,
      security: 0.15,
      community: 0.1
    };
    
    const finalScore = Object.entries(scores).reduce(
      (total, [key, value]) => total + value * weights[key],
      0
    );
    
    return {
      overall: finalScore,
      breakdown: scores,
      grade: this.getGrade(finalScore),
      timestamp: new Date()
    };
  }
  
  private calculatePopularityScore(library: LibraryWithMetrics): number {
    const downloads = library.downloads || 0;
    const stars = library.githubStars || 0;
    const forks = library.githubForks || 0;
    
    // Normalize scores (0-100)
    const downloadScore = Math.min(100, Math.log10(downloads + 1) * 10);
    const starScore = Math.min(100, Math.log10(stars + 1) * 20);
    const forkScore = Math.min(100, Math.log10(forks + 1) * 15);
    
    return (downloadScore * 0.5 + starScore * 0.3 + forkScore * 0.2) / 100;
  }
  
  private calculateMaintenanceScore(library: LibraryWithMetrics): number {
    const now = new Date();
    const lastUpdate = new Date(library.lastUpdated);
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Score decreases with time since last update
    let updateScore = 100;
    if (daysSinceUpdate > 365) updateScore = 20;
    else if (daysSinceUpdate > 180) updateScore = 50;
    else if (daysSinceUpdate > 90) updateScore = 70;
    else if (daysSinceUpdate > 30) updateScore = 90;
    
    // Check release frequency
    const releaseFrequency = library.versions?.length || 0;
    const frequencyScore = Math.min(100, releaseFrequency * 5);
    
    // Check open issues ratio
    const totalIssues = library.githubIssues || 0;
    const openIssues = library.githubOpenIssues || 0;
    const issueScore = totalIssues > 0 
      ? (1 - (openIssues / totalIssues)) * 100 
      : 50;
    
    return (updateScore * 0.4 + frequencyScore * 0.3 + issueScore * 0.3) / 100;
  }
  
  private calculateDocumentationScore(library: LibraryWithMetrics): number {
    let score = 0;
    
    // README exists and has content
    if (library.readme && library.readme.length > 500) score += 30;
    else if (library.readme) score += 15;
    
    // Has documentation site
    if (library.documentationUrl) score += 25;
    
    // Has examples
    if (library.examplesCount && library.examplesCount > 0) score += 20;
    
    // Has API documentation
    if (library.hasApiDocs) score += 15;
    
    // Has changelog
    if (library.hasChangelog) score += 10;
    
    return score / 100;
  }
  
  private calculateTestingScore(library: LibraryWithMetrics): number {
    let score = 0;
    
    // Has tests
    if (library.hasTests) score += 40;
    
    // Test coverage
    if (library.testCoverage) {
      score += library.testCoverage * 0.4; // Max 40 points
    }
    
    // CI/CD configured
    if (library.hasCiCd) score += 20;
    
    return score / 100;
  }
  
  private calculateSecurityScore(library: LibraryWithMetrics): number {
    let score = 100;
    
    // Deduct for known vulnerabilities
    const vulnerabilities = library.vulnerabilities || [];
    vulnerabilities.forEach(vuln => {
      if (vuln.severity === 'critical') score -= 30;
      else if (vuln.severity === 'high') score -= 20;
      else if (vuln.severity === 'medium') score -= 10;
      else if (vuln.severity === 'low') score -= 5;
    });
    
    // Bonus for security audit
    if (library.hasSecurityAudit) score += 10;
    
    return Math.max(0, score) / 100;
  }
  
  private calculateCommunityScore(library: LibraryWithMetrics): number {
    const contributors = library.contributorsCount || 0;
    const stars = library.githubStars || 0;
    const forks = library.githubForks || 0;
    
    const contributorScore = Math.min(40, contributors * 2);
    const starScore = Math.min(30, Math.log10(stars + 1) * 6);
    const forkScore = Math.min(30, Math.log10(forks + 1) * 6);
    
    return (contributorScore + starScore + forkScore) / 100;
  }
  
  private getGrade(score: number): string {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B';
    if (score >= 0.6) return 'C';
    if (score >= 0.5) return 'D';
    return 'F';
  }
}
```

#### Semaine 3: Recommandations & Alternatives

**Recommendation Engine:**
```typescript
// src/services/library/recommendation.service.ts
export class RecommendationService {
  async getRecommendations(
    libraryId: string,
    context: RecommendationContext
  ): Promise<Recommendation[]> {
    const library = await this.getLibrary(libraryId);
    
    // 1. Find similar libraries
    const similar = await this.findSimilarLibraries(library);
    
    // 2. Find alternatives
    const alternatives = await this.findAlternatives(library);
    
    // 3. Find complementary libraries
    const complementary = await this.findComplementary(library, context);
    
    // 4. Combine and rank
    return this.rankRecommendations([
      ...similar.map(l => ({ library: l, type: 'similar', score: 0 })),
      ...alternatives.map(l => ({ library: l, type: 'alternative', score: 0 })),
      ...complementary.map(l => ({ library: l, type: 'complementary', score: 0 }))
    ]);
  }
  
  private async findSimilarLibraries(library: Library): Promise<Library[]> {
    // Use embeddings for semantic similarity
    const libraryEmbedding = await this.getLibraryEmbedding(library.id);
    
    const results = await prisma.$queryRaw<Library[]>`
      SELECT l.*, 
        1 - (e.vector <=> ${libraryEmbedding}::vector) as similarity
      FROM libraries l
      JOIN library_embeddings e ON e.library_id = l.id
      WHERE l.id != ${library.id}
        AND 1 - (e.vector <=> ${libraryEmbedding}::vector) > 0.7
      ORDER BY e.vector <=> ${libraryEmbedding}::vector
      LIMIT 10
    `;
    
    return results;
  }
  
  private async findAlternatives(library: Library): Promise<Library[]> {
    // Find libraries with same purpose but different implementation
    return await prisma.library.findMany({
      where: {
        id: { not: library.id },
        OR: [
          { tags: { hasSome: library.tags } },
          { category: library.category }
        ],
        language: library.language
      },
      orderBy: { qualityScore: 'desc' },
      take: 10
    });
  }
  
  private async findComplementary(
    library: Library,
    context: RecommendationContext
  ): Promise<Library[]> {
    // Find libraries commonly used together
    const coOccurrences = await prisma.$queryRaw<Library[]>`
      SELECT l.*, COUNT(*) as co_occurrence_count
      FROM libraries l
      JOIN project_dependencies pd1 ON pd1.library_id = l.id
      JOIN project_dependencies pd2 ON pd2.project_id = pd1.project_id
      WHERE pd2.library_id = ${library.id}
        AND l.id != ${library.id}
      GROUP BY l.id
      ORDER BY co_occurrence_count DESC
      LIMIT 10
    `;
    
    return coOccurrences;
  }
  
  private async rankRecommendations(
    recommendations: Recommendation[]
  ): Promise<Recommendation[]> {
    // Calculate scores based on multiple factors
    for (const rec of recommendations) {
      const qualityScore = rec.library.qualityScore || 0;
      const popularityScore = Math.log10(rec.library.downloads + 1) / 10;
      const recencyScore = this.getRecencyScore(rec.library.lastUpdated);
      
      const typeWeight = {
        similar: 0.4,
        alternative: 0.3,
        complementary: 0.3
      };
      
      rec.score = (
        qualityScore * 0.4 +
        popularityScore * 0.3 +
        recencyScore * 0.3
      ) * typeWeight[rec.type];
    }
    
    return recommendations.sort((a, b) => b.score - a.score);
  }
}
```

**Dependency Analysis:**
```typescript
// src/services/library/dependency-analysis.service.ts
export class DependencyAnalysisService {
  async analyzeDependencies(libraryId: string): Promise<DependencyAnalysis> {
    const library = await this.getLibraryWithDeps(libraryId);
    
    return {
      direct: await this.analyzeDirectDeps(library),
      transitive: await this.analyzeTransitiveDeps(library),
      conflicts: await this.detectConflicts(library),
      vulnerabilities: await this.scanVulnerabilities(library),
      graph: await this.buildDependencyGraph(library),
      recommendations: await this.getDepRecommendations(library)
    };
  }
  
  private async detectConflicts(library: Library): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const deps = library.dependencies || [];
    
    // Check for version conflicts
    const depVersions = new Map<string, string[]>();
    
    for (const dep of deps) {
      const versions = depVersions.get(dep.name) || [];
      versions.push(dep.version);
      depVersions.set(dep.name, versions);
    }
    
    for (const [name, versions] of depVersions) {
      if (versions.length > 1) {
        conflicts.push({
          type: 'version_conflict',
          library: name,
          versions,
          severity: 'high'
        });
      }
    }
    
    return conflicts;
  }
  
  private async scanVulnerabilities(
    library: Library
  ): Promise<Vulnerability[]> {
    // Integration with vulnerability databases
    const vulnerabilities: Vulnerability[] = [];
    
    for (const dep of library.dependencies || []) {
      const vulns = await this.checkVulnerabilityDB(dep.name, dep.version);
      vulnerabilities.push(...vulns);
    }
    
    return vulnerabilities;
  }
}
```

### Critères de Succès
- ✅ Fuzzy matching avec 90%+ précision
- ✅ Scoring multi-critères fonctionnel
- ✅ Recommandations pertinentes
- ✅ Analyse de dépendances complète
- ✅ Détection de conflits
- ✅ Scan de vulnérabilités

---

## 📋 2. CONTEXTE INTELLIGENT

### Objectif
Assemblage automatique et optimisation du contexte pour les requêtes LLM.

### État Actuel
- Sélection de contexte: 0%
- Assemblage: 0%
- Optimisation: 0%

### Plan d'Action (3 semaines)

#### Semaine 1: Sélection Intelligente de Contexte

**Context Selection Service:**
```typescript
// src/services/context/context-selection.service.ts
export class ContextSelectionService {
  async selectContext(
    query: string,
    options: ContextOptions = {}
  ): Promise<ContextItem[]> {
    // 1. Analyze query intent
    const intent = await this.analyzeIntent(query);
    
    // 2. Search relevant documentation
    const docs = await this.searchRelevantDocs(query, intent);
    
    // 3. Get conversation history context
    const history = await this.getRelevantHistory(
      options.conversationId,
      query
    );
    
    // 4. Get code examples
    const examples = await this.getRelevantExamples(query, intent);
    
    // 5. Combine and rank
    const allContext = [...docs, ...history, ...examples];
    const ranked = await this.rankContext(allContext, query, intent);
    
    // 6. Optimize for token budget
    return this.optimizeForTokenBudget(ranked, options.maxTokens || 4000);
  }
  
  private async analyzeIntent(query: string): Promise<QueryIntent> {
    const response = await this.llmService.complete({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Analyze the user's query and determine:
1. Primary intent (explanation, example, troubleshooting, comparison, etc.)
2. Required context types (documentation, code, API reference, etc.)
3. Specific libraries or technologies mentioned
4. Complexity level (beginner, intermediate, advanced)

Respond in JSON format.`
      }, {
        role: 'user',
        content: query
      }],
      temperature: 0.3
    });
    
    return JSON.parse(response.content);
  }
  
  private async searchRelevantDocs(
    query: string,
    intent: QueryIntent
  ): Promise<ContextItem[]> {
    const results = await this.hybridSearchService.search(query, {
      limit: 20,
      threshold: 0.7,
      filters: {
        types: intent.requiredContextTypes,
        libraries: intent.libraries
      }
    });
    
    return results.map(r => ({
      id: r.id,
      type: 'documentation',
      content: r.content,
      metadata: r.metadata,
      relevanceScore: r.score,
      tokens: this.estimateTokens(r.content)
    }));
  }
  
  private async getRelevantHistory(
    conversationId: string,
    query: string
  ): Promise<ContextItem[]> {
    if (!conversationId) return [];
    
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    // Use embeddings to find relevant messages
    const queryEmbedding = await this.embeddingService.generate(query);
    const relevantMessages: ContextItem[] = [];
    
    for (const msg of messages) {
      const msgEmbedding = await this.getMessageEmbedding(msg.id);
      const similarity = this.cosineSimilarity(queryEmbedding, msgEmbedding);
      
      if (similarity > 0.6) {
        relevantMessages.push({
          id: msg.id,
          type: 'history',
          content: msg.content,
          metadata: { role: msg.role, timestamp: msg.createdAt },
          relevanceScore: similarity,
          tokens: this.estimateTokens(msg.content)
        });
      }
    }
    
    return relevantMessages;
  }
  
  private async rankContext(
    items: ContextItem[],
    query: string,
    intent: QueryIntent
  ): Promise<ContextItem[]> {
    // Multi-factor ranking
    for (const item of items) {
      const recencyScore = this.getRecencyScore(item.metadata.timestamp);
      const typeScore = this.getTypeScore(item.type, intent);
      const diversityScore = await this.getDiversityScore(item, items);
      
      item.finalScore = (
        item.relevanceScore * 0.5 +
        recencyScore * 0.2 +
        typeScore * 0.2 +
        diversityScore * 0.1
      );
    }
    
    return items.sort((a, b) => b.finalScore - a.finalScore);
  }
  
  private optimizeForTokenBudget(
    items: ContextItem[],
    maxTokens: number
  ): ContextItem[] {
    const selected: ContextItem[] = [];
    let totalTokens = 0;
    
    // Greedy selection by score
    for (const item of items) {
      if (totalTokens + item.tokens <= maxTokens) {
        selected.push(item);
        totalTokens += item.tokens;
      } else {
        // Try to fit a truncated version
        const availableTokens = maxTokens - totalTokens;
        if (availableTokens > 100) {
          const truncated = this.truncateContent(item, availableTokens);
          selected.push(truncated);
          break;
        }
      }
    }
    
    return selected;
  }
}
```

#### Semaine 2: Assemblage et Compression

**Context Assembly Service:**
```typescript
// src/services/context/context-assembly.service.ts
export class ContextAssemblyService {
  async assemble(
    items: ContextItem[],
    query: string,
    options: AssemblyOptions = {}
  ): Promise<AssembledContext> {
    // 1. Deduplicate content
    const deduplicated = this.deduplicate(items);
    
    // 2. Group by type and relevance
    const grouped = this.groupItems(deduplicated);
    
    // 3. Format for LLM
    const formatted = this.formatForLLM(grouped, options.format);
    
    // 4. Add metadata
    const withMetadata = this.addMetadata(formatted, query);
    
    // 5. Compress if needed
    const final = options.compress 
      ? await this.compress(withMetadata, options.targetTokens)
      : withMetadata;
    
    return {
      content: final,
      items: deduplicated,
      tokens: this.estimateTokens(final),
      metadata: {
        itemCount: deduplicated.length,
        compressionRatio: options.compress 
          ? this.estimateTokens(formatted) / this.estimateTokens(final)
          : 1
      }
    };
  }
  
  private deduplicate(items: ContextItem[]): ContextItem[] {
    const seen = new Set<string>();
    const unique: ContextItem[] = [];
    
    for (const item of items) {
      const hash = this.contentHash(item.content);
      
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(item);
      } else {
        // Merge metadata if duplicate
        const existing = unique.find(i => this.contentHash(i.content) === hash);
        if (existing) {
          existing.metadata = {
            ...existing.metadata,
            ...item.metadata,
            sources: [
              ...(existing.metadata.sources || []),
              ...(item.metadata.sources || [])
            ]
          };
        }
      }
    }
    
    return unique;
  }
  
  private formatForLLM(
    grouped: Map<string, ContextItem[]>,
    format: 'markdown' | 'xml' | 'json' = 'markdown'
  ): string {
    if (format === 'markdown') {
      return this.formatAsMarkdown(grouped);
    } else if (format === 'xml') {
      return this.formatAsXML(grouped);
    } else {
      return JSON.stringify(Array.from(grouped.entries()), null, 2);
    }
  }
  
  private formatAsMarkdown(grouped: Map<string, ContextItem[]>): string {
    let output = '# Context\n\n';
    
    for (const [type, items] of grouped) {
      output += `## ${this.formatTypeName(type)}\n\n`;
      
      for (const item of items) {
        output += `### ${item.metadata.title || 'Untitled'}\n\n`;
        output += `${item.content}\n\n`;
        
        if (item.metadata.source) {
          output += `*Source: ${item.metadata.source}*\n\n`;
        }
        
        output += '---\n\n';
      }
    }
    
    return output;
  }
  
  private async compress(
    content: string,
    targetTokens: number
  ): Promise<string> {
    const currentTokens = this.estimateTokens(content);
    
    if (currentTokens <= targetTokens) {
      return content;
    }
    
    // Use LLM to compress context
    const response = await this.llmService.complete({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Compress the following context while preserving all key information.
Target: ~${targetTokens} tokens (currently ${currentTokens} tokens).
Maintain structure and important details.`
      }, {
        role: 'user',
        content
      }],
      temperature: 0.3,
      maxTokens: targetTokens
    });
    
    return response.content;
  }
}
```

#### Semaine 3: Optimisation et Caching

**Context Cache Service:**
```typescript
// src/services/context/context-cache.service.ts
export class ContextCacheService {
  private redis: Redis;
  private ttl = 3600; // 1 hour
  
  async get(
    query: string,
    options: ContextOptions
  ): Promise<AssembledContext | null> {
    const key = this.generateKey(query, options);
    const cached = await this.redis.get(key);
    
    if (cached) {
      const context = JSON.parse(cached);
      
      // Check if context is still fresh
      if (await this.isFresh(context)) {
        return context;
      }
    }
    
    return null;
  }
  
  async set(
    query: string,
    options: ContextOptions,
    context: AssembledContext
  ): Promise<void> {
    const key = this.generateKey(query, options);
    await this.redis.setex(key, this.ttl, JSON.stringify(context));
  }
  
  private generateKey(query: string, options: ContextOptions): string {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ query, options }))
      .digest('hex');
    return `context:${hash}`;
  }
  
  private async isFresh(context: AssembledContext): Promise<boolean> {
    // Check if any source documents have been updated
    for (const item of context.items) {
      const doc = await prisma.crawledContent.findUnique({
        where: { id: item.id },
        select: { updatedAt: true }
      });
      
      if (doc && doc.updatedAt > new Date(item.metadata.cachedAt)) {
        return false;
      }
    }
    
    return true;
  }
}
```

**Context Optimization Service:**
```typescript
// src/services/context/context-optimization.service.ts
export class ContextOptimizationService {
  async optimize(
    context: AssembledContext,
    constraints: OptimizationConstraints
  ): Promise<AssembledContext> {
    let optimized = context;
    
    // 1. Remove redundancy
    optimized = this.removeRedundancy(optimized);
    
    // 2. Prioritize recent information
    optimized = this.prioritizeRecent(optimized);
    
    // 3. Balance diversity
    optimized = this.balanceDiversity(optimized);
    
    // 4. Fit token budget
    if (constraints.maxTokens) {
      optimized = await this.fitTokenBudget(optimized, constraints.maxTokens);
    }
    
    // 5. Validate quality
    const quality = await this.assessQuality(optimized);
    if (quality.score < constraints.minQuality) {
      throw new Error('Context quality below threshold');
    }
    
    return optimized;
  }
  
  private removeRedundancy(context: AssembledContext): AssembledContext {
    // Use sentence embeddings to detect redundant information
    const sentences = this.extractSentences(context.content);
    const embeddings = await this.embeddingService.generateBatch(sentences);
    
    const unique: string[] = [];
    const seenEmbeddings: number[][] = [];
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const embedding = embeddings[i];
      
      // Check similarity with existing sentences
      const maxSimilarity = Math.max(
        ...seenEmbeddings.map(e => this.cosineSimilarity(embedding, e))
      );
      
      if (maxSimilarity < 0.9) {
        unique.push(sentence);
        seenEmbeddings.push(embedding);
      }
    }
    
    return {
      ...context,
      content: unique.join(' '),
      tokens: this.estimateTokens(unique.join(' '))
    };
  }
}
```

### Critères de Succès
- ✅ Sélection automatique de contexte
- ✅ Assemblage optimisé
- ✅ Déduplication fonctionnelle
- ✅ Compression intelligente
- ✅ Cache performant
- ✅ Qualité contexte > 85%

---

## 📋 3. SCALABILITÉ

### Objectif
Infrastructure scalable avec auto-scaling, load balancing et optimisations.

### État Actuel
- Auto-scaling: 0%
- Load balancing: 0%
- Caching: 40%
- Database optimization: 30%

### Plan d'Action (2-4 semaines)

#### Semaine 1-2: Infrastructure Kubernetes

**Kubernetes Manifests Complets:**
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: twinmcp-api
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: twinmcp-api
  template:
    metadata:
      labels:
        app: twinmcp-api
        version: v1
    spec:
      containers:
      - name: api
        image: ghcr.io/twinmcp/twinmcp:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: twinmcp-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: twinmcp-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: twinmcp-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: twinmcp-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: twinmcp-api
  namespace: production
spec:
  type: LoadBalancer
  selector:
    app: twinmcp-api
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  sessionAffinity: ClientIP
```

**Redis Cluster:**
```yaml
# k8s/redis-cluster.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: production
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: client
        - containerPort: 16379
          name: gossip
        command:
        - redis-server
        - /conf/redis.conf
        volumeMounts:
        - name: conf
          mountPath: /conf
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

#### Semaine 3: Database Optimization

**Connection Pooling:**
```typescript
// src/lib/database/connection-pool.ts
import { Pool } from 'pg';

export class DatabasePool {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20, // Maximum pool size
      min: 5,  // Minimum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      maxUses: 7500 // Recycle connections
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.pool.on('connect', (client) => {
      logger.debug('New client connected to pool');
    });
    
    this.pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle client', err);
    });
  }
  
  async query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  }
}
```

**Query Optimization:**
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_libraries_name_trgm 
ON libraries USING gin(name gin_trgm_ops);

CREATE INDEX CONCURRENTLY idx_libraries_quality_score 
ON libraries(quality_score DESC);

CREATE INDEX CONCURRENTLY idx_chunks_search_vector 
ON chunks USING gin(search_vector);

CREATE INDEX CONCURRENTLY idx_embeddings_vector 
ON embeddings USING ivfflat(vector vector_cosine_ops) 
WITH (lists = 100);

-- Partitioning for large tables
CREATE TABLE analytics_events_2026_01 
PARTITION OF analytics_events 
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Materialized views for expensive queries
CREATE MATERIALIZED VIEW library_stats AS
SELECT 
  l.id,
  l.name,
  COUNT(DISTINCT d.project_id) as usage_count,
  AVG(r.rating) as avg_rating,
  COUNT(DISTINCT c.id) as content_count
FROM libraries l
LEFT JOIN project_dependencies d ON d.library_id = l.id
LEFT JOIN ratings r ON r.library_id = l.id
LEFT JOIN crawled_content c ON c.library_id = l.id
GROUP BY l.id, l.name;

CREATE UNIQUE INDEX ON library_stats(id);
```

#### Semaine 4: Caching Strategy

**Multi-Level Cache:**
```typescript
// src/services/cache/multi-level-cache.service.ts
export class MultiLevelCacheService {
  private l1Cache: Map<string, CacheEntry>; // In-memory
  private l2Cache: Redis; // Redis
  private l3Cache: any; // CDN (CloudFlare, CloudFront)
  
  constructor() {
    this.l1Cache = new Map();
    this.l2Cache = new Redis(process.env.REDIS_URL);
    this.setupL1Eviction();
  }
  
  async get<T>(key: string): Promise<T | null> {
    // L1: In-memory
    const l1 = this.l1Cache.get(key);
    if (l1 && !this.isExpired(l1)) {
      return l1.value as T;
    }
    
    // L2: Redis
    const l2 = await this.l2Cache.get(key);
    if (l2) {
      const value = JSON.parse(l2);
      this.l1Cache.set(key, { value, timestamp: Date.now() });
      return value as T;
    }
    
    // L3: CDN (for static content)
    if (this.isStaticContent(key)) {
      const l3 = await this.fetchFromCDN(key);
      if (l3) {
        await this.set(key, l3, { ttl: 86400 });
        return l3 as T;
      }
    }
    
    return null;
  }
  
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 3600;
    
    // L1: In-memory (max 1000 items)
    if (this.l1Cache.size < 1000) {
      this.l1Cache.set(key, { value, timestamp: Date.now(), ttl });
    }
    
    // L2: Redis
    await this.l2Cache.setex(key, ttl, JSON.stringify(value));
    
    // L3: CDN (for static content)
    if (this.isStaticContent(key) && options.cdn) {
      await this.uploadToCDN(key, value);
    }
  }
  
  private setupL1Eviction() {
    // LRU eviction every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.l1Cache) {
        if (this.isExpired(entry)) {
          this.l1Cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
}
```

### Critères de Succès
- ✅ Auto-scaling fonctionnel
- ✅ Load balancing configuré
- ✅ Cache multi-niveaux
- ✅ Database optimisée
- ✅ Latence P95 < 500ms
- ✅ Support 10000+ req/s

---

## 📅 Timeline Globale

| Semaines | Tâches |
|----------|--------|
| 1-3 | Library Resolution Avancé |
| 4-6 | Contexte Intelligent |
| 7-10 | Scalabilité |

**Durée totale**: 8-10 semaines

---

## 🎯 Métriques de Succès Globales

- ✅ Recherche bibliothèques 95%+ précision
- ✅ Contexte automatique pertinent
- ✅ Infrastructure scalable
- ✅ Performance optimisée
- ✅ Coûts maîtrisés

---

**Note**: Ce plan nécessite les fonctionnalités critiques et haute priorité complétées au préalable.
