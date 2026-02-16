/**
 * Multi-Factor Authentication (MFA) — TOTP-based.
 *
 * Implements RFC 6238 TOTP (Time-based One-Time Password) using
 * Node.js built-in crypto. No external dependencies required.
 *
 * Usage:
 *   const secret = mfaService.generateSecret(userId)
 *   const uri    = mfaService.getOTPAuthURI(userId, secret)  // for QR code
 *   const valid  = mfaService.verifyTOTP(userId, '123456')
 */

import crypto from 'crypto'

export interface MFASetup {
  secret: string
  otpauthURI: string
  backupCodes: string[]
}

interface MFARecord {
  userId: string
  secret: string
  enabled: boolean
  backupCodes: string[]
  verifiedAt?: Date
}

export class MFAService {
  private records: Map<string, MFARecord> = new Map()
  private issuer: string
  private digits: number
  private period: number
  private window: number

  constructor(options?: {
    issuer?: string
    digits?: number
    period?: number
    window?: number
  }) {
    this.issuer = options?.issuer || 'TwinMCP'
    this.digits = options?.digits || 6
    this.period = options?.period || 30
    this.window = options?.window || 1 // allow ±1 period for clock drift
  }

  /**
   * Generate a new MFA secret for a user and return setup info.
   * The secret is stored but MFA is not enabled until `enableMFA()` is called
   * after the user verifies a code.
   */
  generateSecret(userId: string): MFASetup {
    const secret = this.generateBase32Secret(20)
    const backupCodes = this.generateBackupCodes(8)

    this.records.set(userId, {
      userId,
      secret,
      enabled: false,
      backupCodes,
    })

    return {
      secret,
      otpauthURI: this.getOTPAuthURI(userId, secret),
      backupCodes,
    }
  }

  /**
   * Enable MFA for a user after they verify a TOTP code.
   * Returns true if the code is valid and MFA is now enabled.
   */
  enableMFA(userId: string, code: string): boolean {
    const record = this.records.get(userId)
    if (!record) return false

    if (!this.verifyCode(record.secret, code)) return false

    record.enabled = true
    record.verifiedAt = new Date()
    this.records.set(userId, record)
    return true
  }

  /** Disable MFA for a user. */
  disableMFA(userId: string): boolean {
    const record = this.records.get(userId)
    if (!record) return false
    record.enabled = false
    this.records.set(userId, record)
    return true
  }

  /** Check if MFA is enabled for a user. */
  isMFAEnabled(userId: string): boolean {
    return this.records.get(userId)?.enabled === true
  }

  /**
   * Verify a TOTP code for a user.
   * Also accepts backup codes (single-use).
   */
  verifyTOTP(userId: string, code: string): boolean {
    const record = this.records.get(userId)
    if (!record || !record.enabled) return false

    // Check TOTP
    if (this.verifyCode(record.secret, code)) return true

    // Check backup codes
    const backupIdx = record.backupCodes.indexOf(code)
    if (backupIdx !== -1) {
      record.backupCodes.splice(backupIdx, 1) // single-use
      this.records.set(userId, record)
      return true
    }

    return false
  }

  /** Get remaining backup codes count. */
  getBackupCodesCount(userId: string): number {
    return this.records.get(userId)?.backupCodes.length || 0
  }

  /** Regenerate backup codes for a user. */
  regenerateBackupCodes(userId: string): string[] | null {
    const record = this.records.get(userId)
    if (!record) return null
    record.backupCodes = this.generateBackupCodes(8)
    this.records.set(userId, record)
    return record.backupCodes
  }

  // ── TOTP Core ──────────────────────────────────────────────

  private verifyCode(secret: string, code: string): boolean {
    const now = Math.floor(Date.now() / 1000)

    // Check current period ± window
    for (let i = -this.window; i <= this.window; i++) {
      const counter = Math.floor((now + i * this.period) / this.period)
      const expected = this.generateTOTP(secret, counter)
      if (expected === code) return true
    }

    return false
  }

  private generateTOTP(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8)
    buffer.writeUInt32BE(0, 0)
    buffer.writeUInt32BE(counter, 4)

    const decodedSecret = this.base32Decode(secret)
    const hmac = crypto.createHmac('sha1', decodedSecret)
    hmac.update(buffer)
    const hash = hmac.digest()

    const offset = hash[hash.length - 1] & 0x0f
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)

    const otp = binary % Math.pow(10, this.digits)
    return otp.toString().padStart(this.digits, '0')
  }

  /** Get the current TOTP code for a secret (for testing). */
  getCurrentCode(secret: string): string {
    const counter = Math.floor(Date.now() / 1000 / this.period)
    return this.generateTOTP(secret, counter)
  }

  // ── Helpers ────────────────────────────────────────────────

  private getOTPAuthURI(userId: string, secret: string): string {
    const label = encodeURIComponent(`${this.issuer}:${userId}`)
    const params = new URLSearchParams({
      secret,
      issuer: this.issuer,
      algorithm: 'SHA1',
      digits: String(this.digits),
      period: String(this.period),
    })
    return `otpauth://totp/${label}?${params.toString()}`
  }

  private generateBase32Secret(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    const bytes = crypto.randomBytes(length)
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % 32]
    }
    return result
  }

  private base32Decode(input: string): Buffer {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = ''
    for (const c of input.toUpperCase()) {
      const val = chars.indexOf(c)
      if (val === -1) continue
      bits += val.toString(2).padStart(5, '0')
    }
    const bytes: number[] = []
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2))
    }
    return Buffer.from(bytes)
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase()
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
    }
    return codes
  }
}

export const mfaService = new MFAService()
