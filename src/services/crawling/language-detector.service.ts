/**
 * Language Detection Service.
 *
 * Detects the natural language of text content using multiple signals:
 *   - Character set analysis (Unicode ranges)
 *   - Common word frequency matching
 *   - N-gram analysis
 *   - Script detection (Latin, CJK, Arabic, Cyrillic, etc.)
 *
 * Supports: English, French, Spanish, German, Portuguese, Italian,
 *           Dutch, Russian, Chinese, Japanese, Korean, Arabic.
 */

export interface LanguageResult {
  language: string
  code: string
  confidence: number
  script: string
}

export interface DetectionResult {
  primary: LanguageResult
  alternatives: LanguageResult[]
  isReliable: boolean
  textLength: number
}

// Common words per language (top frequency words)
const LANGUAGE_PROFILES: Record<string, { code: string; words: string[]; script: string }> = {
  english: {
    code: 'en',
    script: 'latin',
    words: ['the', 'is', 'and', 'of', 'to', 'in', 'that', 'it', 'for', 'was', 'on', 'are', 'with', 'as', 'this', 'be', 'at', 'have', 'from', 'or', 'an', 'by', 'not', 'but', 'what', 'all', 'were', 'when', 'can', 'there', 'use', 'each', 'which', 'do', 'how', 'if', 'will', 'other', 'about', 'many'],
  },
  french: {
    code: 'fr',
    script: 'latin',
    words: ['le', 'la', 'les', 'de', 'des', 'un', 'une', 'et', 'est', 'en', 'que', 'qui', 'dans', 'ce', 'il', 'pas', 'ne', 'sur', 'se', 'au', 'du', 'par', 'pour', 'avec', 'sont', 'plus', 'son', 'mais', 'nous', 'cette', 'ou', 'leur', 'comme', 'tout', 'fait', 'peut', 'ses', 'aussi', 'entre', 'avoir'],
  },
  spanish: {
    code: 'es',
    script: 'latin',
    words: ['el', 'la', 'de', 'en', 'y', 'que', 'los', 'del', 'las', 'un', 'por', 'con', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'pero', 'sus', 'le', 'ya', 'fue', 'este', 'ha', 'desde', 'son', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'ser', 'tiene', 'también', 'nos', 'uno', 'hasta', 'todo'],
  },
  german: {
    code: 'de',
    script: 'latin',
    words: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über'],
  },
  portuguese: {
    code: 'pt',
    script: 'latin',
    words: ['de', 'que', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela'],
  },
  italian: {
    code: 'it',
    script: 'latin',
    words: ['di', 'che', 'il', 'la', 'in', 'un', 'del', 'per', 'non', 'una', 'con', 'sono', 'da', 'si', 'le', 'al', 'dei', 'ha', 'anche', 'più', 'questo', 'ma', 'come', 'nel', 'lo', 'suo', 'gli', 'della', 'alla', 'essere', 'tutti', 'tra', 'era', 'stato', 'molto', 'dopo', 'quella', 'fatto', 'quando', 'ogni'],
  },
  dutch: {
    code: 'nl',
    script: 'latin',
    words: ['de', 'het', 'een', 'van', 'en', 'in', 'is', 'dat', 'op', 'te', 'zijn', 'voor', 'met', 'die', 'niet', 'aan', 'er', 'maar', 'om', 'ook', 'als', 'dan', 'bij', 'nog', 'uit', 'wel', 'naar', 'kan', 'tot', 'werd', 'over', 'hun', 'heeft', 'worden', 'door', 'deze', 'meer', 'zou', 'geen', 'jaar'],
  },
  russian: {
    code: 'ru',
    script: 'cyrillic',
    words: ['и', 'в', 'не', 'на', 'что', 'он', 'с', 'как', 'это', 'но', 'по', 'из', 'за', 'то', 'все', 'от', 'так', 'его', 'же', 'для', 'бы', 'или', 'мы', 'до', 'если', 'уже', 'при', 'ещё', 'нет', 'был'],
  },
}

// Unicode script ranges
const SCRIPT_RANGES: Record<string, [number, number][]> = {
  latin: [[0x0041, 0x024F], [0x1E00, 0x1EFF]],
  cyrillic: [[0x0400, 0x04FF], [0x0500, 0x052F]],
  arabic: [[0x0600, 0x06FF], [0x0750, 0x077F]],
  cjk: [[0x4E00, 0x9FFF], [0x3400, 0x4DBF]],
  hiragana: [[0x3040, 0x309F]],
  katakana: [[0x30A0, 0x30FF]],
  hangul: [[0xAC00, 0xD7AF], [0x1100, 0x11FF]],
  devanagari: [[0x0900, 0x097F]],
}

export class LanguageDetectorService {
  /**
   * Detect the language of a text.
   */
  detect(text: string): DetectionResult {
    const cleaned = this.cleanText(text)

    if (cleaned.length < 5) {
      return {
        primary: { language: 'unknown', code: 'und', confidence: 0, script: 'unknown' },
        alternatives: [],
        isReliable: false,
        textLength: cleaned.length,
      }
    }

    // 1. Detect script
    const script = this.detectScript(cleaned)

    // 2. Handle non-Latin scripts directly
    if (script === 'cyrillic') {
      return this.buildResult('russian', 'ru', 'cyrillic', 0.85, cleaned.length)
    }
    if (script === 'arabic') {
      return this.buildResult('arabic', 'ar', 'arabic', 0.85, cleaned.length)
    }
    if (script === 'hangul') {
      return this.buildResult('korean', 'ko', 'hangul', 0.9, cleaned.length)
    }
    if (script === 'cjk' || script === 'hiragana' || script === 'katakana') {
      // Distinguish Chinese vs Japanese
      const hasKana = this.hasScript(cleaned, 'hiragana') || this.hasScript(cleaned, 'katakana')
      if (hasKana) return this.buildResult('japanese', 'ja', 'cjk', 0.85, cleaned.length)
      return this.buildResult('chinese', 'zh', 'cjk', 0.8, cleaned.length)
    }

    // 3. Latin script — use word frequency matching
    const scores = this.scoreLanguages(cleaned)
    scores.sort((a, b) => b.confidence - a.confidence)

    if (scores.length === 0) {
      return {
        primary: { language: 'unknown', code: 'und', confidence: 0, script },
        alternatives: [],
        isReliable: false,
        textLength: cleaned.length,
      }
    }

    const primary = scores[0]
    const alternatives = scores.slice(1, 4)
    const isReliable = primary.confidence >= 0.3 &&
      (alternatives.length === 0 || primary.confidence - (alternatives[0]?.confidence || 0) > 0.05)

    return {
      primary,
      alternatives,
      isReliable,
      textLength: cleaned.length,
    }
  }

  /**
   * Detect language code only (shorthand).
   */
  detectCode(text: string): string {
    return this.detect(text).primary.code
  }

  /**
   * Check if text is in a specific language.
   */
  isLanguage(text: string, langCode: string): boolean {
    const result = this.detect(text)
    return result.primary.code === langCode && result.isReliable
  }

  // ── Script Detection ───────────────────────────────────────

  /** Detect the dominant script of the text. */
  detectScript(text: string): string {
    const counts: Record<string, number> = {}

    for (const char of text) {
      const code = char.codePointAt(0)!
      for (const [script, ranges] of Object.entries(SCRIPT_RANGES)) {
        for (const [start, end] of ranges) {
          if (code >= start && code <= end) {
            counts[script] = (counts[script] || 0) + 1
            break
          }
        }
      }
    }

    let bestScript = 'latin'
    let bestCount = 0
    for (const [script, count] of Object.entries(counts)) {
      if (count > bestCount) { bestCount = count; bestScript = script }
    }

    return bestScript
  }

  private hasScript(text: string, scriptName: string): boolean {
    const ranges = SCRIPT_RANGES[scriptName]
    if (!ranges) return false

    for (const char of text) {
      const code = char.codePointAt(0)!
      for (const [start, end] of ranges) {
        if (code >= start && code <= end) return true
      }
    }
    return false
  }

  // ── Word Frequency Scoring ─────────────────────────────────

  private scoreLanguages(text: string): LanguageResult[] {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length >= 2)
    if (words.length === 0) return []

    const results: LanguageResult[] = []

    for (const [language, profile] of Object.entries(LANGUAGE_PROFILES)) {
      const wordSet = new Set(profile.words)
      let matches = 0

      for (const word of words) {
        if (wordSet.has(word)) matches++
      }

      const confidence = matches / words.length

      if (confidence > 0) {
        results.push({
          language,
          code: profile.code,
          confidence: Math.min(confidence * 3, 1.0), // Scale up since common words are a fraction
          script: profile.script,
        })
      }
    }

    return results
  }

  // ── Helpers ────────────────────────────────────────────────

  private cleanText(text: string): string {
    return text
      .replace(/https?:\/\/\S+/g, '') // Remove URLs
      .replace(/[0-9]+/g, '') // Remove numbers
      .replace(/[^\p{L}\s]/gu, ' ') // Keep only letters and spaces
      .replace(/\s+/g, ' ')
      .trim()
  }

  private buildResult(language: string, code: string, script: string, confidence: number, textLength: number): DetectionResult {
    return {
      primary: { language, code, confidence, script },
      alternatives: [],
      isReliable: confidence >= 0.5,
      textLength,
    }
  }
}

export const languageDetectorService = new LanguageDetectorService()
