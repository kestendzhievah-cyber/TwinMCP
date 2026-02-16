import { SSOService } from '../../../lib/mcp/middleware/sso'

describe('SSOService', () => {
  let sso: SSOService

  beforeEach(() => {
    sso = new SSOService({ spEntityId: 'urn:test:sp' })
  })

  describe('Provider management', () => {
    it('registers a SAML provider', () => {
      const provider = sso.registerSAMLProvider('okta', 'Okta', {
        entityId: 'urn:okta:idp',
        ssoUrl: 'https://okta.example.com/sso',
        sloUrl: 'https://okta.example.com/slo',
        certificate: 'MIIC...',
        callbackUrl: 'https://app.example.com/auth/saml/callback',
        attributeMapping: { email: 'email', name: 'displayName', groups: 'groups' },
      })

      expect(provider.id).toBe('okta')
      expect(provider.type).toBe('saml')
      expect(provider.enabled).toBe(true)
    })

    it('registers an OIDC provider', () => {
      const provider = sso.registerOIDCProvider('azure', 'Azure AD', {
        clientId: 'client-123',
        clientSecret: 'secret-456',
        issuer: 'https://login.microsoftonline.com/tenant',
        authorizationUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
        callbackUrl: 'https://app.example.com/auth/oidc/callback',
        scopes: ['openid', 'profile', 'email'],
      })

      expect(provider.type).toBe('oidc')
    })

    it('lists all providers', () => {
      sso.registerSAMLProvider('okta', 'Okta', {
        entityId: 'urn:okta', ssoUrl: 'https://okta/sso', certificate: 'cert',
        callbackUrl: 'https://app/callback', attributeMapping: { email: 'email' },
      })
      sso.registerOIDCProvider('azure', 'Azure', {
        clientId: 'c', clientSecret: 's', issuer: 'i',
        authorizationUrl: 'a', tokenUrl: 't', userInfoUrl: 'u',
        callbackUrl: 'cb', scopes: ['openid'],
      })

      expect(sso.getProviders().length).toBe(2)
    })

    it('enables and disables a provider', () => {
      sso.registerSAMLProvider('okta', 'Okta', {
        entityId: 'urn:okta', ssoUrl: 'https://okta/sso', certificate: 'cert',
        callbackUrl: 'https://app/callback', attributeMapping: { email: 'email' },
      })

      expect(sso.setProviderEnabled('okta', false)).toBe(true)
      expect(sso.getProvider('okta')?.enabled).toBe(false)
    })

    it('removes a provider', () => {
      sso.registerSAMLProvider('okta', 'Okta', {
        entityId: 'urn:okta', ssoUrl: 'https://okta/sso', certificate: 'cert',
        callbackUrl: 'https://app/callback', attributeMapping: { email: 'email' },
      })

      expect(sso.removeProvider('okta')).toBe(true)
      expect(sso.getProviders().length).toBe(0)
    })

    it('returns false for unknown provider operations', () => {
      expect(sso.setProviderEnabled('unknown', true)).toBe(false)
      expect(sso.removeProvider('unknown')).toBe(false)
    })
  })

  describe('SAML AuthnRequest', () => {
    beforeEach(() => {
      sso.registerSAMLProvider('okta', 'Okta', {
        entityId: 'urn:okta:idp',
        ssoUrl: 'https://okta.example.com/sso',
        certificate: 'MIIC...',
        callbackUrl: 'https://app.example.com/auth/saml/callback',
        attributeMapping: { email: 'email' },
      })
    })

    it('creates a SAML AuthnRequest with redirect URL', () => {
      const result = sso.createSAMLAuthnRequest('okta')
      expect(result).not.toBeNull()
      expect(result!.redirectUrl).toContain('https://okta.example.com/sso')
      expect(result!.redirectUrl).toContain('SAMLRequest=')
      expect(result!.requestId).toBeDefined()
    })

    it('returns null for unknown provider', () => {
      expect(sso.createSAMLAuthnRequest('unknown')).toBeNull()
    })

    it('returns null for disabled provider', () => {
      sso.setProviderEnabled('okta', false)
      expect(sso.createSAMLAuthnRequest('okta')).toBeNull()
    })
  })

  describe('SAML Response processing', () => {
    beforeEach(() => {
      sso.registerSAMLProvider('okta', 'Okta', {
        entityId: 'urn:okta:idp',
        ssoUrl: 'https://okta.example.com/sso',
        certificate: 'MIIC...',
        callbackUrl: 'https://app.example.com/auth/saml/callback',
        attributeMapping: { email: 'email', name: 'displayName' },
      })
    })

    it('extracts email from SAML response', () => {
      const xml = `<samlp:Response><saml:Assertion><saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>alice@example.com</saml:AttributeValue></saml:Attribute><saml:Attribute Name="displayName"><saml:AttributeValue>Alice</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion></samlp:Response>`
      const b64 = Buffer.from(xml).toString('base64')

      const result = sso.processSAMLResponse('okta', b64)
      expect(result.success).toBe(true)
      expect(result.email).toBe('alice@example.com')
      expect(result.name).toBe('Alice')
    })

    it('returns error when email is missing', () => {
      const xml = `<samlp:Response><saml:Assertion><saml:AttributeStatement></saml:AttributeStatement></saml:Assertion></samlp:Response>`
      const b64 = Buffer.from(xml).toString('base64')

      const result = sso.processSAMLResponse('okta', b64)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Email not found')
    })

    it('returns error for unknown provider', () => {
      const result = sso.processSAMLResponse('unknown', 'dGVzdA==')
      expect(result.success).toBe(false)
    })
  })

  describe('Session management', () => {
    it('creates and validates a session', () => {
      const session = sso.createSession('user-1', 'okta', 'alice@example.com', 'Alice', ['admin'])
      expect(session.id).toBeDefined()
      expect(session.email).toBe('alice@example.com')

      const validated = sso.validateSession(session.id)
      expect(validated).not.toBeNull()
      expect(validated!.userId).toBe('user-1')
    })

    it('returns null for unknown session', () => {
      expect(sso.validateSession('unknown')).toBeNull()
    })

    it('destroys a session', () => {
      const session = sso.createSession('user-1', 'okta', 'alice@example.com')
      expect(sso.destroySession(session.id)).toBe(true)
      expect(sso.validateSession(session.id)).toBeNull()
    })

    it('expires sessions', async () => {
      const ssoShort = new SSOService({ sessionDurationMs: 1 })
      const session = ssoShort.createSession('user-1', 'okta', 'alice@example.com')

      // Wait for expiry
      await new Promise(r => setTimeout(r, 10))
      const validated = ssoShort.validateSession(session.id)
      expect(validated).toBeNull()
    })

    it('getActiveSessionCount returns correct count', () => {
      sso.createSession('user-1', 'okta', 'alice@example.com')
      sso.createSession('user-2', 'okta', 'bob@example.com')
      expect(sso.getActiveSessionCount()).toBe(2)
    })
  })

  describe('Single Logout (SLO)', () => {
    it('creates SLO request', () => {
      sso.registerSAMLProvider('okta', 'Okta', {
        entityId: 'urn:okta:idp',
        ssoUrl: 'https://okta.example.com/sso',
        sloUrl: 'https://okta.example.com/slo',
        certificate: 'MIIC...',
        callbackUrl: 'https://app.example.com/auth/saml/callback',
        attributeMapping: { email: 'email' },
      })

      const session = sso.createSession('user-1', 'okta', 'alice@example.com')
      const result = sso.createSLORequest(session.id)

      expect(result).not.toBeNull()
      expect(result!.redirectUrl).toContain('https://okta.example.com/slo')
      expect(result!.redirectUrl).toContain('SAMLRequest=')

      // Session should be destroyed
      expect(sso.validateSession(session.id)).toBeNull()
    })

    it('returns null for unknown session', () => {
      expect(sso.createSLORequest('unknown')).toBeNull()
    })
  })

  describe('SP Metadata', () => {
    it('generates valid SP metadata XML', () => {
      const metadata = sso.getSPMetadata('https://app.example.com/auth/saml/callback')
      expect(metadata).toContain('urn:test:sp')
      expect(metadata).toContain('AssertionConsumerService')
      expect(metadata).toContain('https://app.example.com/auth/saml/callback')
    })
  })
})
