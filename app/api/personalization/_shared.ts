// Lazy-init singleton for personalization route services.
let _personalizationService: any = null;

export async function getPersonalizationService() {
  if (!_personalizationService) {
    const { pool: db } = await import('@/lib/prisma');
    const { redis } = await import('@/lib/redis');
    const { PersonalizationService } = await import('@/src/services/personalization.service');
    _personalizationService = new PersonalizationService(db, redis);
  }
  return _personalizationService;
}
