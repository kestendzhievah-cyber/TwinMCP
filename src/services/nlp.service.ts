import { NLPAnalysis } from '../types/context-intelligent.types';

export class NLPService {
  async analyzeIntent(query: string): Promise<NLPAnalysis['intent']> {
    const lowerQuery = query.toLowerCase();
    
    // Détection d'intention basique
    let intentType = 'question';
    let confidence = 0.5;
    let keywords: string[] = [];
    let category = 'general';
    let subcategory: string | undefined;

    // Patterns pour différents types d'intention
    const patterns = {
      question: [
        /^(comment|pourquoi|quand|où|comment|quel|quelle|quels|quelles|est-ce que|peut-on|puis-je|comment puis-je)/,
        /\?$/,
        /(aide|help|aidez-moi|s'il vous plaît)/
      ],
      example: [
        /(exemple|exemples|montrez|démontrez|illustrez|comment utiliser|tutorial|tuto)/,
        /(code|snippet|extrait de code)/
      ],
      explanation: [
        /(explique|explication|détails|plus d'informations|comprendre|clarifier)/,
        /(c'est quoi|qu'est-ce que|définir|définition)/
      ],
      troubleshooting: [
        /(erreur|problème|bug|issue|ne fonctionne pas|échec|échoue)/,
        /(corriger|réparer|solution|fix)/
      ],
      comparison: [
        /(différence|comparaison|versus|vs|ou|quel est meilleur)/,
        /(avantages|inconvénients|pour|contre)/
      ],
      tutorial: [
        /(étape|guide|pas à pas|comment faire|réaliser|implémenter)/,
        /(apprendre|former|s'initier)/
      ]
    };

    // Évaluation des patterns
    for (const [type, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        if (regex.test(lowerQuery)) {
          intentType = type;
          confidence = 0.8;
          break;
        }
      }
      if (confidence > 0.7) break;
    }

    // Extraction des mots-clés
    keywords = this.extractKeywords(lowerQuery);

    // Détermination de la catégorie
    category = this.determineCategory(lowerQuery, keywords);
    
    if (category === 'technology') {
      subcategory = this.determineTechnologySubcategory(lowerQuery, keywords);
    }

    return {
      type: intentType,
      confidence,
      keywords,
      category,
      subcategory
    };
  }

  async extractEntities(query: string): Promise<NLPAnalysis['entities']> {
    const entities: NLPAnalysis['entities'] = [];
    const lowerQuery = query.toLowerCase();

    // Patterns pour les entités
    const entityPatterns = {
      library: [
        /(react|vue|angular|express|next|nuxt|svelte|jquery|bootstrap|tailwind)/gi,
        /(npm|yarn|pnpm|webpack|vite|parcel)/gi,
        /(node|deno|bun)/gi
      ],
      function: [
        /(usestate|useeffect|usecontext|usereducer|usecallback|usememo)/gi,
        /(get|post|put|delete|patch)/gi,
        /(map|filter|reduce|foreach|find|some|every)/gi
      ],
      class: [
        /(component|service|controller|model|view|repository)/gi,
        /(array|object|string|number|boolean|date)/gi
      ],
      concept: [
        /(hook|state|props|context|reducer|middleware)/gi,
        /(api|rest|graphql|websocket|http|https)/gi,
        /(frontend|backend|fullstack|client|server)/gi
      ],
      technology: [
        /(javascript|typescript|python|java|c\+\+|c#|php|ruby|go|rust)/gi,
        /(html|css|scss|sass|less)/gi,
        /(json|xml|yaml|toml)/gi,
        /(sql|nosql|mongodb|postgresql|mysql|redis)/gi
      ],
      version: [
        /v?\d+\.\d+(\.\d+)?/gi,
        /(version|ver|v)\s*\d+/gi
      ]
    };

    // Extraction des entités
    for (const [type, patterns] of Object.entries(entityPatterns)) {
      for (const regex of patterns) {
        const matches = query.match(regex);
        if (matches) {
          matches.forEach(match => {
            const index = lowerQuery.indexOf(match.toLowerCase());
            if (index !== -1 && !entities.some(e => e.text === match)) {
              entities.push({
                text: match,
                type: type as any,
                confidence: 0.9,
                position: {
                  start: index,
                  end: index + match.length
                }
              });
            }
          });
        }
      }
    }

    return entities.sort((a, b) => b.confidence - a.confidence);
  }

  async generateSummary(data: {
    query: string;
    intent: NLPAnalysis['intent'];
    keyPoints: Array<{ content: string; source?: string; relevance: number }>;
    maxLength: number;
  }): Promise<string> {
    const { query, intent, keyPoints, maxLength } = data;
    
    let summary = `Basé sur votre ${intent.type === 'question' ? 'question' : 'demande'} "${query}", voici les points clés trouvés:\n\n`;
    
    // Ajout des points clés les plus pertinents
    const sortedPoints = keyPoints
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);

    sortedPoints.forEach((point, index) => {
      summary += `${index + 1}. ${point.content}`;
      if (point.source) {
        summary += ` (Source: ${point.source})`;
      }
      summary += '\n';
    });

    // Ajout de suggestions basées sur l'intention
    switch (intent.type) {
      case 'example':
        summary += '\nSouhaitez-vous des exemples de code concrets ?';
        break;
      case 'tutorial':
        summary += '\nVoulez-vous un guide pas à pas pour implémenter cela ?';
        break;
      case 'troubleshooting':
        summary += '\nBesoin d\'aide pour diagnostiquer un problème spécifique ?';
        break;
    }

    // Limitation de la longueur
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }

  async detectLanguage(text: string): Promise<string> {
    // Détection simple de langue basée sur les mots courants
    const frenchWords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'dans', 'pour', 'avec', 'par', 'sur', 'que', 'qui', 'ce', 'se', 'ne', 'me', 'te', 'lui', 'elle', 'il', 'nous', 'vous', 'ils', 'elles'];
    const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'on', 'be', 'at', 'by', 'this', 'have', 'from', 'or', 'one', 'had', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said'];

    const words = text.toLowerCase().split(/\s+/);
    let frenchScore = 0;
    let englishScore = 0;

    words.forEach(word => {
      if (frenchWords.includes(word)) frenchScore++;
      if (englishWords.includes(word)) englishScore++;
    });

    if (frenchScore > englishScore) return 'french';
    if (englishScore > frenchScore) return 'english';
    return 'unknown';
  }

  private extractKeywords(text: string): string[] {
    // Suppression des mots stop
    const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'dans', 'pour', 'avec', 'par', 'sur', 'que', 'qui', 'ce', 'se', 'ne', 'me', 'te', 'lui', 'elle', 'il', 'nous', 'vous', 'ils', 'elles', 'un', 'une', 'on', 'y', 'en', 'a', 'à', 'the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'on', 'be', 'at', 'by', 'this'];
    
    return text
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word.toLowerCase()))
      .slice(0, 10);
  }

  private determineCategory(text: string, keywords: string[]): string {
    if (keywords.some(k => ['react', 'vue', 'angular', 'frontend', 'ui', 'component'].includes(k))) {
      return 'frontend';
    }
    if (keywords.some(k => ['node', 'express', 'api', 'backend', 'server', 'database'].includes(k))) {
      return 'backend';
    }
    if (keywords.some(k => ['javascript', 'typescript', 'python', 'java', 'code', 'programming'].includes(k))) {
      return 'technology';
    }
    if (keywords.some(k => ['test', 'testing', 'debug', 'error', 'bug'].includes(k))) {
      return 'development';
    }
    return 'general';
  }

  private determineTechnologySubcategory(text: string, keywords: string[]): string | undefined {
    if (keywords.some(k => ['react', 'hooks', 'components', 'jsx'].includes(k))) {
      return 'react';
    }
    if (keywords.some(k => ['node', 'express', 'npm', 'package'].includes(k))) {
      return 'nodejs';
    }
    if (keywords.some(k => ['typescript', 'types', 'interface'].includes(k))) {
      return 'typescript';
    }
    if (keywords.some(k => ['css', 'style', 'tailwind', 'bootstrap'].includes(k))) {
      return 'styling';
    }
    return undefined;
  }
}
