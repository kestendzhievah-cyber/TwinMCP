# E5-Story5-3-Assemblage-Contexte.md

## Epic 5: Documentation Query Engine

### Story 5.3: Assemblage de contexte

**Description**: Assemblage optimisé des résultats pour les LLM

---

## Objectif

Développer un service intelligent d'assemblage de contexte qui combine et optimise les résultats de recherche vectorielle pour fournir aux LLM des informations pertinentes, concises et bien structurées respectant les limites de tokens.

---

## Prérequis

- Service de génération d'embeddings (Story 5.1) opérationnel
- Stockage vectoriel (Story 5.2) fonctionnel
- Service de recherche vectorielle implémenté
- Templates de prompts pour différents LLM

---

## Spécifications Techniques

### 1. Architecture d'Assemblage de Contexte

#### 1.1 Types et Interfaces

```typescript
// src/types/context-assembly.types.ts
export interface ContextAssemblyRequest {
  query: string;
  queryEmbedding: number[];
  searchResults: VectorSearchResult[];
  targetModel: 'gpt-3.5-turbo' | 'gpt-4' | 'claude-3' | 'llama-2' | 'custom';
  maxTokens: number;
  options: {
    includeCodeExamples: boolean;
    includeApiReferences: boolean;
    prioritizeRecent: boolean;
    deduplicateContent: boolean;
    maintainStructure: boolean;
    addMetadata: boolean;
    compressionLevel: 'none' | 'light' | 'medium' | 'aggressive';
  };
  context?: {
    userLevel: 'beginner' | 'intermediate' | 'expert';
    projectType: string;
    framework?: string;
    language?: string;
  };
}

export interface ContextAssemblyResult {
  assembledContext: string;
  metadata: {
    totalChunks: number;
    includedChunks: number;
    excludedChunks: number;
    tokenCount: number;
    compressionRatio: number;
    processingTime: number;
  };
  structure: {
    sections: ContextSection[];
    codeBlocks: CodeBlock[];
    apiReferences: ApiReference[];
    examples: Example[];
  };
  sources: SourceReference[];
  quality: {
    relevanceScore: number;
    completenessScore: number;
    clarityScore: number;
    structureScore: number;
  };
}

export interface ContextSection {
  id: string;
  title: string;
  content: string;
  type: 'introduction' | 'explanation' | 'code' | 'api' | 'example' | 'reference';
  priority: number;
  tokenCount: number;
  sourceReferences: string[];
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  explanation?: string;
  context: string;
  relevanceScore: number;
}

export interface ApiReference {
  id: string;
  method: string;
  signature: string;
  description: string;
  parameters: Parameter[];
  returns: string;
  example?: string;
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface Example {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  complexity: 'basic' | 'intermediate' | 'advanced';
}

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  section?: string;
  relevanceScore: number;
  lastUpdated: Date;
}

export interface ContextTemplate {
  id: string;
  name: string;
  targetModel: string;
  maxTokens: number;
  sections: TemplateSection[];
  variables: TemplateVariable[];
}

export interface TemplateSection {
  id: string;
  name: string;
  type: 'static' | 'dynamic' | 'conditional';
  content: string;
  priority: number;
  maxTokens: number;
  conditions?: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'array';
  defaultValue: any;
  description: string;
}
```

#### 1.2 Configuration des Templates

```typescript
// src/config/context-templates.config.ts
export const CONTEXT_TEMPLATES: Record<string, ContextTemplate> = {
  'gpt-4-documentation': {
    id: 'gpt-4-documentation',
    name: 'GPT-4 Documentation Template',
    targetModel: 'gpt-4',
    maxTokens: 8000,
    sections: [
      {
        id: 'overview',
        name: 'Overview',
        type: 'dynamic',
        content: '{{overview}}',
        priority: 1,
        maxTokens: 500
      },
      {
        id: 'key-concepts',
        name: 'Key Concepts',
        type: 'dynamic',
        content: '{{keyConcepts}}',
        priority: 2,
        maxTokens: 1000
      },
      {
        id: 'api-reference',
        name: 'API Reference',
        type: 'conditional',
        content: '{{apiReference}}',
        priority: 3,
        maxTokens: 2000,
        conditions: ['includeApiReferences']
      },
      {
        id: 'code-examples',
        name: 'Code Examples',
        type: 'conditional',
        content: '{{codeExamples}}',
        priority: 4,
        maxTokens: 2500,
        conditions: ['includeCodeExamples']
      },
      {
        id: 'additional-info',
        name: 'Additional Information',
        type: 'dynamic',
        content: '{{additionalInfo}}',
        priority: 5,
        maxTokens: 2000
      }
    ],
    variables: [
      {
        name: 'userLevel',
        type: 'text',
        defaultValue: 'intermediate',
        description: 'User experience level'
      },
      {
        name: 'framework',
        type: 'text',
        defaultValue: '',
        description: 'Target framework'
      }
    ]
  },
  'claude-3-technical': {
    id: 'claude-3-technical',
    name: 'Claude-3 Technical Documentation',
    targetModel: 'claude-3',
    maxTokens: 100000,
    sections: [
      {
        id: 'introduction',
        name: 'Introduction',
        type: 'dynamic',
        content: '{{introduction}}',
        priority: 1,
        maxTokens: 800
      },
      {
        id: 'technical-details',
        name: 'Technical Details',
        type: 'dynamic',
        content: '{{technicalDetails}}',
        priority: 2,
        maxTokens: 3000
      },
      {
        id: 'implementation',
        name: 'Implementation',
        type: 'dynamic',
        content: '{{implementation}}',
        priority: 3,
        maxTokens: 4000
      },
      {
        id: 'best-practices',
        name: 'Best Practices',
        type: 'dynamic',
        content: '{{bestPractices}}',
        priority: 4,
        maxTokens: 2000
      }
    ],
    variables: []
  }
};
```

### 2. Service d'Assemblage de Contexte

#### 2.1 Context Assembly Service

```typescript
// src/services/context-assembly.service.ts
import { VectorSearchResult } from '../types/embeddings.types';
import { 
  ContextAssemblyRequest, 
  ContextAssemblyResult, 
  ContextSection,
  CodeBlock,
  ApiReference,
  Example,
  SourceReference
} from '../types/context-assembly.types';

export class ContextAssemblyService {
  private tokenCounter: TokenCounter;
  private contentDeduplicator: ContentDeduplicator;
  private contentCompressor: ContentCompressor;
  private structureAnalyzer: StructureAnalyzer;

  constructor() {
    this.tokenCounter = new TokenCounter();
    this.contentDeduplicator = new ContentDeduplicator();
    this.contentCompressor = new ContentCompressor();
    this.structureAnalyzer = new StructureAnalyzer();
  }

  async assembleContext(request: ContextAssemblyRequest): Promise<ContextAssemblyResult> {
    const startTime = Date.now();
    
    // 1. Analyse et classification des résultats
    const classifiedResults = await this.classifySearchResults(request.searchResults);
    
    // 2. Déduplication du contenu
    const deduplicatedResults = request.options.deduplicateContent 
      ? await this.contentDeduplicator.deduplicate(classifiedResults)
      : classifiedResults;
    
    // 3. Priorisation basée sur la requête et le contexte
    const prioritizedResults = await this.prioritizeResults(deduplicatedResults, request);
    
    // 4. Extraction des structures (code, API, exemples)
    const extractedStructures = await this.extractStructures(prioritizedResults);
    
    // 5. Assemblage selon le template
    const template = this.getTemplate(request.targetModel);
    const assembledSections = await this.assembleSections(extractedStructures, template, request);
    
    // 6. Compression si nécessaire
    const compressedSections = await this.compressIfNeeded(assembledSections, request);
    
    // 7. Génération du contexte final
    const finalContext = this.generateFinalContext(compressedSections, template);
    
    // 8. Calcul des métriques de qualité
    const quality = await this.calculateQuality(finalContext, request);
    
    const processingTime = Date.now() - startTime;
    
    return {
      assembledContext: finalContext.content,
      metadata: {
        totalChunks: request.searchResults.length,
        includedChunks: prioritizedResults.length,
        excludedChunks: request.searchResults.length - prioritizedResults.length,
        tokenCount: finalContext.tokenCount,
        compressionRatio: finalContext.compressionRatio,
        processingTime
      },
      structure: extractedStructures,
      sources: this.generateSourceReferences(prioritizedResults),
      quality
    };
  }

  private async classifySearchResults(results: VectorSearchResult[]): Promise<VectorSearchResult[]> {
    return results.map(result => {
      const content = result.chunk.content;
      
      // Classification du type de contenu
      let contentType: string;
      
      if (this.isCodeBlock(content)) {
        contentType = 'code';
      } else if (this.isApiReference(content)) {
        contentType = 'api';
      } else if (this.isExample(content)) {
        contentType = 'example';
      } else if (this.isExplanation(content)) {
        contentType = 'explanation';
      } else {
        contentType = 'general';
      }
      
      // Ajout de la classification aux métadonnées
      result.chunk.metadata = {
        ...result.chunk.metadata,
        contentType,
        complexity: this.assessComplexity(content),
        technicalLevel: this.assessTechnicalLevel(content)
      };
      
      return result;
    });
  }

  private async prioritizeResults(
    results: VectorSearchResult[], 
    request: ContextAssemblyRequest
  ): Promise<VectorSearchResult[]> {
    // Score de priorité composite
    const scoredResults = results.map(result => {
      let priorityScore = result.score;
      
      // Boost basé sur le type de contenu
      const contentType = result.chunk.metadata.contentType;
      if (request.options.includeCodeExamples && contentType === 'code') {
        priorityScore += 0.2;
      }
      if (request.options.includeApiReferences && contentType === 'api') {
        priorityScore += 0.15;
      }
      
      // Boost basé sur la pertinence pour le niveau utilisateur
      const userLevel = request.context?.userLevel || 'intermediate';
      const technicalLevel = result.chunk.metadata.technicalLevel;
      
      if (userLevel === 'beginner' && technicalLevel === 'basic') {
        priorityScore += 0.1;
      } else if (userLevel === 'expert' && technicalLevel === 'advanced') {
        priorityScore += 0.1;
      }
      
      // Boost basé sur la récence
      if (request.options.prioritizeRecent) {
        const daysSinceUpdate = (Date.now() - new Date(result.chunk.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
          priorityScore += 0.05;
        }
      }
      
      return {
        ...result,
        priorityScore: Math.min(priorityScore, 1.0)
      };
    });
    
    // Tri par score de priorité
    return scoredResults.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  private async extractStructures(results: VectorSearchResult[]): Promise<{
    sections: ContextSection[];
    codeBlocks: CodeBlock[];
    apiReferences: ApiReference[];
    examples: Example[];
  }> {
    const structures = {
      sections: [] as ContextSection[],
      codeBlocks: [] as CodeBlock[],
      apiReferences: [] as ApiReference[],
      examples: [] as Example[]
    };

    for (const result of results) {
      const content = result.chunk.content;
      const contentType = result.chunk.metadata.contentType;
      
      switch (contentType) {
        case 'code':
          const codeBlock = this.extractCodeBlock(result);
          if (codeBlock) structures.codeBlocks.push(codeBlock);
          break;
          
        case 'api':
          const apiRef = this.extractApiReference(result);
          if (apiRef) structures.apiReferences.push(apiRef);
          break;
          
        case 'example':
          const example = this.extractExample(result);
          if (example) structures.examples.push(example);
          break;
          
        default:
          const section = this.createSection(result);
          if (section) structures.sections.push(section);
      }
    }
    
    return structures;
  }

  private async assembleSections(
    structures: any,
    template: ContextTemplate,
    request: ContextAssemblyRequest
  ): Promise<ContextSection[]> {
    const sections: ContextSection[] = [];
    
    for (const templateSection of template.sections) {
      // Vérification des conditions
      if (templateSection.conditions) {
        const conditionsMet = templateSection.conditions.every(condition => 
          this.evaluateCondition(condition, request.options)
        );
        if (!conditionsMet) continue;
      }
      
      let content = '';
      
      switch (templateSection.name) {
        case 'overview':
          content = this.generateOverview(structures, request);
          break;
        case 'key-concepts':
          content = this.generateKeyConcepts(structures, request);
          break;
        case 'api-reference':
          content = this.generateApiReference(structures.apiReferences);
          break;
        case 'code-examples':
          content = this.generateCodeExamples(structures.codeBlocks, request);
          break;
        case 'technical-details':
          content = this.generateTechnicalDetails(structures, request);
          break;
        default:
          content = this.generateGenericSection(structures, templateSection.name);
      }
      
      if (content.trim()) {
        const tokenCount = this.tokenCounter.countTokens(content);
        
        sections.push({
          id: templateSection.id,
          title: templateSection.name,
          content,
          type: this.mapSectionType(templateSection.name),
          priority: templateSection.priority,
          tokenCount,
          sourceReferences: this.extractSourceReferences(content)
        });
      }
    }
    
    return sections;
  }

  private async compressIfNeeded(
    sections: ContextSection[], 
    request: ContextAssemblyRequest
  ): Promise<ContextSection[]> {
    if (request.options.compressionLevel === 'none') {
      return sections;
    }
    
    const totalTokens = sections.reduce((sum, s) => sum + s.tokenCount, 0);
    
    if (totalTokens <= request.maxTokens) {
      return sections;
    }
    
    const compressionRatio = request.maxTokens / totalTokens;
    const targetCompression = this.getCompressionTarget(request.options.compressionLevel);
    
    return this.contentCompressor.compress(sections, {
      targetRatio: Math.min(compressionRatio, targetCompression),
      preserveStructure: request.options.maintainStructure,
      prioritizeImportant: true
    });
  }

  private generateFinalContext(sections: ContextSection[], template: ContextTemplate): {
    content: string;
    tokenCount: number;
    compressionRatio: number;
  } {
    // Tri des sections par priorité
    const sortedSections = sections.sort((a, b) => a.priority - b.priority);
    
    // Assemblage du contenu
    let content = '';
    
    for (const section of sortedSections) {
      if (content) content += '\n\n';
      content += `## ${section.title}\n\n${section.content}`;
    }
    
    // Ajout des références sources
    const uniqueSources = this.extractUniqueSources(sections);
    if (uniqueSources.length > 0) {
      content += '\n\n---\n\n## Sources\n\n';
      for (const source of uniqueSources.slice(0, 10)) { // Limiter à 10 sources
        content += `- [${source.title}](${source.url})${source.section ? ` (${source.section})` : ''}\n`;
      }
    }
    
    const tokenCount = this.tokenCounter.countTokens(content);
    const originalTokens = sections.reduce((sum, s) => sum + s.tokenCount, 0);
    const compressionRatio = originalTokens > 0 ? tokenCount / originalTokens : 1;
    
    return { content, tokenCount, compressionRatio };
  }

  // Méthodes utilitaires
  private isCodeBlock(content: string): boolean {
    return content.includes('```') || 
           content.includes('function ') || 
           content.includes('class ') ||
           content.includes('const ') ||
           content.includes('let ') ||
           content.includes('var ');
  }

  private isApiReference(content: string): boolean {
    return content.includes('API') || 
           content.includes('method') ||
           content.includes('function(') ||
           content.includes('Parameters:') ||
           content.includes('Returns:');
  }

  private isExample(content: string): boolean {
    return content.includes('Example') || 
           content.includes('For example') ||
           content.includes('Usage:') ||
           content.includes('Demo');
  }

  private isExplanation(content: string): boolean {
    return content.length > 100 && 
           !this.isCodeBlock(content) && 
           !this.isApiReference(content) &&
           !this.isExample(content);
  }

  private assessComplexity(content: string): 'basic' | 'intermediate' | 'advanced' {
    const complexityIndicators = {
      basic: ['simple', 'basic', 'easy', 'beginner'],
      intermediate: ['intermediate', 'moderate', 'standard'],
      advanced: ['advanced', 'complex', 'sophisticated', 'expert']
    };
    
    const lowerContent = content.toLowerCase();
    
    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => lowerContent.includes(indicator))) {
        return level as 'basic' | 'intermediate' | 'advanced';
      }
    }
    
    // Détection basée sur la structure
    if (this.isCodeBlock(content)) {
      const lineCount = content.split('\n').length;
      if (lineCount < 10) return 'basic';
      if (lineCount < 30) return 'intermediate';
      return 'advanced';
    }
    
    return 'intermediate';
  }

  private assessTechnicalLevel(content: string): 'basic' | 'intermediate' | 'advanced' {
    // Logique similaire à assessComplexity mais basée sur le contenu technique
    const technicalTerms = {
      basic: ['variable', 'function', 'loop', 'array'],
      intermediate: ['callback', 'promise', 'async', 'class'],
      advanced: ['closure', 'prototype', 'hoisting', 'currying']
    };
    
    const lowerContent = content.toLowerCase();
    const scores = { basic: 0, intermediate: 0, advanced: 0 };
    
    for (const [level, terms] of Object.entries(technicalTerms)) {
      scores[level as keyof typeof scores] = terms.filter(term => 
        lowerContent.includes(term)
      ).length;
    }
    
    const maxScore = Math.max(...Object.values(scores));
    const level = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore);
    
    return (level || 'intermediate') as 'basic' | 'intermediate' | 'advanced';
  }

  private getTemplate(model: string): ContextTemplate {
    return CONTEXT_TEMPLATES[`${model}-documentation`] || CONTEXT_TEMPLATES['gpt-4-documentation'];
  }

  private evaluateCondition(condition: string, options: any): boolean {
    const conditionMap: Record<string, () => boolean> = {
      'includeCodeExamples': () => options.includeCodeExamples,
      'includeApiReferences': () => options.includeApiReferences,
      'prioritizeRecent': () => options.prioritizeRecent
    };
    
    return conditionMap[condition]?.() || false;
  }

  private getCompressionTarget(level: string): number {
    const targets = {
      light: 0.9,
      medium: 0.7,
      aggressive: 0.5
    };
    
    return targets[level as keyof typeof targets] || 0.8;
  }

  private async calculateQuality(context: string, request: ContextAssemblyRequest): Promise<{
    relevanceScore: number;
    completenessScore: number;
    clarityScore: number;
    structureScore: number;
  }> {
    // Implémentation de l'évaluation de qualité
    const relevanceScore = this.calculateRelevance(context, request.query);
    const completenessScore = this.calculateCompleteness(context, request);
    const clarityScore = this.calculateClarity(context);
    const structureScore = this.calculateStructure(context);
    
    return {
      relevanceScore,
      completenessScore,
      clarityScore,
      structureScore
    };
  }

  private calculateRelevance(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    
    const matchedWords = queryWords.filter(word => contentLower.includes(word));
    return queryWords.length > 0 ? matchedWords.length / queryWords.length : 0;
  }

  private calculateCompleteness(content: string, request: ContextAssemblyRequest): number {
    // Vérifier si le contenu couvre les aspects attendus
    let score = 0.5; // Score de base
    
    if (request.options.includeCodeExamples && content.includes('```')) score += 0.2;
    if (request.options.includeApiReferences && content.includes('API')) score += 0.2;
    if (content.includes('Example') || content.includes('Usage')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculateClarity(content: string): number {
    // Métriques de clarté: longueur des phrases, structure, etc.
    const sentences = content.split(/[.!?]+/);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    // Score basé sur la longueur moyenne des phrases (optimal: 15-25 mots)
    const optimalLength = 20;
    const lengthScore = 1 - Math.abs(avgSentenceLength - optimalLength) / optimalLength;
    
    // Bonus pour la présence de structure (markdown)
    const structureBonus = content.includes('#') ? 0.1 : 0;
    
    return Math.min(lengthScore + structureBonus, 1.0);
  }

  private calculateStructure(content: string): number {
    // Évaluation de la structure du contenu
    let score = 0;
    
    if (content.includes('#')) score += 0.3; // Titres
    if (content.includes('```')) score += 0.2; // Code
    if (content.includes('-') || content.includes('*')) score += 0.2; // Listes
    if (content.includes('**') || content.includes('*')) score += 0.1; // Emphase
    if (content.split('\n\n').length > 2) score += 0.2; // Paragraphes
    
    return Math.min(score, 1.0);
  }

  // Autres méthodes d'extraction et de génération...
  private extractCodeBlock(result: VectorSearchResult): CodeBlock | null {
    // Implémentation de l'extraction de blocs de code
    return null;
  }

  private extractApiReference(result: VectorSearchResult): ApiReference | null {
    // Implémentation de l'extraction de références API
    return null;
  }

  private extractExample(result: VectorSearchResult): Example | null {
    // Implémentation de l'extraction d'exemples
    return null;
  }

  private createSection(result: VectorSearchResult): ContextSection | null {
    // Implémentation de la création de sections
    return null;
  }

  private generateOverview(structures: any, request: ContextAssemblyRequest): string {
    // Implémentation de la génération d'overview
    return '';
  }

  private generateKeyConcepts(structures: any, request: ContextAssemblyRequest): string {
    // Implémentation de la génération de concepts clés
    return '';
  }

  private generateApiReference(apiRefs: ApiReference[]): string {
    // Implémentation de la génération de références API
    return '';
  }

  private generateCodeExamples(codeBlocks: CodeBlock[], request: ContextAssemblyRequest): string {
    // Implémentation de la génération d'exemples de code
    return '';
  }

  private generateTechnicalDetails(structures: any, request: ContextAssemblyRequest): string {
    // Implémentation de la génération de détails techniques
    return '';
  }

  private generateGenericSection(structures: any, sectionName: string): string {
    // Implémentation de la génération de section générique
    return '';
  }

  private extractSourceReferences(content: string): string[] {
    // Implémentation de l'extraction de références
    return [];
  }

  private extractUniqueSources(sections: ContextSection[]): SourceReference[] {
    // Implémentation de l'extraction de sources uniques
    return [];
  }

  private generateSourceReferences(results: VectorSearchResult[]): SourceReference[] {
    // Implémentation de la génération de références sources
    return [];
  }

  private mapSectionType(sectionName: string): ContextSection['type'] {
    // Mapping des noms de sections vers les types
    const typeMap: Record<string, ContextSection['type']> = {
      'overview': 'introduction',
      'key-concepts': 'explanation',
      'api-reference': 'api',
      'code-examples': 'example',
      'technical-details': 'explanation'
    };
    
    return typeMap[sectionName] || 'explanation';
  }
}
```

### 3. Services Utilitaires

#### 3.1 Token Counter

```typescript
// src/services/token-counter.service.ts
export class TokenCounter {
  private tiktoken: any;

  constructor() {
    // Initialisation de tiktoken ou alternative
  }

  countTokens(text: string): number {
    // Implémentation du comptage de tokens
    // Approximation simple: 1 token ≈ 4 caractères
    return Math.ceil(text.length / 4);
  }

  countTokensByModel(text: string, model: string): number {
    // Comptage spécifique au modèle
    const modelMultipliers = {
      'gpt-3.5-turbo': 1.0,
      'gpt-4': 1.0,
      'claude-3': 1.2,
      'llama-2': 1.1
    };
    
    const baseTokens = this.countTokens(text);
    const multiplier = modelMultipliers[model as keyof typeof modelMultipliers] || 1.0;
    
    return Math.ceil(baseTokens * multiplier);
  }
}
```

#### 3.2 Content Deduplicator

```typescript
// src/services/content-deduplicator.service.ts
export class ContentDeduplicator {
  async deduplicate(results: VectorSearchResult[]): Promise<VectorSearchResult[]> {
    const seen = new Set<string>();
    const deduplicated: VectorSearchResult[] = [];
    
    for (const result of results) {
      const contentHash = this.generateContentHash(result.chunk.content);
      
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        deduplicated.push(result);
      }
    }
    
    return deduplicated;
  }

  private generateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
```

#### 3.3 Content Compressor

```typescript
// src/services/content-compressor.service.ts
export class ContentCompressor {
  async compress(
    sections: ContextSection[], 
    options: {
      targetRatio: number;
      preserveStructure: boolean;
      prioritizeImportant: boolean;
    }
  ): Promise<ContextSection[]> {
    const compressedSections: ContextSection[] = [];
    let totalTokens = 0;
    const targetTokens = sections.reduce((sum, s) => sum + s.tokenCount, 0) * options.targetRatio;
    
    // Tri par importance si nécessaire
    const sortedSections = options.prioritizeImportant 
      ? sections.sort((a, b) => b.priority - a.priority)
      : sections;
    
    for (const section of sortedSections) {
      if (totalTokens + section.tokenCount <= targetTokens) {
        compressedSections.push(section);
        totalTokens += section.tokenCount;
      } else {
        // Compression partielle de la section
        const remainingTokens = targetTokens - totalTokens;
        if (remainingTokens > 100) { // Minimum pour une section utile
          const compressedSection = await this.compressSection(section, remainingTokens);
          if (compressedSection) {
            compressedSections.push(compressedSection);
            break;
          }
        }
      }
    }
    
    return compressedSections;
  }

  private async compressSection(section: ContextSection, maxTokens: number): Promise<ContextSection | null> {
    // Compression intelligente du contenu
    const sentences = section.content.split(/[.!?]+/);
    let compressedContent = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = Math.ceil(sentence.length / 4);
      
      if (currentTokens + sentenceTokens <= maxTokens) {
        compressedContent += sentence + '. ';
        currentTokens += sentenceTokens;
      } else {
        break;
      }
    }
    
    if (compressedContent.trim().length === 0) {
      return null;
    }
    
    return {
      ...section,
      content: compressedContent.trim(),
      tokenCount: currentTokens
    };
  }
}
```

---

## Tâches Détaillées

### 1. Classification et Priorisation
- [ ] Implémenter la classification de contenu
- [ ] Développer l'algorithme de priorisation
- [ ] Ajouter l'évaluation de complexité
- [ ] Optimiser le scoring composite

### 2. Extraction de Structure
- [ ] Développer l'extraction de code blocks
- [ ] Implémenter l'extraction API references
- [ ] Ajouter l'extraction d'exemples
- [ ] Créer l'analyse de structure

### 3. Assemblage et Templates
- [ ] Développer le système de templates
- [ ] Implémenter l'assemblage de sections
- [ ] Ajouter la compression adaptative
- [ ] Optimiser la génération finale

### 4. Qualité et Optimisation
- [ ] Implémenter les métriques de qualité
- [ ] Développer la déduplication
- [ ] Ajouter le comptage de tokens
- [ ] Optimiser les performances

---

## Validation

### Tests d'Assemblage

```typescript
// __tests__/context-assembly.service.test.ts
describe('ContextAssemblyService', () => {
  let service: ContextAssemblyService;

  beforeEach(() => {
    service = new ContextAssemblyService();
  });

  describe('assembleContext', () => {
    it('should assemble context within token limits', async () => {
      const request: ContextAssemblyRequest = {
        query: 'React hooks documentation',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults: generateMockSearchResults(20),
        targetModel: 'gpt-4',
        maxTokens: 4000,
        options: {
          includeCodeExamples: true,
          includeApiReferences: true,
          prioritizeRecent: false,
          deduplicateContent: true,
          maintainStructure: true,
          addMetadata: true,
          compressionLevel: 'medium'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.assembledContext).toBeDefined();
      expect(result.metadata.tokenCount).toBeLessThanOrEqual(request.maxTokens);
      expect(result.structure.sections).toHaveLength.greaterThan(0);
      expect(result.quality.relevanceScore).toBe.greaterThan(0.5);
    });

    it('should prioritize relevant content', async () => {
      const request: ContextAssemblyRequest = {
        query: 'useState hook',
        queryEmbedding: new Array(1536).fill(0.1),
        searchResults: generateMockSearchResults(10),
        targetModel: 'gpt-4',
        maxTokens: 2000,
        options: {
          includeCodeExamples: true,
          includeApiReferences: false,
          prioritizeRecent: true,
          deduplicateContent: false,
          maintainStructure: true,
          addMetadata: false,
          compressionLevel: 'none'
        }
      };

      const result = await service.assembleContext(request);

      expect(result.metadata.includedChunks).toBeLessThanOrEqual(result.metadata.totalChunks);
      expect(result.assembledContext).toContain('useState');
    });
  });
});

function generateMockSearchResults(count: number): VectorSearchResult[] {
  return Array.from({ length: count }, (_, i) => ({
    chunk: {
      id: `chunk-${i}`,
      libraryId: 'react',
      content: `Mock content ${i}`,
      metadata: {},
      url: `https://example.com/${i}`,
      title: `Title ${i}`,
      chunkIndex: i,
      totalChunks: count,
      embeddingModel: 'text-embedding-3-small',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    score: Math.random(),
    relevance: 'high' as const
  }));
}
```

---

## Architecture

### Composants

1. **ContextAssemblyService**: Service principal d'assemblage
2. **TokenCounter**: Comptage de tokens par modèle
3. **ContentDeduplicator**: Déduplication de contenu
4. **ContentCompressor**: Compression intelligente
5. **StructureAnalyzer**: Analyse et extraction de structure

### Flux d'Assemblage

```
Search Results → Classification → Prioritization → Structure Extraction → Template Assembly → Compression → Final Context
```

---

## Performance

### Optimisations

- **Parallel Processing**: Traitement parallèle des sections
- **Smart Caching**: Cache des templates et structures
- **Incremental Assembly**: Assemblage progressif
- **Token Optimization**: Optimisation précise des tokens

### Métriques Cibles

- **Assembly Time**: < 500ms pour la plupart des requêtes
- **Token Efficiency**: > 90% d'utilisation des tokens
- **Quality Score**: > 0.8 pour le contenu final
- **Compression Ratio**: Adaptatif selon les besoins

---

## Monitoring

### Métriques

- `context.assembly.requests_total`: Nombre d'assemblages
- `context.assembly.latency`: Latence d'assemblage
- `context.assembly.token_efficiency`: Efficacité token
- `context.assembly.quality_score`: Score de qualité moyen
- `context.compression.ratio`: Ratio de compression

---

## Livrables

1. **ContextAssemblyService**: Service complet
2. **Template System**: Templates configurables
3. **Quality Metrics**: Évaluation automatique
4. **Performance Tests**: Benchmarks et optimisations
5. **Documentation**: Guide d'utilisation

---

## Critères de Succès

- [ ] Assemblage de contexte fonctionnel
- [ ] Respect des limites de tokens
- [ ] Qualité du contenu > 0.8
- [ ] Performance < 500ms
- [ ] Support multi-modèles
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **Quality Monitoring**: Surveillance de la qualité
2. **Performance Tuning**: Optimisation continue
3. **Template Evolution**: Amélioration des templates
4. **User Feedback**: Collecte des retours utilisateurs
