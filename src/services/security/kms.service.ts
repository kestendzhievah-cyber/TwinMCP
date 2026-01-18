import crypto from 'crypto';

export class KeyManagementService {
  private keys: Map<string, Buffer> = new Map();

  async getEncryptionKey(keyId: string): Promise<Buffer> {
    const key = this.keys.get(keyId);
    if (!key) {
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
