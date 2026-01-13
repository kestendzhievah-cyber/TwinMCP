import { ParsedQuery, QueryEntity } from '../types/library.types';
import { TextUtils } from '../utils/text-utils';

export class QueryParserService {
  private readonly COMMON_PATTERNS = {
    js_frameworks: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'],
    python_frameworks: ['django', 'flask', 'fastapi', 'tornado'],
    rust_crates: ['tokio', 'serde', 'axum', 'warp', 'rocket'],
    node_libraries: ['express', 'koa', 'fastify', 'hapi', 'nest'],
    php_frameworks: ['laravel', 'symfony', 'codeigniter', 'yii']
  };

  private readonly ECOSYSTEM_PATTERNS = {
    npm: /^(npm|node|js|javascript)/i,
    pip: /^(pip|python|py)/i,
    cargo: /^(cargo|rust|rs)/i,
    composer: /^(composer|php)/i,
    maven: /^(maven|java|jar)/i,
    gem: /^(gem|ruby|rb)/i
  };

  parseQuery(query: string, context?: any): ParsedQuery {
    const normalized = TextUtils.normalizeQuery(query);
    const tokens = TextUtils.tokenize(normalized);
    const entities = this.extractEntities(tokens);
    const ecosystem = this.detectEcosystem(normalized, context);
    const language = this.detectLanguage(normalized, context, ecosystem);

    return {
      original: query,
      normalized,
      tokens,
      entities,
      ecosystem,
      language,
      confidence: this.calculateConfidence(normalized, entities)
    };
  }

  private extractEntities(tokens: string[]): QueryEntity[] {
    const entities: QueryEntity[] = [];

    tokens.forEach((token, index) => {
      // Vérifier les patterns connus
      for (const [category, patterns] of Object.entries(this.COMMON_PATTERNS)) {
        if (patterns.includes(token)) {
          entities.push({
            type: 'framework',
            value: token,
            category,
            position: index,
            confidence: 1.0
          });
        }
      }

      // Extraire les versions
      const versionMatch = token.match(/^(\d+\.)*\d+$/);
      if (versionMatch) {
        entities.push({
          type: 'version',
          value: token,
          position: index,
          confidence: 0.9
        });
      }

      // Extraire les noms de bibliothèques potentiels
      if (TextUtils.looksLikeLibraryName(token)) {
        entities.push({
          type: 'library',
          value: token,
          position: index,
          confidence: TextUtils.calculateTokenConfidence(token)
        });
      }
    });

    return entities;
  }

  private detectEcosystem(query: string, context?: any): string | null {
    // Vérifier le contexte explicite
    if (context?.ecosystem) {
      return context.ecosystem;
    }

    // Détecter depuis la requête
    for (const [ecosystem, pattern] of Object.entries(this.ECOSYSTEM_PATTERNS)) {
      if (pattern.test(query)) {
        return ecosystem;
      }
    }

    return null;
  }

  private detectLanguage(query: string, context?: any, ecosystem?: string | null): string | null {
    // Vérifier le contexte explicite
    if (context?.language) {
      return context.language;
    }

    // Déduire depuis l'écosystème
    const ecosystemLanguageMap: Record<string, string> = {
      npm: 'javascript',
      pip: 'python',
      cargo: 'rust',
      composer: 'php',
      maven: 'java',
      gem: 'ruby'
    };

    if (ecosystem && ecosystemLanguageMap[ecosystem]) {
      return ecosystemLanguageMap[ecosystem];
    }

    // Détecter depuis les patterns dans la requête
    if (query.includes('javascript') || query.includes('js') || query.includes('node')) {
      return 'javascript';
    }
    if (query.includes('python') || query.includes('py')) {
      return 'python';
    }
    if (query.includes('rust') || query.includes('rs')) {
      return 'rust';
    }

    return null;
  }

  private calculateConfidence(normalized: string, entities: QueryEntity[]): number {
    let confidence = 0.5; // Base confidence

    // Bonus pour les entités reconnues
    const recognizedEntities = entities.filter(e => e.confidence > 0.8);
    confidence += recognizedEntities.length * 0.1;

    // Bonus pour la longueur appropriée
    if (normalized.length >= 3 && normalized.length <= 50) {
      confidence += 0.1;
    }

    // Bonus pour les formats standards
    if (/^[a-z][a-z0-9\-_]*$/.test(normalized)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}
