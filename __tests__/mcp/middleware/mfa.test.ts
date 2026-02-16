import { MFAService } from '../../../lib/mcp/middleware/mfa'

describe('MFAService', () => {
  let mfa: MFAService

  beforeEach(() => {
    mfa = new MFAService({ issuer: 'TestMCP' })
  })

  describe('Secret generation', () => {
    it('generates a secret with otpauth URI and backup codes', () => {
      const setup = mfa.generateSecret('user-1')
      expect(setup.secret).toBeDefined()
      expect(setup.secret.length).toBe(20)
      expect(setup.otpauthURI).toContain('otpauth://totp/')
      expect(setup.otpauthURI).toContain('TestMCP')
      expect(setup.backupCodes.length).toBe(8)
    })

    it('backup codes are in XXXX-XXXX format', () => {
      const setup = mfa.generateSecret('user-1')
      for (const code of setup.backupCodes) {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/)
      }
    })
  })

  describe('MFA lifecycle', () => {
    it('MFA is not enabled by default after generateSecret', () => {
      mfa.generateSecret('user-1')
      expect(mfa.isMFAEnabled('user-1')).toBe(false)
    })

    it('enableMFA succeeds with valid TOTP code', () => {
      const setup = mfa.generateSecret('user-1')
      const code = mfa.getCurrentCode(setup.secret)
      expect(mfa.enableMFA('user-1', code)).toBe(true)
      expect(mfa.isMFAEnabled('user-1')).toBe(true)
    })

    it('enableMFA fails with invalid code', () => {
      mfa.generateSecret('user-1')
      expect(mfa.enableMFA('user-1', '000000')).toBe(false)
      expect(mfa.isMFAEnabled('user-1')).toBe(false)
    })

    it('disableMFA works', () => {
      const setup = mfa.generateSecret('user-1')
      const code = mfa.getCurrentCode(setup.secret)
      mfa.enableMFA('user-1', code)
      expect(mfa.disableMFA('user-1')).toBe(true)
      expect(mfa.isMFAEnabled('user-1')).toBe(false)
    })

    it('disableMFA returns false for unknown user', () => {
      expect(mfa.disableMFA('unknown')).toBe(false)
    })
  })

  describe('TOTP verification', () => {
    it('verifies a valid TOTP code', () => {
      const setup = mfa.generateSecret('user-1')
      const code = mfa.getCurrentCode(setup.secret)
      mfa.enableMFA('user-1', code)

      const newCode = mfa.getCurrentCode(setup.secret)
      expect(mfa.verifyTOTP('user-1', newCode)).toBe(true)
    })

    it('rejects an invalid TOTP code', () => {
      const setup = mfa.generateSecret('user-1')
      const code = mfa.getCurrentCode(setup.secret)
      mfa.enableMFA('user-1', code)

      expect(mfa.verifyTOTP('user-1', '999999')).toBe(false)
    })

    it('returns false if MFA is not enabled', () => {
      mfa.generateSecret('user-1')
      expect(mfa.verifyTOTP('user-1', '123456')).toBe(false)
    })

    it('returns false for unknown user', () => {
      expect(mfa.verifyTOTP('unknown', '123456')).toBe(false)
    })
  })

  describe('Backup codes', () => {
    it('accepts a valid backup code (single-use)', () => {
      const setup = mfa.generateSecret('user-1')
      const code = mfa.getCurrentCode(setup.secret)
      mfa.enableMFA('user-1', code)

      const backupCode = setup.backupCodes[0]
      expect(mfa.verifyTOTP('user-1', backupCode)).toBe(true)
      // Second use should fail
      expect(mfa.verifyTOTP('user-1', backupCode)).toBe(false)
    })

    it('getBackupCodesCount decreases after use', () => {
      const setup = mfa.generateSecret('user-1')
      const code = mfa.getCurrentCode(setup.secret)
      mfa.enableMFA('user-1', code)

      expect(mfa.getBackupCodesCount('user-1')).toBe(8)
      mfa.verifyTOTP('user-1', setup.backupCodes[0])
      expect(mfa.getBackupCodesCount('user-1')).toBe(7)
    })

    it('regenerateBackupCodes returns new codes', () => {
      const setup = mfa.generateSecret('user-1')
      const newCodes = mfa.regenerateBackupCodes('user-1')
      expect(newCodes).not.toBeNull()
      expect(newCodes!.length).toBe(8)
      // Should be different from original
      expect(newCodes).not.toEqual(setup.backupCodes)
    })

    it('regenerateBackupCodes returns null for unknown user', () => {
      expect(mfa.regenerateBackupCodes('unknown')).toBeNull()
    })
  })
})
