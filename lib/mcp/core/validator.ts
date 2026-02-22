import { z } from 'zod'
import { ValidationResult } from '../core/types'
import { logger } from '@/lib/logger'

export class InputValidator {
  private schemas: Map<string, z.ZodSchema> = new Map()
  private globalSchemas: Map<string, z.ZodSchema> = new Map()

  // Enregistrer un schema pour un outil spécifique
  registerSchema(toolId: string, schema: z.ZodSchema): void {
    this.schemas.set(toolId, schema)
    logger.debug(`Schema registered for tool: ${toolId}`)
  }

  // Enregistrer un schema global (ex: pour l'authentification)
  registerGlobalSchema(name: string, schema: z.ZodSchema): void {
    this.globalSchemas.set(name, schema)
    logger.debug(`Global schema registered: ${name}`)
  }

  // Valider les arguments d'un outil
  async validate(toolId: string, args: any): Promise<ValidationResult> {
    const schema = this.schemas.get(toolId)
    if (!schema) {
      return {
        success: false,
        errors: [{
          path: 'tool',
          message: `No validation schema found for tool: ${toolId}`
        }]
      }
    }

    try {
      const validated = await schema.parseAsync(args)
      return { success: true, data: validated }
    } catch (error: any) {
      return {
        success: false,
        errors: error.errors?.map((e: any) => ({
          path: e.path.join('.'),
          message: this.formatValidationMessage(e)
        })) || [{
          path: 'unknown',
          message: 'Validation failed'
        }]
      }
    }
  }

  // Validation globale (ex: pour les requêtes API)
  async validateGlobal(name: string, data: any): Promise<ValidationResult> {
    const schema = this.globalSchemas.get(name)
    if (!schema) {
      return {
        success: false,
        errors: [{
          path: 'schema',
          message: `No global schema found: ${name}`
        }]
      }
    }

    try {
      const validated = await schema.parseAsync(data)
      return { success: true, data: validated }
    } catch (error: any) {
      return {
        success: false,
        errors: error.errors?.map((e: any) => ({
          path: e.path.join('.'),
          message: this.formatValidationMessage(e)
        })) || [{
          path: 'unknown',
          message: 'Global validation failed'
        }]
      }
    }
  }

  // Sanitisation des entrées
  sanitize(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input)
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitize(item))
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitize(value)
      }
      return sanitized
    }

    return input
  }

  // Validation de sécurité (XSS, injection SQL, etc.)
  async securityValidate(input: any): Promise<ValidationResult> {
    const issues: Array<{ path: string; message: string }> = []

    this.checkForSecurityIssues(input, '', issues)

    return {
      success: issues.length === 0,
      errors: issues.length > 0 ? issues : undefined
    }
  }

  private checkForSecurityIssues(obj: any, path: string, issues: Array<{ path: string; message: string }>): void {
    if (typeof obj === 'string') {
      // Vérifier les scripts XSS
      if (this.containsScript(obj)) {
        issues.push({
          path,
          message: 'Potentially dangerous script content detected'
        })
      }

      // Vérifier les injections SQL
      if (this.containsSQLInjection(obj)) {
        issues.push({
          path,
          message: 'Potential SQL injection detected'
        })
      }

      // Vérifier les paths traversant
      if (this.containsPathTraversal(obj)) {
        issues.push({
          path,
          message: 'Path traversal attempt detected'
        })
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.checkForSecurityIssues(item, `${path}[${index}]`, issues)
      })
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        this.checkForSecurityIssues(value, path ? `${path}.${key}` : key, issues)
      }
    }
  }

  private containsScript(str: string): boolean {
    const scriptPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi
    ]

    return scriptPatterns.some(pattern => pattern.test(str))
  }

  private containsSQLInjection(str: string): boolean {
    // Only match actual SQL injection patterns (keyword combos), not isolated words
    const sqlPatterns = [
      /\bunion\b\s+\bselect\b/gi,
      /\bselect\b\s+.+\bfrom\b/gi,
      /\binsert\b\s+\binto\b/gi,
      /\bupdate\b\s+\bset\b/gi,
      /\bdelete\b\s+\bfrom\b/gi,
      /\bdrop\b\s+(table|database|index)\b/gi,
      /\balter\b\s+table\b/gi,
      /\bexec\b\s*\(/gi,
      /;\s*(drop|alter|truncate|exec)\b/gi,
      /'\s*(or|and)\s+['0-9]/gi,
      /'\s*;\s*--/g
    ]

    return sqlPatterns.some(pattern => pattern.test(str))
  }

  private containsPathTraversal(str: string): boolean {
    const traversalPatterns = [
      /\.\.[\/\\]/g,
      /\.\.%2f/gi,
      /\.\.%5c/gi,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi
    ]

    return traversalPatterns.some(pattern => pattern.test(str))
  }

  private sanitizeString(str: string): string {
    // Supprimer les caractères de contrôle
    return str.replace(/[\x00-\x1F\x7F]/g, '').trim()
  }

  private formatValidationMessage(error: any): string {
    switch (error.code) {
      case 'invalid_type':
        return `Expected ${error.expected}, received ${error.received}`
      case 'invalid_string':
        if (error.validation === 'email') return 'Invalid email format'
        if (error.validation === 'url') return 'Invalid URL format'
        return 'Invalid string format'
      case 'too_small':
        return `Value is too small (minimum: ${error.minimum})`
      case 'too_big':
        return `Value is too large (maximum: ${error.maximum})`
      case 'invalid_enum_value':
        return `Invalid value. Expected one of: ${error.options.join(', ')}`
      default:
        return error.message || 'Validation failed'
    }
  }

  // Validation de batch (pour plusieurs outils à la fois)
  async validateBatch(toolArgs: Array<{ toolId: string; args: any }>): Promise<{
    results: Array<{ toolId: string; validation: ValidationResult }>
    overallSuccess: boolean
  }> {
    const results = await Promise.all(
      toolArgs.map(async ({ toolId, args }) => ({
        toolId,
        validation: await this.validate(toolId, args)
      }))
    )

    const overallSuccess = results.every(result => result.validation.success)

    return {
      results,
      overallSuccess
    }
  }

  // Obtenir le schema d'un outil (pour la documentation)
  getSchema(toolId: string): z.ZodSchema | null {
    return this.schemas.get(toolId) || null
  }

  // Obtenir tous les schemas (pour la documentation)
  getAllSchemas(): Array<{ toolId: string; schema: z.ZodSchema }> {
    return Array.from(this.schemas.entries()).map(([toolId, schema]) => ({
      toolId,
      schema
    }))
  }

  // Nettoyer les schemas
  clearSchemas(): void {
    this.schemas.clear()
    this.globalSchemas.clear()
    logger.debug('Validation schemas cleared')
  }
}

// Instance globale
export const validator = new InputValidator()

// Schémas globaux couramment utilisés
export const globalSchemas = {
  pagination: z.object({
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('asc')
  }),

  dateRange: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
    message: "Start date must be before end date",
    path: ["endDate"]
  }),

  contactInfo: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
    company: z.string().max(100).optional()
  }),

  apiKey: z.string().min(10).regex(/^[a-zA-Z0-9_-]+$/),

  jwt: z.string().min(10).regex(/^Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
}

// Enregistrer les schémas globaux
Object.entries(globalSchemas).forEach(([name, schema]) => {
  validator.registerGlobalSchema(name, schema)
})
