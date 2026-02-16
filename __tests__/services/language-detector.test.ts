import { LanguageDetectorService } from '../../src/services/crawling/language-detector.service'

describe('LanguageDetectorService', () => {
  let service: LanguageDetectorService

  beforeEach(() => {
    service = new LanguageDetectorService()
  })

  describe('English detection', () => {
    it('detects English text', () => {
      const result = service.detect('The quick brown fox jumps over the lazy dog. This is a test of the language detection system.')
      expect(result.primary.code).toBe('en')
      expect(result.primary.confidence).toBeGreaterThan(0.3)
      expect(result.isReliable).toBe(true)
    })

    it('detects English with isLanguage', () => {
      expect(service.isLanguage('This is a simple English sentence with common words for testing.', 'en')).toBe(true)
    })

    it('returns code shorthand', () => {
      expect(service.detectCode('The cat is on the table and the dog is in the garden.')).toBe('en')
    })
  })

  describe('French detection', () => {
    it('detects French text', () => {
      const result = service.detect('Le chat est sur la table et le chien est dans le jardin. Les enfants sont dans la maison.')
      expect(result.primary.code).toBe('fr')
      expect(result.isReliable).toBe(true)
    })
  })

  describe('Spanish detection', () => {
    it('detects Spanish text', () => {
      const result = service.detect('El gato está en la mesa y el perro está en el jardín. Los niños están en la casa.')
      expect(result.primary.code).toBe('es')
    })
  })

  describe('German detection', () => {
    it('detects German text', () => {
      const result = service.detect('Die Katze ist auf dem Tisch und der Hund ist im Garten. Die Kinder sind im Haus.')
      expect(result.primary.code).toBe('de')
    })
  })

  describe('Script-based detection', () => {
    it('detects Russian (Cyrillic)', () => {
      const result = service.detect('Привет мир. Это тестовое предложение на русском языке.')
      expect(result.primary.code).toBe('ru')
      expect(result.primary.script).toBe('cyrillic')
    })

    it('detects Chinese (CJK)', () => {
      const result = service.detect('这是一个中文测试句子。我们正在测试语言检测功能。')
      expect(result.primary.code).toBe('zh')
      expect(result.primary.script).toBe('cjk')
    })

    it('detects Japanese (with kana)', () => {
      const result = service.detect('これは日本語のテスト文です。言語検出をテストしています。')
      expect(result.primary.code).toBe('ja')
    })

    it('detects Korean (Hangul)', () => {
      const result = service.detect('이것은 한국어 테스트 문장입니다. 언어 감지를 테스트하고 있습니다.')
      expect(result.primary.code).toBe('ko')
      expect(result.primary.script).toBe('hangul')
    })
  })

  describe('Script detection', () => {
    it('detects Latin script', () => {
      expect(service.detectScript('Hello World')).toBe('latin')
    })

    it('detects Cyrillic script', () => {
      expect(service.detectScript('Привет мир')).toBe('cyrillic')
    })
  })

  describe('Short text handling', () => {
    it('returns unknown for very short text', () => {
      const result = service.detect('Hi')
      expect(result.primary.code).toBe('und')
      expect(result.isReliable).toBe(false)
    })

    it('returns unknown for empty text', () => {
      const result = service.detect('')
      expect(result.primary.code).toBe('und')
    })
  })

  describe('Alternatives', () => {
    it('provides alternative language candidates', () => {
      // Text with mixed signals
      const result = service.detect('The documentation is available in multiple languages for the users of the system.')
      expect(result.alternatives).toBeDefined()
      // Primary should be English
      expect(result.primary.code).toBe('en')
    })
  })

  describe('Text cleaning', () => {
    it('handles text with URLs and numbers', () => {
      const result = service.detect('Visit https://example.com for more information. The system has 42 features and is used by many organizations around the world.')
      expect(result.primary.code).toBe('en')
    })
  })
})
