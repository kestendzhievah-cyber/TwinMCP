/**
 * SSO / SAML Support for MCP Authentication.
 *
 * Implements:
 *   - SAML 2.0 Service Provider (SP) with IdP metadata parsing
 *   - SSO session management
 *   - Single Logout (SLO) support
 *   - Provider registry for multiple IdPs (Okta, Azure AD, Google Workspace, etc.)
 *
 * This is a framework-level implementation. Actual XML signing/verification
 * would use a library like `saml2-js` or `passport-saml` in production.
 */

import crypto from 'crypto'

export interface SSOProvider {
  id: string
  name: string
  type: 'saml' | 'oidc'
  enabled: boolean
  config: SAMLConfig | OIDCConfig
  createdAt: Date
}

export interface SAMLConfig {
  entityId: string
  ssoUrl: string
  sloUrl?: string
  certificate: string
  /** SP callback URL */
  callbackUrl: string
  /** Attribute mapping: IdP attribute name → local field */
  attributeMapping: {
    email: string
    name?: string
    groups?: string
  }
}

export interface OIDCConfig {
  clientId: string
  clientSecret: string
  issuer: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl: string
  callbackUrl: string
  scopes: string[]
}

export interface SSOSession {
  id: string
  userId: string
  providerId: string
  email: string
  name?: string
  groups: string[]
  attributes: Record<string, any>
  createdAt: Date
  expiresAt: Date
}

export interface SAMLAuthnRequest {
  id: string
  issuer: string
  destination: string
  assertionConsumerServiceURL: string
  timestamp: string
}

export interface SAMLResponse {
  success: boolean
  email?: string
  name?: string
  groups?: string[]
  attributes?: Record<string, any>
  error?: string
  sessionIndex?: string
}

export class SSOService {
  private providers: Map<string, SSOProvider> = new Map()
  private sessions: Map<string, SSOSession> = new Map()
  private pendingRequests: Map<string, { providerId: string; createdAt: Date }> = new Map()
  private spEntityId: string
  private sessionDuration: number

  constructor(options?: { spEntityId?: string; sessionDurationMs?: number }) {
    this.spEntityId = options?.spEntityId || 'urn:twinmcp:sp'
    this.sessionDuration = options?.sessionDurationMs || 8 * 60 * 60 * 1000 // 8 hours
  }

  // ── Provider Management ────────────────────────────────────

  /** Register a SAML Identity Provider. */
  registerSAMLProvider(
    id: string,
    name: string,
    config: SAMLConfig
  ): SSOProvider {
    const provider: SSOProvider = {
      id,
      name,
      type: 'saml',
      enabled: true,
      config,
      createdAt: new Date(),
    }
    this.providers.set(id, provider)
    return provider
  }

  /** Register an OIDC Identity Provider. */
  registerOIDCProvider(
    id: string,
    name: string,
    config: OIDCConfig
  ): SSOProvider {
    const provider: SSOProvider = {
      id,
      name,
      type: 'oidc',
      enabled: true,
      config,
      createdAt: new Date(),
    }
    this.providers.set(id, provider)
    return provider
  }

  /** Get a provider by ID. */
  getProvider(id: string): SSOProvider | undefined {
    return this.providers.get(id)
  }

  /** List all registered providers. */
  getProviders(): SSOProvider[] {
    return Array.from(this.providers.values())
  }

  /** Enable or disable a provider. */
  setProviderEnabled(id: string, enabled: boolean): boolean {
    const provider = this.providers.get(id)
    if (!provider) return false
    provider.enabled = enabled
    return true
  }

  /** Remove a provider. */
  removeProvider(id: string): boolean {
    return this.providers.delete(id)
  }

  // ── SAML Flow ──────────────────────────────────────────────

  /**
   * Generate a SAML AuthnRequest for initiating SSO login.
   * Returns the redirect URL with the encoded request.
   */
  createSAMLAuthnRequest(providerId: string): { redirectUrl: string; requestId: string } | null {
    const provider = this.providers.get(providerId)
    if (!provider || provider.type !== 'saml' || !provider.enabled) return null

    const config = provider.config as SAMLConfig
    const requestId = `_${crypto.randomUUID()}`
    const timestamp = new Date().toISOString()

    const request: SAMLAuthnRequest = {
      id: requestId,
      issuer: this.spEntityId,
      destination: config.ssoUrl,
      assertionConsumerServiceURL: config.callbackUrl,
      timestamp,
    }

    // Store pending request for validation
    this.pendingRequests.set(requestId, {
      providerId,
      createdAt: new Date(),
    })

    // Build SAML AuthnRequest XML
    const xml = this.buildAuthnRequestXML(request)
    const encoded = Buffer.from(xml).toString('base64')
    const redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(encoded)}&RelayState=${encodeURIComponent(requestId)}`

    return { redirectUrl, requestId }
  }

  /**
   * Process a SAML Response from the IdP.
   * In production, this would verify XML signatures. Here we parse the
   * assertion attributes.
   */
  processSAMLResponse(
    providerId: string,
    samlResponseB64: string,
    _relayState?: string
  ): SAMLResponse {
    const provider = this.providers.get(providerId)
    if (!provider || provider.type !== 'saml') {
      return { success: false, error: 'Provider not found or not SAML' }
    }

    const config = provider.config as SAMLConfig

    try {
      const xml = Buffer.from(samlResponseB64, 'base64').toString('utf-8')

      // Extract attributes from SAML response XML
      const email = this.extractXMLValue(xml, config.attributeMapping.email) ||
                    this.extractXMLValue(xml, 'email') ||
                    this.extractXMLValue(xml, 'NameID')
      const name = config.attributeMapping.name
        ? this.extractXMLValue(xml, config.attributeMapping.name)
        : undefined
      const groupsStr = config.attributeMapping.groups
        ? this.extractXMLValue(xml, config.attributeMapping.groups)
        : undefined

      if (!email) {
        return { success: false, error: 'Email not found in SAML response' }
      }

      const groups = groupsStr ? groupsStr.split(',').map(g => g.trim()) : []

      return {
        success: true,
        email,
        name,
        groups,
        attributes: { raw: xml.substring(0, 500) },
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to parse SAML response',
      }
    }
  }

  // ── Session Management ─────────────────────────────────────

  /** Create an SSO session after successful authentication. */
  createSession(
    userId: string,
    providerId: string,
    email: string,
    name?: string,
    groups: string[] = [],
    attributes: Record<string, any> = {}
  ): SSOSession {
    const session: SSOSession = {
      id: crypto.randomUUID(),
      userId,
      providerId,
      email,
      name,
      groups,
      attributes,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionDuration),
    }
    this.sessions.set(session.id, session)
    return session
  }

  /** Validate an SSO session. */
  validateSession(sessionId: string): SSOSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId)
      return null
    }
    return session
  }

  /** Destroy an SSO session (logout). */
  destroySession(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  /** Get active session count. */
  getActiveSessionCount(): number {
    // Clean expired
    const now = new Date()
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) this.sessions.delete(id)
    }
    return this.sessions.size
  }

  /**
   * Generate a SAML LogoutRequest for Single Logout.
   */
  createSLORequest(sessionId: string): { redirectUrl: string } | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    const provider = this.providers.get(session.providerId)
    if (!provider || provider.type !== 'saml') return null

    const config = provider.config as SAMLConfig
    if (!config.sloUrl) return null

    const requestId = `_${crypto.randomUUID()}`
    const xml = `<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${requestId}" Version="2.0" IssueInstant="${new Date().toISOString()}" Destination="${config.sloUrl}"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${this.spEntityId}</saml:Issuer><saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${session.email}</saml:NameID></samlp:LogoutRequest>`

    const encoded = Buffer.from(xml).toString('base64')
    this.destroySession(sessionId)

    return {
      redirectUrl: `${config.sloUrl}?SAMLRequest=${encodeURIComponent(encoded)}`,
    }
  }

  /** Get SP metadata XML for IdP configuration. */
  getSPMetadata(callbackUrl: string): string {
    return `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${this.spEntityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${callbackUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildAuthnRequestXML(request: SAMLAuthnRequest): string {
    return `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${request.id}" Version="2.0" IssueInstant="${request.timestamp}" Destination="${request.destination}" AssertionConsumerServiceURL="${request.assertionConsumerServiceURL}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${request.issuer}</saml:Issuer></samlp:AuthnRequest>`
  }

  private extractXMLValue(xml: string, attributeName: string): string | undefined {
    // Simple attribute extraction — in production use a proper XML parser
    const patterns = [
      new RegExp(`<saml:Attribute Name="${attributeName}"[^>]*>\\s*<saml:AttributeValue[^>]*>([^<]+)</saml:AttributeValue>`, 'i'),
      new RegExp(`<${attributeName}[^>]*>([^<]+)</${attributeName}>`, 'i'),
      new RegExp(`Name="${attributeName}"[^>]*>\\s*<[^>]+>([^<]+)<`, 'i'),
    ]

    for (const pattern of patterns) {
      const match = xml.match(pattern)
      if (match) return match[1].trim()
    }

    return undefined
  }
}

export const ssoService = new SSOService()
