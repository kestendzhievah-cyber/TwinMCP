/**
 * Centralized Secrets Management
 *
 * Validates that all required environment variables are present at startup,
 * provides typed access to secrets, and masks sensitive values in logs.
 *
 * Usage:
 *   import { secrets, validateSecrets } from '@/lib/secrets'
 *   validateSecrets()          // call once at app startup — throws if critical vars missing
 *   secrets.DATABASE_URL       // typed access
 *   secrets.get('MY_VAR')      // dynamic access with fallback
 */

export interface SecretDefinition {
  /** Environment variable name */
  key: string
  /** Whether the app cannot start without this value */
  required: boolean
  /** Default value when not required and not set */
  defaultValue?: string
  /** Human-readable description for error messages */
  description: string
  /** If true, value is masked in logs/diagnostics (default true) */
  sensitive?: boolean
  /** Optional regex pattern the value must match */
  pattern?: RegExp
}

const SECRET_DEFINITIONS: SecretDefinition[] = [
  // ── Database ──────────────────────────────────────────────
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string',
    sensitive: true,
  },
  // ── Redis ─────────────────────────────────────────────────
  {
    key: 'REDIS_URL',
    required: false,
    defaultValue: 'redis://localhost:6379',
    description: 'Redis connection string',
    sensitive: true,
  },
  // ── Auth ──────────────────────────────────────────────────
  {
    key: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT signing (min 32 chars)',
    sensitive: true,
    pattern: /^.{32,}$/,
  },
  {
    key: 'NEXTAUTH_SECRET',
    required: false,
    description: 'NextAuth.js secret',
    sensitive: true,
  },
  // ── LLM Providers ────────────────────────────────────────
  {
    key: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key',
    sensitive: true,
    pattern: /^sk-/,
  },
  {
    key: 'ANTHROPIC_API_KEY',
    required: false,
    description: 'Anthropic API key',
    sensitive: true,
  },
  {
    key: 'GOOGLE_API_KEY',
    required: false,
    description: 'Google Gemini API key',
    sensitive: true,
  },
  // ── Stripe ───────────────────────────────────────────────
  {
    key: 'STRIPE_SECRET_KEY',
    required: false,
    description: 'Stripe secret key',
    sensitive: true,
    pattern: /^sk_(test|live)_/,
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook signing secret',
    sensitive: true,
  },
  // ── Firebase ─────────────────────────────────────────────
  {
    key: 'FIREBASE_PROJECT_ID',
    required: false,
    description: 'Firebase project ID',
    sensitive: false,
  },
  // ── App ──────────────────────────────────────────────────
  {
    key: 'NEXT_PUBLIC_APP_URL',
    required: false,
    defaultValue: 'http://localhost:3000',
    description: 'Public application URL',
    sensitive: false,
  },
  {
    key: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    description: 'Node environment',
    sensitive: false,
  },
]

export interface ValidationError {
  key: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * Validate all secret definitions against current environment.
 * Returns a result object; does NOT throw.
 */
export function checkSecrets(): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  for (const def of SECRET_DEFINITIONS) {
    const value = process.env[def.key]

    if (!value && def.required) {
      errors.push({
        key: def.key,
        message: `Missing required secret: ${def.key} — ${def.description}`,
      })
      continue
    }

    if (!value && !def.required) {
      if (!def.defaultValue) {
        warnings.push({
          key: def.key,
          message: `Optional secret not set: ${def.key} — ${def.description}`,
        })
      }
      continue
    }

    if (value && def.pattern && !def.pattern.test(value)) {
      errors.push({
        key: def.key,
        message: `Secret ${def.key} does not match expected pattern — ${def.description}`,
      })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate secrets and throw if any required secrets are missing.
 * Call this once at application startup.
 */
export function validateSecrets(): void {
  const result = checkSecrets()

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn(`[secrets] WARNING: ${w.message}`)
    }
  }

  if (!result.valid) {
    const summary = result.errors.map(e => `  - ${e.message}`).join('\n')
    throw new Error(
      `[secrets] Missing or invalid secrets:\n${summary}\n\n` +
      `Set these environment variables before starting the application.`
    )
  }
}

/**
 * Mask a secret value for safe logging (show first 4 and last 2 chars).
 */
export function maskSecret(value: string): string {
  if (!value || value.length <= 8) return '****'
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 6, 20))}${value.slice(-2)}`
}

/**
 * Get a diagnostic summary of all secrets (values masked).
 */
export function getSecretsDiagnostic(): Array<{
  key: string
  status: 'set' | 'default' | 'missing'
  masked?: string
}> {
  return SECRET_DEFINITIONS.map(def => {
    const value = process.env[def.key]
    if (value) {
      return {
        key: def.key,
        status: 'set' as const,
        masked: def.sensitive !== false ? maskSecret(value) : value,
      }
    }
    if (def.defaultValue) {
      return { key: def.key, status: 'default' as const, masked: def.defaultValue }
    }
    return { key: def.key, status: 'missing' as const }
  })
}

/**
 * Typed secrets accessor with defaults applied.
 */
class SecretsAccessor {
  get DATABASE_URL(): string {
    return this.getRequired('DATABASE_URL')
  }
  get REDIS_URL(): string {
    return this.get('REDIS_URL', 'redis://localhost:6379')
  }
  get JWT_SECRET(): string {
    return this.getRequired('JWT_SECRET')
  }
  get OPENAI_API_KEY(): string {
    return this.get('OPENAI_API_KEY', '')
  }
  get ANTHROPIC_API_KEY(): string {
    return this.get('ANTHROPIC_API_KEY', '')
  }
  get GOOGLE_API_KEY(): string {
    return this.get('GOOGLE_API_KEY', '')
  }
  get STRIPE_SECRET_KEY(): string {
    return this.get('STRIPE_SECRET_KEY', '')
  }
  get STRIPE_WEBHOOK_SECRET(): string {
    return this.get('STRIPE_WEBHOOK_SECRET', '')
  }
  get NODE_ENV(): string {
    return this.get('NODE_ENV', 'development')
  }
  get NEXT_PUBLIC_APP_URL(): string {
    return this.get('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  }

  /** Get an env var with a fallback. */
  get(key: string, fallback: string = ''): string {
    return process.env[key] || fallback
  }

  /** Get a required env var — throws if missing. */
  getRequired(key: string): string {
    const value = process.env[key]
    if (!value) {
      throw new Error(`[secrets] Required secret ${key} is not set`)
    }
    return value
  }
}

export const secrets = new SecretsAccessor()
