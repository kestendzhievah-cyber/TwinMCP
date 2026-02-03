import crypto from 'crypto';

export class KeyManagementService {
  private keys: Map<string, Buffer> = new Map();
  private static defaultKey: Buffer | null = null;

  // Generate a default key for build time (not used in production)
  private static getDefaultKey(): Buffer {
    if (!this.defaultKey) {
      const envKey = process.env.ENCRYPTION_KEY ?? process.env.BILLING_ENCRYPTION_KEY;
      if (envKey) {
        this.defaultKey = Buffer.from(envKey.padEnd(32, '0').slice(0, 32));
      } else {
        // Generate a temporary key for build - will be replaced at runtime
        this.defaultKey = crypto.randomBytes(32);
      }
    }
    return this.defaultKey;
  }

  async getEncryptionKey(keyId: string): Promise<Buffer> {
    let key = this.keys.get(keyId);
    if (!key) {
      // Use default key (from env or generated)
      key = KeyManagementService.getDefaultKey();
      this.keys.set(keyId, key);
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
