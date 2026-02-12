import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

export interface ShareOptions {
  expiresAt?: Date;
  password?: string;
  permissions?: string[];
  maxViews?: number;
}

export interface Share {
  id: string;
  conversationId: string;
  createdBy: string;
  permissions: string[];
  password: string | null;
  expiresAt: Date | null;
  maxViews: number | null;
  currentViews: number;
  createdAt: Date;
  url: string;
  qrCode: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  metadata: any;
  settings: any;
  analytics: any;
  createdAt: Date;
  updatedAt: Date;
}

export class ShareService {
  constructor(private db: Pool) {}

  async createShare(
    conversationId: string,
    userId: string,
    options: ShareOptions
  ): Promise<Share> {
    const shareId = nanoid(10);
    const passwordHash = options.password ? await this.hashPassword(options.password) : null;

    const result = await this.db.query(
      `INSERT INTO shares (
        id, conversation_id, created_by, permissions, password, 
        expires_at, max_views, current_views, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *`,
      [
        shareId,
        conversationId,
        userId,
        JSON.stringify(options.permissions || ['read']),
        passwordHash,
        options.expiresAt || null,
        options.maxViews || null,
        0
      ]
    );

    const share = result.rows[0];
    
    return {
      id: share.id,
      conversationId: share.conversation_id,
      createdBy: share.created_by,
      permissions: JSON.parse(share.permissions),
      password: share.password,
      expiresAt: share.expires_at,
      maxViews: share.max_views,
      currentViews: share.current_views,
      createdAt: share.created_at,
      url: this.generateShareUrl(share.id),
      qrCode: await this.generateQRCode(share.id)
    };
  }

  async getSharedConversation(
    shareId: string,
    password?: string
  ): Promise<Conversation> {
    const shareResult = await this.db.query(
      `SELECT s.*, c.* FROM shares s
       JOIN conversations c ON s.conversation_id = c.id
       WHERE s.id = $1`,
      [shareId]
    );

    if (shareResult.rows.length === 0) {
      throw new Error('Share not found');
    }

    const share = shareResult.rows[0];

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      throw new Error('Share expired');
    }

    // Check max views
    if (share.max_views && share.current_views >= share.max_views) {
      throw new Error('Share view limit reached');
    }

    // Check password
    if (share.password) {
      if (!password || !(await this.verifyPassword(password, share.password))) {
        throw new Error('Invalid password');
      }
    }

    // Increment view count
    await this.db.query(
      'UPDATE shares SET current_views = current_views + 1 WHERE id = $1',
      [shareId]
    );

    return {
      id: share.id,
      userId: share.user_id,
      title: share.title,
      metadata: JSON.parse(share.metadata || '{}'),
      settings: JSON.parse(share.settings || '{}'),
      analytics: JSON.parse(share.analytics || '{}'),
      createdAt: share.created_at,
      updatedAt: share.updated_at
    };
  }

  async revokeShare(shareId: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM shares WHERE id = $1 AND created_by = $2',
      [shareId, userId]
    );
  }

  async getUserShares(userId: string): Promise<Share[]> {
    const result = await this.db.query(
      'SELECT * FROM shares WHERE created_by = $1 ORDER BY created_at DESC',
      [userId]
    );

    return Promise.all(result.rows.map(async (row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      createdBy: row.created_by,
      permissions: JSON.parse(row.permissions),
      password: row.password,
      expiresAt: row.expires_at,
      maxViews: row.max_views,
      currentViews: row.current_views,
      createdAt: row.created_at,
      url: this.generateShareUrl(row.id),
      qrCode: await this.generateQRCode(row.id)
    })));
  }

  private generateShareUrl(shareId: string): string {
    return `${process.env.APP_URL || 'http://localhost:3000'}/share/${shareId}`;
  }

  private async generateQRCode(shareId: string): Promise<string> {
    const url = this.generateShareUrl(shareId);
    return await QRCode.toDataURL(url);
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}
