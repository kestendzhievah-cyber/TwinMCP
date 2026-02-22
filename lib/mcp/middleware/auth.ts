import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { AuthContext, AuthError, User, ApiKey, Permission } from './auth-types'
import { logger } from '@/lib/logger'

export class AuthService {
  private users: Map<string, User> = new Map()
  private apiKeys: Map<string, ApiKey> = new Map()
  private jwtSecret: string

  constructor() {
    const secret = process.env.JWT_SECRET
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    this.jwtSecret = secret || 'dev-only-secret-not-for-production'
    this.initializeDefaultUsers()
  }

  private initializeDefaultUsers(): void {
    // Only create default credentials in development/test environments
    if (process.env.NODE_ENV === 'production') {
      logger.info('Auth service initialized (production mode)')
      return
    }

    const devApiKey = process.env.MCP_DEV_API_KEY || `mcp-dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const defaultUser: User = {
      id: 'default-user',
      email: 'admin@localhost',
      name: 'Dev Admin',
      permissions: [
        {
          resource: 'global',
          actions: ['read', 'write', 'execute', 'admin']
        }
      ],
      rateLimit: {
        requests: 1000,
        period: '1h',
        strategy: 'sliding'
      },
      isActive: true,
      createdAt: new Date()
    }

    this.users.set(defaultUser.id, defaultUser)

    const defaultApiKey: ApiKey = {
      id: 'default-api-key',
      key: devApiKey,
      userId: defaultUser.id,
      name: 'Dev API Key',
      permissions: defaultUser.permissions,
      rateLimit: defaultUser.rateLimit,
      isActive: true,
      createdAt: new Date()
    }

    this.apiKeys.set(defaultApiKey.key, defaultApiKey)

    logger.info('Auth service initialized (dev mode)')
    logger.info(`   Dev API Key: ${devApiKey.substring(0, 12)}...`)
  }

  // Authentification par API Key
  async authenticateApiKey(apiKey: string): Promise<AuthContext> {
    const keyData = this.apiKeys.get(apiKey)

    if (!keyData) {
      throw this.createAuthError('Invalid API key', 'INVALID_API_KEY')
    }

    if (!keyData.isActive) {
      throw this.createAuthError('API key is inactive', 'INVALID_API_KEY')
    }

    if (keyData.expiresAt && new Date() > keyData.expiresAt) {
      throw this.createAuthError('API key has expired', 'EXPIRED_TOKEN')
    }

    const user = this.users.get(keyData.userId)
    if (!user || !user.isActive) {
      throw this.createAuthError('User not found or inactive', 'UNAUTHORIZED')
    }

    // Mettre à jour la dernière utilisation
    keyData.lastUsed = new Date()
    this.apiKeys.set(apiKey, keyData)

    user.lastLogin = new Date()
    this.users.set(user.id, user)

    return {
      userId: user.id,
      email: user.email,
      apiKey: keyData.key,
      permissions: keyData.permissions,
      rateLimit: keyData.rateLimit,
      isAuthenticated: true,
      authMethod: 'api_key'
    }
  }

  // Authentification par JWT
  async authenticateJWT(token: string): Promise<AuthContext> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any

      const user = this.users.get(decoded.userId)
      if (!user || !user.isActive) {
        throw this.createAuthError('User not found or inactive', 'UNAUTHORIZED')
      }

      return {
        userId: user.id,
        email: user.email,
        permissions: user.permissions,
        rateLimit: user.rateLimit,
        isAuthenticated: true,
        authMethod: 'jwt'
      }
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw this.createAuthError('Token has expired', 'EXPIRED_TOKEN')
      } else if (error.name === 'JsonWebTokenError') {
        throw this.createAuthError('Invalid token', 'INVALID_TOKEN')
      }
      throw this.createAuthError('Token verification failed', 'INVALID_TOKEN')
    }
  }

  // Authentification principale
  async authenticate(request: Request): Promise<AuthContext> {
    // 1. Vérifier l'API key
    const apiKey = this.getApiKeyFromRequest(request)
    if (apiKey) {
      return await this.authenticateApiKey(apiKey)
    }

    // 2. Vérifier le JWT token
    const token = this.getJWTFromRequest(request)
    if (token) {
      return await this.authenticateJWT(token)
    }

    // 3. Pas d'authentification - contexte anonyme
    return {
      userId: 'anonymous',
      permissions: [],
      rateLimit: {
        requests: 10,
        period: '1h',
        strategy: 'sliding'
      },
      isAuthenticated: false,
      authMethod: 'none'
    }
  }

  // Autorisation
  async authorize(
    context: AuthContext,
    toolId: string,
    action: string,
    cost?: number
  ): Promise<boolean> {
    // Si pas authentifié, seulement les actions anonymes limitées
    if (!context.isAuthenticated) {
      return action === 'read' && cost !== undefined && cost <= 0.001
    }

    // Vérifier les permissions
    const hasPermission = context.permissions.some(permission => {
      // Permission globale
      if (permission.resource === 'global') {
        return permission.actions.includes(action)
      }

      // Permission spécifique à l'outil
      if (permission.resource === toolId) {
        return permission.actions.includes(action)
      }

      return false
    })

    if (!hasPermission) {
      return false
    }

    // Vérifier les conditions de coût
    const costPermission = context.permissions.find(p =>
      p.resource === 'global' || p.resource === toolId
    )

    if (costPermission?.conditions?.maxCost !== undefined) {
      if (cost !== undefined && cost > costPermission.conditions.maxCost) {
        return false
      }
    }

    return true
  }

  // Générer un JWT token
  generateJWT(userId: string, expiresIn: string | number = '24h'): string {
    const payload = { userId, timestamp: Date.now() };
    return jwt.sign(payload, this.jwtSecret, { expiresIn } as any);
  }

  // Générer une clé API
  async generateApiKey(userId: string, name: string, permissions: Permission[]): Promise<string> {
    const user = this.users.get(userId)
    if (!user) {
      throw this.createAuthError('User not found', 'UNAUTHORIZED')
    }

    const apiKey = `mcp-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const keyData: ApiKey = {
      id: `key_${Date.now()}`,
      key: apiKey,
      userId,
      name,
      permissions,
      rateLimit: user.rateLimit,
      isActive: true,
      createdAt: new Date()
    }

    this.apiKeys.set(apiKey, keyData)

    return apiKey
  }

  // Créer un utilisateur
  async createUser(email: string, name: string, permissions: Permission[]): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      permissions,
      rateLimit: {
        requests: 1000,
        period: '1h',
        strategy: 'sliding'
      },
      isActive: true,
      createdAt: new Date()
    }

    this.users.set(user.id, user)
    return user
  }

  // Obtenir les méthodes d'authentification depuis la requête
  private getApiKeyFromRequest(request: Request): string | null {
    // 1. Header X-API-Key
    const apiKeyHeader = request.headers.get('x-api-key')
    if (apiKeyHeader) return apiKeyHeader

    // 2. Authorization header avec Bearer
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      if (token.startsWith('mcp-')) return token // C'est une clé API
    }

    return null
  }

  private getJWTFromRequest(request: Request): string | null {
    // 1. Authorization header
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      if (!token.startsWith('mcp-')) return token // C'est un JWT
    }

    // 2. Cookie
    const cookie = request.headers.get('cookie')
    if (cookie) {
      const jwtMatch = cookie.match(/jwt=([^;]+)/)
      if (jwtMatch) return jwtMatch[1]
    }

    return null
  }

  private createAuthError(message: string, code: AuthError['code']): AuthError {
    const error = new Error(message) as AuthError
    error.code = code
    error.statusCode = code === 'FORBIDDEN' ? 403 : 401
    return error
  }

  // Méthodes d'administration
  getUsers(): User[] {
    return Array.from(this.users.values())
  }

  getApiKeys(): ApiKey[] {
    return Array.from(this.apiKeys.values())
  }

  revokeApiKey(apiKey: string): boolean {
    const keyData = this.apiKeys.get(apiKey)
    if (keyData) {
      keyData.isActive = false
      this.apiKeys.set(apiKey, keyData)
      return true
    }
    return false
  }

  deactivateUser(userId: string): boolean {
    const user = this.users.get(userId)
    if (user) {
      user.isActive = false
      this.users.set(userId, user)
      return true
    }
    return false
  }
}

// Instance globale (lazy-initialized to avoid build-time crashes when JWT_SECRET is not set)
let _authService: AuthService | null = null
export function getAuthService(): AuthService {
  if (!_authService) {
    _authService = new AuthService()
  }
  return _authService
}
// Keep backward-compatible named export via getter
export const authService: AuthService = new Proxy({} as AuthService, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuthService(), prop, receiver)
  }
})
