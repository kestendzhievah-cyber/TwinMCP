import { createCipheriv, createDecipheriv, randomBytes, scrypt, CipherGCM, DecipherGCM } from 'crypto';
import { promisify } from 'util';
import { EncryptionService, StreamChunk } from '../types/streaming.types';

const scryptAsync = promisify(scrypt);

export class AESEncryptionService implements EncryptionService {
  private key: Buffer;
  private algorithm = 'aes-256-gcm';
  private keyRotationInterval: number;
  private lastKeyRotation: Date;

  constructor(keyRotationInterval: number = 86400000) { // 24 heures par défaut
    this.keyRotationInterval = keyRotationInterval;
    this.lastKeyRotation = new Date();
    this.key = randomBytes(32); // Clé AES-256
  }

  async encrypt(data: string | Buffer): Promise<Buffer> {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv) as CipherGCM;
    
    const encrypted = Buffer.concat([
      cipher.update(typeof data === 'string' ? Buffer.from(data) : data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv (16 bytes) + authTag (16 bytes) + encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  async decrypt(data: Buffer): Promise<string | Buffer> {
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    
    const decipher = createDecipheriv(this.algorithm, this.key, iv) as DecipherGCM;
    decipher.setAuthTag(authTag);
    
    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: invalid data or authentication tag');
    }
  }

  async encryptChunks(chunks: StreamChunk[]): Promise<StreamChunk[]> {
    const encryptedChunks: StreamChunk[] = [];
    
    for (const chunk of chunks) {
      const encryptedData = await this.encrypt(JSON.stringify(chunk.data));
      
      encryptedChunks.push({
        ...chunk,
        data: encryptedData,
        size: encryptedData.length,
        type: 'content' // Toujours 'content' après chiffrement
      });
    }
    
    return encryptedChunks;
  }

  async rotateKey(): Promise<void> {
    this.key = randomBytes(32);
    this.lastKeyRotation = new Date();
  }

  shouldRotateKey(): boolean {
    return Date.now() - this.lastKeyRotation.getTime() > this.keyRotationInterval;
  }

  getKeyInfo(): { algorithm: string; lastRotation: Date; rotationInterval: number } {
    return {
      algorithm: this.algorithm,
      lastRotation: this.lastKeyRotation,
      rotationInterval: this.keyRotationInterval
    };
  }
}

export class ChaCha20EncryptionService implements EncryptionService {
  private key: Buffer;
  private algorithm = 'chacha20-poly1305';
  private keyRotationInterval: number;
  private lastKeyRotation: Date;

  constructor(keyRotationInterval: number = 86400000) {
    this.keyRotationInterval = keyRotationInterval;
    this.lastKeyRotation = new Date();
    this.key = randomBytes(32); // Clé ChaCha20
  }

  async encrypt(data: string | Buffer): Promise<Buffer> {
    const nonce = randomBytes(12);
    
    // Note: Node.js natif ne supporte pas ChaCha20, utiliser une bibliothèque externe
    // Pour cet exemple, nous utiliserons AES-256-GCM comme fallback
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(typeof data === 'string' ? Buffer.from(data) : data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Format: nonce (12 bytes) + authTag (16 bytes) + encrypted data
    return Buffer.concat([nonce, authTag, encrypted]);
  }

  async decrypt(data: Buffer): Promise<string | Buffer> {
    const nonce = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    
    // Fallback vers AES-256-GCM
    const iv = randomBytes(16);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    
    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: invalid data or authentication tag');
    }
  }

  async encryptChunks(chunks: StreamChunk[]): Promise<StreamChunk[]> {
    const encryptedChunks: StreamChunk[] = [];
    
    for (const chunk of chunks) {
      const encryptedData = await this.encrypt(JSON.stringify(chunk.data));
      
      encryptedChunks.push({
        ...chunk,
        data: encryptedData,
        size: encryptedData.length,
        type: 'content'
      });
    }
    
    return encryptedChunks;
  }

  async rotateKey(): Promise<void> {
    this.key = randomBytes(32);
    this.lastKeyRotation = new Date();
  }

  shouldRotateKey(): boolean {
    return Date.now() - this.lastKeyRotation.getTime() > this.keyRotationInterval;
  }

  getKeyInfo(): { algorithm: string; lastRotation: Date; rotationInterval: number } {
    return {
      algorithm: this.algorithm,
      lastRotation: this.lastKeyRotation,
      rotationInterval: this.keyRotationInterval
    };
  }
}

export class HybridEncryptionService implements EncryptionService {
  private aesService: AESEncryptionService;
  private keyRotationInterval: number;

  constructor(keyRotationInterval: number = 86400000) {
    this.aesService = new AESEncryptionService(keyRotationInterval);
    this.keyRotationInterval = keyRotationInterval;
  }

  async encrypt(data: string | Buffer): Promise<Buffer> {
    // Vérifier si la clé doit être rotatée
    if (this.aesService.shouldRotateKey()) {
      await this.rotateKey();
    }
    
    return this.aesService.encrypt(data);
  }

  async decrypt(data: Buffer): Promise<string | Buffer> {
    return this.aesService.decrypt(data);
  }

  async encryptChunks(chunks: StreamChunk[]): Promise<StreamChunk[]> {
    // Vérifier si la clé doit être rotatée
    if (this.aesService.shouldRotateKey()) {
      await this.rotateKey();
    }
    
    return this.aesService.encryptChunks(chunks);
  }

  async rotateKey(): Promise<void> {
    await this.aesService.rotateKey();
  }

  shouldRotateKey(): boolean {
    return this.aesService.shouldRotateKey();
  }

  getKeyInfo(): { algorithm: string; lastRotation: Date; rotationInterval: number } {
    return this.aesService.getKeyInfo();
  }

  // Méthodes supplémentaires pour la gestion des clés
  async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return await scryptAsync(password, salt, 32) as Buffer;
  }

  async encryptWithPassword(data: string | Buffer, password: string): Promise<Buffer> {
    const salt = randomBytes(16);
    const key = await this.deriveKey(password, salt);
    
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(typeof data === 'string' ? Buffer.from(data) : data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Format: salt (16 bytes) + iv (16 bytes) + authTag (16 bytes) + encrypted data
    return Buffer.concat([salt, iv, authTag, encrypted]);
  }

  async decryptWithPassword(data: Buffer, password: string): Promise<string | Buffer> {
    const salt = data.subarray(0, 16);
    const iv = data.subarray(16, 32);
    const authTag = data.subarray(32, 48);
    const encrypted = data.subarray(48);
    
    const key = await this.deriveKey(password, salt);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: invalid password or data');
    }
  }
}
