import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { Pool } from 'pg';

export class WebSocketService {
  private io: Server;
  private documents: Map<string, Y.Doc>;

  constructor(server: any, private db: Pool) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
      }
    });

    this.documents = new Map();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', async (socket: Socket) => {
      const userId = await this.authenticateSocket(socket);

      if (!userId) {
        socket.disconnect();
        return;
      }

      // Join conversation room
      socket.on('join-conversation', async (conversationId: string) => {
        const hasAccess = await this.checkAccess(userId, conversationId);

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`conversation:${conversationId}`);

        // Send current users in conversation
        const users = await this.getActiveUsers(conversationId);
        socket.emit('users-update', users);

        // Broadcast user joined
        socket.to(`conversation:${conversationId}`).emit('user-joined', {
          userId,
          timestamp: new Date()
        });
      });

      // Handle typing indicator
      socket.on('typing-start', (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit('user-typing', {
          userId,
          typing: true
        });
      });

      socket.on('typing-stop', (conversationId: string) => {
        socket.to(`conversation:${conversationId}`).emit('user-typing', {
          userId,
          typing: false
        });
      });

      // Handle collaborative editing
      socket.on('sync-update', async (data: {
        conversationId: string;
        update: Uint8Array;
      }) => {
        const doc = this.getOrCreateDocument(data.conversationId);
        Y.applyUpdate(doc, new Uint8Array(data.update));

        // Broadcast to other users
        socket.to(`conversation:${data.conversationId}`).emit('sync-update', {
          update: data.update,
          userId
        });

        // Persist to database
        await this.persistDocument(data.conversationId, doc);
      });

      // Handle cursor position
      socket.on('cursor-update', (data: {
        conversationId: string;
        position: number;
      }) => {
        socket.to(`conversation:${data.conversationId}`).emit('cursor-update', {
          userId,
          position: data.position
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.io.emit('user-left', { userId });
      });
    });
  }

  private getOrCreateDocument(conversationId: string): Y.Doc {
    if (!this.documents.has(conversationId)) {
      const doc = new Y.Doc();
      this.documents.set(conversationId, doc);
    }
    return this.documents.get(conversationId)!;
  }

  private async persistDocument(conversationId: string, doc: Y.Doc): Promise<void> {
    const state = Y.encodeStateAsUpdate(doc);

    await this.db.query(
      `INSERT INTO conversation_states (conversation_id, state, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (conversation_id) 
       DO UPDATE SET state = $2, updated_at = NOW()`,
      [conversationId, Buffer.from(state)]
    );
  }

  private async authenticateSocket(socket: Socket): Promise<string | null> {
    // Extract token from handshake
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return null;
    }

    // TODO: Verify JWT token and extract userId
    // For now, return a mock userId
    return 'mock-user-id';
  }

  private async checkAccess(userId: string, conversationId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    return result.rows.length > 0;
  }

  private async getActiveUsers(conversationId: string): Promise<string[]> {
    const room = this.io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
    
    if (!room) {
      return [];
    }

    // TODO: Map socket IDs to user IDs
    return Array.from(room);
  }
}
