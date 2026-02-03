import crypto from 'crypto';

export class KeyManagementService {
  private keys: Map<string, Buffer> = new Map();

  async getEncryptionKey(keyId: string): Promise<Buffer> {
    let key = this.keys.get(keyId);
    if (!key) {
      // Fallback to environment variable for build time
      const envKey = process.env.ENCRYPTION_KEY ?? process.env.BILLING_ENCRYPTION_KEY;
      if (envKey) {
        key = Buffer.from(envKey.padEnd(32, '0').slice(0, 32));
        this.keys.set(keyId, key);
        return key;
      }
      throw new Error(`Encryption key not found: ${keyId}`);
    }
    return key;
  }

  async storeEncryptionKey(keyId: string, key: Buffer): Promise<void> {
    this.keys.set(keyId, key);
  }

  async deleteEncryptionKey(keyId: string): Promise<void> {
    this.keys.delete(keyId);
  }

  generateKey(): Buffer {
    return crypto.randomBytes(32);
  }
}
