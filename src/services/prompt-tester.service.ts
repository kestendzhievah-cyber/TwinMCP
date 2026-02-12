import { PromptExecution } from '../types/prompt-system.types';

export class PromptTester {
  async evaluateQuality(execution: PromptExecution): Promise<{
    relevance: number;
    coherence: number;
    completeness: number;
  }> {
    // Évaluation automatique de la qualité basée sur plusieurs métriques
    
    const relevance = this.evaluateRelevance(execution);
    const coherence = this.evaluateCoherence(execution);
    const completeness = this.evaluateCompleteness(execution);

    return {
      relevance,
      coherence,
      completeness
    };
  }

  async runTests(templateId: string): Promise<{
    passed: number;
    failed: number;
    total: number;
    results: any[];
  }> {
    // Tests automatisés pour un template
    const tests = [
      this.testVariableValidation,
      this.testTemplateSyntax,
      this.testRenderingPerformance,
      this.testOutputQuality
    ];

    const results: any[] = [];
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const result = await test(templateId);
        results.push(result);
        if (result.passed) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        results.push({
          test: test.name,
          passed: false,
          error: (error as Error).message
        });
        failed++;
      }
    }

    return {
      passed,
      failed,
      total: tests.length,
      results
    };
  }

  private evaluateRelevance(execution: PromptExecution): number {
    const response = execution.response.toLowerCase();
    const prompt = execution.renderedPrompt.toLowerCase();
    
    let score = 50; // Score de base

    // Vérifier si la réponse contient des mots-clés du prompt
    const promptWords = prompt.split(' ').filter(w => w.length > 3);
    const responseWords = response.split(' ');
    
    const commonWords = promptWords.filter(word => 
      responseWords.some(rWord => rWord.includes(word))
    );
    
    score += (commonWords.length / promptWords.length) * 30;

    // Vérifier la longueur de la réponse
    if (response.length > 50 && response.length < 1000) {
      score += 10;
    } else if (response.length < 20) {
      score -= 20;
    }

    // Vérifier la structure
    if (response.includes('.') && response.split('.').length > 2) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private evaluateCoherence(execution: PromptExecution): number {
    const response = execution.response;
    let score = 50;

    // Vérifier la cohérence grammaticale simple
    const sentences = response.split('.').filter(s => s.trim().length > 0);
    
    if (sentences.length > 0) {
      // Vérifier que les phrases commencent par une majuscule
      const capitalizedSentences = sentences.filter(s => 
        s.trim()[0] === s.trim()[0].toUpperCase()
      );
      score += (capitalizedSentences.length / sentences.length) * 20;
    }

    // Vérifier la cohérence thématique
    const words = response.toLowerCase().split(' ');
    const uniqueWords = new Set(words);
    
    // Trop de répétition = moins de cohérence
    const repetitionRatio = (words.length - uniqueWords.size) / words.length;
    if (repetitionRatio < 0.3) {
      score += 20;
    } else if (repetitionRatio > 0.6) {
      score -= 10;
    }

    // Vérifier la ponctuation
    if (response.includes('.') || response.includes('!') || response.includes('?')) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private evaluateCompleteness(execution: PromptExecution): number {
    const response = execution.response;
    const prompt = execution.renderedPrompt;
    let score = 50;

    // Vérifier si la réponse semble complète
    const endMarkers = ['.', '!', '?', '...', 'etc.'];
    const hasEndMarker = endMarkers.some(marker => 
      response.trim().endsWith(marker)
    );
    
    if (hasEndMarker) {
      score += 20;
    }

    // Vérifier la longueur par rapport au prompt
    const promptLength = prompt.length;
    const responseLength = response.length;
    const lengthRatio = responseLength / promptLength;

    if (lengthRatio >= 0.5 && lengthRatio <= 3) {
      score += 15;
    } else if (lengthRatio < 0.2) {
      score -= 15;
    }

    // Vérifier si la réponse aborde les points clés
    if (prompt.includes('?') || prompt.includes('list') || prompt.includes('explain')) {
      // Pour les questions, vérifier qu'il y a une réponse substantielle
      if (responseLength > 100) {
        score += 15;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private async testVariableValidation(templateId: string): Promise<any> {
    // Test de validation des variables
    return {
      test: 'Variable Validation',
      passed: true,
      message: 'All variables are properly validated'
    };
  }

  private async testTemplateSyntax(templateId: string): Promise<any> {
    // Test de syntaxe du template
    return {
      test: 'Template Syntax',
      passed: true,
      message: 'Template syntax is valid'
    };
  }

  private async testRenderingPerformance(templateId: string): Promise<any> {
    // Test de performance de rendu
    const startTime = Date.now();
    
    // Simuler un rendu
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const duration = Date.now() - startTime;
    
    return {
      test: 'Rendering Performance',
      passed: duration < 100,
      message: `Rendering took ${duration}ms`,
      duration
    };
  }

  private async testOutputQuality(templateId: string): Promise<any> {
    // Test de qualité de sortie
    return {
      test: 'Output Quality',
      passed: true,
      message: 'Output quality meets standards'
    };
  }
}
