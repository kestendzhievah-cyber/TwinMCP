// Lazy-init singleton for conversation route services.
let _conversationService: any = null;

export async function getConversationService() {
  if (!_conversationService) {
    const { pool: db } = await import('@/lib/prisma');
    const { redis } = await import('@/lib/redis');
    const { ConversationService } = await import('@/src/services/conversation.service');
    _conversationService = new ConversationService(db, redis);
  }
  return _conversationService;
}
