export class TextUtils {
  private static readonly STOP_WORDS = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'mais', 'dans', 'sur', 'à', 'pour'
  ];

  static normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      // Remplacer les caractères spéciaux
      .replace(/[^\w\s\-@\/\.]/g, ' ')
      // Normaliser les séparateurs
      .replace(/[\s_\-]+/g, ' ')
      // Gérer les cas courants
      .replace(/^js /, 'javascript ')
      .replace(/^py /, 'python ')
      .replace(/^ts /, 'typescript ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static tokenize(query: string): string[] {
    return query
      .split(' ')
      .filter(token => token.length > 0)
      .filter(token => !this.isStopWord(token));
  }

  static isStopWord(token: string): boolean {
    return this.STOP_WORDS.includes(token.toLowerCase());
  }

  static looksLikeLibraryName(token: string): boolean {
    // Au moins 2 caractères, commence par une lettre
    if (token.length < 2 || !/^[a-zA-Z]/.test(token)) {
      return false;
    }

    // Contient uniquement des caractères valides pour les noms de package
    return /^[a-zA-Z0-9\-_\.]+$/.test(token);
  }

  static calculateTokenConfidence(token: string): number {
    let confidence = 0.5;

    // Bonus pour la longueur appropriée
    if (token.length >= 3 && token.length <= 20) {
      confidence += 0.2;
    }

    // Bonus pour les formats courants
    if (/^[a-z][a-z0-9]*$/.test(token)) {
      confidence += 0.2;
    }

    // Bonus pour les mots connus (placeholder pour l'instant)
    if (this.isKnownLibrary(token)) {
      confidence += 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  private static isKnownLibrary(token: string): boolean {
    // Placeholder - sera implémenté avec la base de données
    const knownLibraries = [
      'react', 'vue', 'angular', 'express', 'lodash', 'axios', 'moment',
      'django', 'flask', 'fastapi', 'requests', 'numpy', 'pandas',
      'tokio', 'serde', 'axum', 'warp', 'rocket', 'clap',
      'laravel', 'symfony', 'composer', 'guzzle'
    ];
    return knownLibraries.includes(token.toLowerCase());
  }

  static calculateLevenshteinDistance(str1: string, str2: string): number {
    // Implémentation simplifiée pour éviter les erreurs TypeScript
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;

    const matrix: number[][] = Array.from({ length: str2.length + 1 }, () =>
      Array(str1.length + 1).fill(0)
    );

    for (let i = 0; i <= str2.length; i++) {
      for (let j = 0; j <= str1.length; j++) {
        if (i === 0) {
          matrix[i]![j] = j;
        } else if (j === 0) {
          matrix[i]![j] = i;
        } else {
          const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
          const prevRow = matrix[i - 1] ?? [];
          const currentRow = matrix[i] ?? [];
          matrix[i]![j] = Math.min(
            (prevRow[j] ?? 0) + 1, // deletion
            (currentRow[j - 1] ?? 0) + 1, // insertion
            (prevRow[j - 1] ?? 0) + cost // substitution
          );
        }
      }
    }

    return matrix[str2.length]![str1.length] ?? 0;
  }

  static areSimilar(str1: string, str2: string, threshold: number = 2): boolean {
    return this.calculateLevenshteinDistance(str1.toLowerCase(), str2.toLowerCase()) <= threshold;
  }
}
