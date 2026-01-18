import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SearchCriteria {
  query?: string;
  language?: string;
  license?: string[];
  tags?: string[];
  minDownloads?: number;
  minQualityScore?: number;
  updatedAfter?: Date;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export class MultiCriteriaSearchService {
  async search(criteria: SearchCriteria): Promise<any[]> {
    const filters: any[] = [];
    
    if (criteria.query) {
      filters.push({
        OR: [
          { name: { contains: criteria.query, mode: 'insensitive' } },
          { description: { contains: criteria.query, mode: 'insensitive' } }
        ]
      });
    }
    
    if (criteria.language) {
      filters.push({ language: criteria.language });
    }
    
    if (criteria.license && criteria.license.length > 0) {
      filters.push({ license: { in: criteria.license } });
    }
    
    if (criteria.tags && criteria.tags.length > 0) {
      filters.push({
        tags: { hasSome: criteria.tags }
      });
    }
    
    if (criteria.minDownloads) {
      filters.push({ downloads: { gte: criteria.minDownloads } });
    }
    
    if (criteria.minQualityScore) {
      filters.push({ qualityScore: { gte: criteria.minQualityScore } });
    }
    
    if (criteria.updatedAfter) {
      filters.push({ lastUpdated: { gte: criteria.updatedAfter } });
    }
    
    const results = await prisma.library.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: this.getOrderBy(criteria.sortBy),
      take: criteria.limit || 20,
      skip: criteria.offset || 0,
      include: {
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 1
        },
        tags: true,
        maintainers: true
      }
    });
    
    return results;
  }
  
  private getOrderBy(sortBy?: string): any {
    switch (sortBy) {
      case 'popularity':
        return { downloads: 'desc' };
      case 'quality':
        return { qualityScore: 'desc' };
      case 'recent':
        return { lastUpdated: 'desc' };
      case 'name':
        return { name: 'asc' };
      default:
        return { relevanceScore: 'desc' };
    }
  }
}
