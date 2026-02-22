import { logger } from '../../utils/logger';
import crypto from 'crypto';
import { KeyManagementService } from './kms.service';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days
  private currentKeyId: string = '';
  private currentKey: Buffer = Buffer.alloc(0);

  constructor(private kms: KeyManagementService) {
    this.initializeKeys();
    this.scheduleKeyRotation();
  }

  private async initializeKeys(): Promise<void> {
    this.currentKeyId = process.env.ENCRYPTION_KEY_ID || 'billing-default';
    this.currentKey = await this.kms.getEncryptionKey(this.currentKeyId);
  }

  async encrypt(data: string, context?: string): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.currentKey);
    cipher.setAAD(Buffer.from(context || ''));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyId: this.currentKeyId,
      algorithm: this.algorithm,
      timestamp: new Date().toISOString()
    };
  }

  async decrypt(encryptedData: EncryptedData, context?: string): Promise<string> {
    if (encryptedData.keyId !== this.currentKeyId) {
      this.currentKey = await this.kms.getEncryptionKey(encryptedData.keyId);
    }

    const decipher = crypto.createDecipher(this.algorithm, this.currentKey);
    decipher.setAAD(Buffer.from(context || ''));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async encryptPII(data: PII): Promise<EncryptedPII> {
    const encryptedFields: Record<string, any> = {};
    
    for (const [field, value] of Object.entries(data)) {
      if (this.isPIIField(field)) {
        encryptedFields[field] = await this.encrypt(value, field);
      } else {
        encryptedFields[field] = value;
      }
    }

    return {
      data: encryptedFields,
      encrypted: true,
      keyId: this.currentKeyId,
      timestamp: new Date().toISOString()
    };
  }

  async decryptPII(encryptedPII: EncryptedPII): Promise<PII> {
    const decryptedFields: Record<string, any> = {};
    
    for (const [field, value] of Object.entries(encryptedPII.data)) {
      if (this.isPIIField(field) && typeof value === 'object') {
        decryptedFields[field] = await this.decrypt(value, field);
      } else {
        decryptedFields[field] = value;
      }
    }

    return decryptedFields as PII;
  }

  private isPIIField(field: string): boolean {
    const piiFields = [
      'email', 'name', 'firstName', 'lastName', 'phone',
      'address', 'ssn', 'creditCard', 'bankAccount',
      'dateOfBirth', 'nationalId', 'passportNumber',
      'billingAddress', 'customerInfo'
    ];
    
    return piiFields.includes(field.toLowerCase());
  }

  private scheduleKeyRotation(): void {
    setInterval(async () => {
      await this.rotateKeys();
    }, this.keyRotationInterval);
  }

  private async rotateKeys(): Promise<void> {
    try {
      const newKeyId = `billing-key-${Date.now()}`;
      const newKey = crypto.randomBytes(32);
      
      await this.kms.storeEncryptionKey(newKeyId, newKey);
      
      setTimeout(async () => {
        this.currentKeyId = newKeyId;
        this.currentKey = newKey;
        
        setTimeout(async () => {
          await this.kms.deleteEncryptionKey(this.currentKeyId);
        }, 24 * 60 * 60 * 1000);
      }, 60000);
      
    } catch (error) {
      logger.error('Key rotation failed:', error);
    }
  }
}

interface EncryptedData {
  data: string;
  iv: string;
  authTag: string;
  keyId: string;
  algorithm: string;
  timestamp: string;
}

interface EncryptedPII {
  data: Record<string, any>;
  encrypted: boolean;
  keyId: string;
  timestamp: string;
}

interface PII {
  [key: string]: any;
}
