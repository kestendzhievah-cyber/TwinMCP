import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.FIELD_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('FIELD_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required for field encryption')
  }
  // Derive a 32-byte key from the env var using scrypt
  return scryptSync(key, 'twinmcp-field-enc', 32)
}

/**
 * Encrypt a plaintext string for storage in the database.
 * Returns a base64 string containing salt + iv + authTag + ciphertext.
 */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const authTag = cipher.getAuthTag()

  // Pack: iv (16) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString('base64')
}

/**
 * Decrypt a base64 encrypted field back to plaintext.
 */
export function decryptField(encryptedBase64: string): string {
  const key = getEncryptionKey()
  const packed = Buffer.from(encryptedBase64, 'base64')

  const iv = packed.subarray(0, IV_LENGTH)
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Check if a string looks like it was encrypted by encryptField().
 * Used for migration: skip already-encrypted values.
 */
export function isEncryptedField(value: string): boolean {
  try {
    const buf = Buffer.from(value, 'base64')
    // Minimum: IV (16) + AuthTag (16) + at least 1 byte ciphertext
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1
      && value === buf.toString('base64') // valid base64 roundtrip
  } catch {
    return false
  }
}
