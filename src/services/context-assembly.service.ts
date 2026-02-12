import { VectorSearchResult } from '../types/embeddings.types';
import { 
  ContextAssemblyRequest, 
  ContextAssemblyResult, 
  ContextSection,
  CodeBlock,
  ApiReference,
  Example,
  SourceReference,
  ContextTemplate
} from '../types/context-assembly.types';
import { TokenCounter } from './token-counter.service';
import { ContentDeduplicator } from './content-deduplicator.service';
import { ContentCompressor } from './content-compressor.service';
import { getTemplateForModel } from '../config/context-templates.config';

export class ContextAssemblyService {
  private tokenCounter: TokenCounter;
  private contentDeduplicator: ContentDeduplicator;
  private contentCompressor: ContentCompressor;

  constructor() {
    this.tokenCounter = new TokenCounter();
    this.contentDeduplicator = new ContentDeduplicator();
    this.contentCompressor = new ContentCompressor();
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
    const template = getTemplateForModel(request.targetModel);
    const assembledSections = await this.assembleSections(extractedStructures, template, request);
    const originalTokenCount = assembledSections.reduce((sum, s) => sum + s.tokenCount, 0);
    
    // 6. Compression si nécessaire
    const compressedSections = await this.compressIfNeeded(assembledSections, request);
    
    // 7. Génération du contexte final
    const finalContext = this.generateFinalContext(compressedSections, template, originalTokenCount);
    
    // 8. Calcul des métriques de qualité
    const quality = await this.calculateQuality(finalContext.content, request);
    
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
      
      if (this.isApiReference(content)) {
        contentType = 'api';
      } else if (this.isCodeBlock(content)) {
        contentType = 'code';
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
        contentType: contentType as any,
        complexity: this.assessComplexity(content),
        technicalLevel: this.assessTechnicalLevel(content)
      } as any;
      
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
      const technicalLevel = (result.chunk.metadata as any).technicalLevel;
      
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
    return scoredResults.sort((a, b) => (b as any).priorityScore - (a as any).priorityScore);
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
      
      const sectionKey = templateSection.id;

      switch (sectionKey) {
        case 'overview':
        case 'summary':
        case 'introduction':
          content = this.generateOverview(structures, request);
          break;
        case 'key-concepts':
        case 'technical-details':
        case 'explanation':
          content = this.generateKeyConcepts(structures, request);
          break;
        case 'api-reference':
        case 'quick-api':
        case 'reference':
          content = this.generateApiReference(structures.apiReferences);
          break;
        case 'code-examples':
        case 'essential-code':
        case 'examples':
          content = this.generateCodeExamples(structures.codeBlocks, request);
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

  private generateFinalContext(
    sections: ContextSection[],
    template: ContextTemplate,
    originalTokenCount: number
  ): {
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
    const compressionRatio = originalTokenCount > 0 ? tokenCount / originalTokenCount : 1;
    
    return { content, tokenCount, compressionRatio };
  }

  // Méthodes utilitaires
  private isCodeBlock(content: string): boolean {
    if (content.includes('API Reference') || content.includes('API')) {
      return false;
    }

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
    let score = 0.5;
    
    if (request.options.includeCodeExamples && content.includes('```')) score += 0.2;
    if (request.options.includeApiReferences && content.includes('API')) score += 0.2;
    if (content.includes('Example') || content.includes('Usage')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculateClarity(content: string): number {
    const sentences = content.split(/[.!?]+/);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    const optimalLength = 20;
    const lengthScore = Math.max(0, 1 - Math.abs(avgSentenceLength - optimalLength) / optimalLength);
    
    const structureBonus = content.includes('#') ? 0.1 : 0;
    
    return Math.min(lengthScore + structureBonus, 1.0);
  }

  private calculateStructure(content: string): number {
    let score = 0;
    
    if (content.includes('#')) score += 0.3;
    if (content.includes('```')) score += 0.2;
    if (content.includes('-') || content.includes('*')) score += 0.2;
    if (content.includes('**') || content.includes('*')) score += 0.1;
    if (content.split('\n\n').length > 2) score += 0.2;
    
    return Math.min(score, 1.0);
  }

  // Méthodes d'extraction et de génération
  private extractCodeBlock(result: VectorSearchResult): CodeBlock | null {
    const content = result.chunk.content;
    const codeMatch = content.match(/```(\w+)?\n([\s\S]*?)```/);
    
    if (codeMatch) {
      return {
        id: result.chunk.id,
        language: codeMatch[1] || 'text',
        code: codeMatch[2],
        context: content.replace(/```[\s\S]*?```/, '').trim(),
        relevanceScore: result.score
      };
    }
    
    return null;
  }

  private extractApiReference(result: VectorSearchResult): ApiReference | null {
    const content = result.chunk.content;
    
    // Extraction simple des signatures de fonction
    const functionMatch = content.match(/function\s+(\w+)\s*\(([^)]*)\)\s*[:\s]*([\w<>,\s]+)/);
    
    if (functionMatch) {
      return {
        id: result.chunk.id,
        method: functionMatch[1],
        signature: functionMatch[0],
        description: content.substring(0, 200),
        parameters: [],
        returns: functionMatch[3] || 'void',
        example: ''
      };
    }
    
    return null;
  }

  private extractExample(result: VectorSearchResult): Example | null {
    const content = result.chunk.content;
    
    if (this.isExample(content)) {
      return {
        id: result.chunk.id,
        title: 'Example',
        description: content.substring(0, 150),
        code: this.extractCodeFromContent(content),
        language: this.detectLanguage(content),
        complexity: this.assessComplexity(content)
      };
    }
    
    return null;
  }

  private createSection(result: VectorSearchResult): ContextSection | null {
    return {
      id: result.chunk.id,
      title: result.chunk.metadata.title || 'Section',
      content: result.chunk.content,
      type: 'explanation',
      priority: 5,
      tokenCount: this.tokenCounter.countTokens(result.chunk.content),
      sourceReferences: [result.chunk.metadata.url]
    };
  }

  private generateOverview(structures: any, _request: ContextAssemblyRequest): string {
    const sections = structures.sections.slice(0, 3);
    return sections.map((s: ContextSection) => s.content.substring(0, 200)).join('\n\n');
  }

  private generateKeyConcepts(structures: any, _request: ContextAssemblyRequest): string {
    const allContent = [
      ...structures.sections.map((s: ContextSection) => s.content),
      ...structures.codeBlocks.map((c: CodeBlock) => c.context)
    ].join('\n\n');
    
    return allContent.substring(0, 1000);
  }

  private generateApiReference(apiRefs: ApiReference[]): string {
    return apiRefs.map(ref => `### ${ref.method}\n\n${ref.signature}\n\n${ref.description}`).join('\n\n');
  }

  private generateCodeExamples(codeBlocks: CodeBlock[], _request: ContextAssemblyRequest): string {
    return codeBlocks.map(block => {
      let example = `#### ${block.language} Example\n\n`;
      if (block.context) {
        example += `${block.context}\n\n`;
      }
      example += `\`\`\`${block.language}\n${block.code}\n\`\`\``;
      return example;
    }).join('\n\n');
  }

  private generateGenericSection(_structures: any, sectionName: string): string {
    return 'Generated content for ' + sectionName;
  }

  private extractCodeFromContent(_content: string): string {
    const codeMatch = _content.match(/```[\s\S]*?```/);
    return codeMatch ? codeMatch[0] : _content;
  }

  private detectLanguage(_content: string): string {
    if (_content.includes('function') || _content.includes('const ') || _content.includes('let ')) return 'javascript';
    if (_content.includes('def ') || _content.includes('import ')) return 'python';
    if (_content.includes('public class') || _content.includes('import java')) return 'java';
    return 'text';
  }

  private extractSourceReferences(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s\)]+/g;
    const matches = content.match(urlRegex);
    return matches || [];
  }

  private extractUniqueSources(sections: ContextSection[]): SourceReference[] {
    const allUrls = sections.flatMap(s => s.sourceReferences);
    const uniqueUrls = [...new Set(allUrls)];
    
    return uniqueUrls.map((url, index) => ({
      id: `source-${index}`,
      title: `Source ${index + 1}`,
      url,
      relevanceScore: 1.0,
      lastUpdated: new Date()
    }));
  }

  private generateSourceReferences(results: VectorSearchResult[]): SourceReference[] {
    return results.map((result, index) => ({
      id: `source-${index}`,
      title: result.chunk.metadata.title || `Source ${index + 1}`,
      url: result.chunk.metadata.url,
      section: result.chunk.metadata.section || undefined,
      relevanceScore: result.score,
      lastUpdated: result.chunk.updatedAt
    }));
  }

  private mapSectionType(sectionName: string): ContextSection['type'] {
    const typeMap: Record<string, ContextSection['type']> = {
      'overview': 'introduction',
      'summary': 'introduction',
      'introduction': 'introduction',
      'key-concepts': 'explanation',
      'technical-details': 'explanation',
      'explanation': 'explanation',
      'api-reference': 'api',
      'quick-api': 'api',
      'reference': 'api',
      'code-examples': 'example',
      'essential-code': 'example',
      'examples': 'example'
    };
    
    return typeMap[sectionName] || 'explanation';
  }
}
