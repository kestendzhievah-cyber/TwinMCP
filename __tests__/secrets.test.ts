import { checkSecrets, validateSecrets, maskSecret, getSecretsDiagnostic } from '../lib/secrets'

describe('Secrets Management', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('checkSecrets', () => {
    it('reports errors when required secrets are missing', () => {
      delete process.env.DATABASE_URL
      delete process.env.JWT_SECRET
      const result = checkSecrets()
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      const keys = result.errors.map(e => e.key)
      expect(keys).toContain('DATABASE_URL')
    })

    it('passes when required secrets are set', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.JWT_SECRET = 'a'.repeat(32)
      const result = checkSecrets()
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('reports pattern mismatch for JWT_SECRET shorter than 32 chars', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.JWT_SECRET = 'short'
      const result = checkSecrets()
      expect(result.valid).toBe(false)
      const jwtError = result.errors.find(e => e.key === 'JWT_SECRET')
      expect(jwtError).toBeDefined()
      expect(jwtError!.message).toContain('pattern')
    })

    it('reports pattern mismatch for OPENAI_API_KEY not starting with sk-', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.JWT_SECRET = 'a'.repeat(32)
      process.env.OPENAI_API_KEY = 'bad-key'
      const result = checkSecrets()
      expect(result.valid).toBe(false)
      const oaiError = result.errors.find(e => e.key === 'OPENAI_API_KEY')
      expect(oaiError).toBeDefined()
    })

    it('accepts valid OPENAI_API_KEY pattern', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.JWT_SECRET = 'a'.repeat(32)
      process.env.OPENAI_API_KEY = 'sk-abc123'
      const result = checkSecrets()
      expect(result.valid).toBe(true)
    })

    it('generates warnings for optional unset secrets', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.JWT_SECRET = 'a'.repeat(32)
      delete process.env.ANTHROPIC_API_KEY
      const result = checkSecrets()
      const warningKeys = result.warnings.map(w => w.key)
      expect(warningKeys).toContain('ANTHROPIC_API_KEY')
    })
  })

  describe('validateSecrets', () => {
    it('throws when required secrets are missing', () => {
      delete process.env.DATABASE_URL
      delete process.env.JWT_SECRET
      expect(() => validateSecrets()).toThrow('Missing or invalid secrets')
    })

    it('does not throw when required secrets are set', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.JWT_SECRET = 'a'.repeat(32)
      expect(() => validateSecrets()).not.toThrow()
    })
  })

  describe('maskSecret', () => {
    it('masks short values completely', () => {
      expect(maskSecret('abc')).toBe('****')
      expect(maskSecret('')).toBe('****')
    })

    it('shows first 4 and last 2 chars for longer values', () => {
      const masked = maskSecret('sk-1234567890abcdef')
      expect(masked.startsWith('sk-1')).toBe(true)
      expect(masked.endsWith('ef')).toBe(true)
      expect(masked).toContain('*')
    })
  })

  describe('getSecretsDiagnostic', () => {
    it('returns status for all defined secrets', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.JWT_SECRET = 'a'.repeat(32)
      const diag = getSecretsDiagnostic()
      expect(diag.length).toBeGreaterThan(0)

      const dbEntry = diag.find(d => d.key === 'DATABASE_URL')
      expect(dbEntry?.status).toBe('set')
      expect(dbEntry?.masked).toContain('****')

      const redisEntry = diag.find(d => d.key === 'REDIS_URL')
      // REDIS_URL has a default, so if not set it should show 'default'
      if (!process.env.REDIS_URL) {
        expect(redisEntry?.status).toBe('default')
      }
    })
  })
})
