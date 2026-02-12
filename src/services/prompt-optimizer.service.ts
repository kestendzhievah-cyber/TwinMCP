import { PromptTemplate, PromptOptimizationOptions, PromptOptimizationResult, OptimizationRecord } from '../types/prompt-system.types';
import crypto from 'crypto';

export class PromptOptimizer {
  async optimize(
    template: PromptTemplate, 
    options: PromptOptimizationOptions = {}
  ): Promise<OptimizationRecord> {
    const algorithm = options.algorithm || 'hill_climbing';
    const maxIterations = options.maxIterations || 100;
    
    const startTime = Date.now();
    let bestTemplate = { ...template };
    let bestScore = await this.evaluateTemplate(bestTemplate);
    
    const optimizationPath: any[] = [];

    for (let i = 0; i < maxIterations; i++) {
      const candidate = this.generateCandidate(bestTemplate, algorithm);
      const candidateScore = await this.evaluateTemplate(candidate);
      
      optimizationPath.push({
        iteration: i,
        template: candidate.template,
        metrics: { score: candidateScore },
        improvement: candidateScore - bestScore
      });

      if (candidateScore > bestScore) {
        bestTemplate = candidate;
        bestScore = candidateScore;
      }
    }

    const record: OptimizationRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'auto',
      reason: 'Automatic optimization',
      changes: [{
        type: 'template',
        field: 'template',
        oldValue: template.template,
        newValue: bestTemplate.template,
        reason: 'Optimization improvement'
      }],
      metricsBefore: { score: await this.evaluateTemplate(template) },
      metricsAfter: { score: bestScore },
      improvement: bestScore - (await this.evaluateTemplate(template))
    };

    return record;
  }

  private generateCandidate(template: PromptTemplate, algorithm: string): PromptTemplate {
    const candidate = { ...template };

    switch (algorithm) {
      case 'hill_climbing':
        return this.hillClimbingMutate(candidate);
      case 'genetic':
        return this.geneticMutate(candidate);
      case 'simulated_annealing':
        return this.simulatedAnnealingMutate(candidate);
      default:
        return this.hillClimbingMutate(candidate);
    }
  }

  private async evaluateTemplate(template: PromptTemplate): Promise<number> {
    // Évaluation basée sur plusieurs facteurs
    let score = 0;

    // Longueur du template (pas trop long, pas trop court)
    const length = template.template.length;
    if (length >= 100 && length <= 1000) {
      score += 20;
    } else if (length > 1000) {
      score -= 10;
    }

    // Nombre de variables (complexité)
    if (template.variables.length <= 5) {
      score += 15;
    } else if (template.variables.length > 10) {
      score -= 5;
    }

    // Clarté et structure
    if (this.hasClearStructure(template.template)) {
      score += 25;
    }

    // Présence d'exemples
    if (template.examples.length > 0) {
      score += 10;
    }

    // Optimisation précédente
    if (template.optimization.optimizationHistory.length > 0) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private hillClimbingMutate(template: PromptTemplate): PromptTemplate {
    const mutations = [
      () => this.addClarification(template),
      () => this.removeRedundancy(template),
      () => this.improveStructure(template),
      () => this.addExamples(template)
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    return mutation();
  }

  private geneticMutate(template: PromptTemplate): PromptTemplate {
    // Croisement et mutation pour algorithme génétique
    const mutated = this.hillClimbingMutate(template);
    
    // Ajouter de la diversité
    if (Math.random() < 0.3) {
      mutated.template = this.randomizeWordOrder(mutated.template);
    }
    
    return mutated;
  }

  private simulatedAnnealingMutate(template: PromptTemplate): PromptTemplate {
    // Mutation avec probabilité décroissante
    const temperature = 0.5; // Simplifié
    if (Math.random() < temperature) {
      return this.hillClimbingMutate(template);
    }
    return template;
  }

  private addClarification(template: PromptTemplate): PromptTemplate {
    // Ajouter des clarifications au template
    const clarifications = [
      'Please provide a detailed response.',
      'Be specific and thorough in your answer.',
      'Consider all relevant aspects.',
      'Explain your reasoning clearly.'
    ];

    const clarification = clarifications[Math.floor(Math.random() * clarifications.length)];
    template.template += '\n\n' + clarification;
    
    return template;
  }

  private removeRedundancy(template: PromptTemplate): PromptTemplate {
    // Supprimer les répétitions
    let cleaned = template.template;
    
    // Supprimer les phrases répétées
    const sentences = cleaned.split('.').filter(s => s.trim().length > 0);
    const uniqueSentences = [...new Set(sentences)];
    
    cleaned = uniqueSentences.join('. ') + (sentences.length > 0 ? '.' : '');
    template.template = cleaned;
    
    return template;
  }

  private improveStructure(template: PromptTemplate): PromptTemplate {
    // Améliorer la structure avec des paragraphes
    let improved = template.template;
    
    // Ajouter des paragraphes si trop long
    if (improved.length > 500 && !improved.includes('\n\n')) {
      const sentences = improved.split('. ');
      const midPoint = Math.floor(sentences.length / 2);
      
      improved = sentences.slice(0, midPoint).join('. ') + '.\n\n' + 
                sentences.slice(midPoint).join('. ') + '.';
    }
    
    template.template = improved;
    return template;
  }

  private addExamples(template: PromptTemplate): PromptTemplate {
    // Ajouter des exemples si absents
    if (template.examples.length === 0) {
      template.examples.push({
        id: crypto.randomUUID(),
        name: 'Example',
        description: 'Sample usage',
        variables: {},
        expectedOutput: 'Sample output',
        createdAt: new Date()
      });
    }
    
    return template;
  }

  private randomizeWordOrder(template: string): string {
    // Randomiser légèrement l'ordre des mots (conservateur)
    const words = template.split(' ');
    if (words.length < 10) return template;
    
    // Échanger quelques mots adjacents
    const result = [...words];
    for (let i = 0; i < result.length - 1; i += 3) {
      if (Math.random() < 0.3) {
        [result[i], result[i + 1]] = [result[i + 1], result[i]];
      }
    }
    
    return result.join(' ');
  }

  private hasClearStructure(template: string): boolean {
    // Vérifier la structure claire
    return (
      template.includes('\n') || // Paragraphes
      template.includes(':') || // Instructions
      template.includes('-') || // Listes
      template.length < 2000 // Pas trop long
    );
  }
}
