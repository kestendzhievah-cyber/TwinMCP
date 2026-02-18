import { PrismaClient } from '@prisma/client'

export interface LibraryInfo {
  id: string
  name: string
  displayName: string
  description?: string
  defaultVersion?: string
  vendor?: string
  docsUrl?: string
  language: string
  ecosystem: string
  tags: string[]
  popularityScore: number
  totalSnippets: number
  totalTokens: number
}

export class LibraryService {
  private db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async getLibrary(libraryId: string): Promise<LibraryInfo | null> {
    try {
      const library = await this.db.library.findUnique({
        where: { id: libraryId },
        include: {
          versions: {
            where: { isLatest: true },
            take: 1
          },
          _count: {
            select: {
              documentationChunks: true
            }
          }
        }
      })

      if (!library) {
        return null
      }

      return {
        id: library.id,
        name: library.name,
        displayName: library.displayName,
        description: library.description || undefined,
        defaultVersion: library.defaultVersion || undefined,
        vendor: library.vendor || undefined,
        docsUrl: library.docsUrl || undefined,
        language: library.language,
        ecosystem: library.ecosystem,
        tags: library.tags,
        popularityScore: library.popularityScore,
        totalSnippets: library.totalSnippets,
        totalTokens: library.totalTokens
      }
    } catch (error) {
      console.error(`Error fetching library ${libraryId}:`, error)
      throw new Error(`Failed to fetch library: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async searchLibraries(query: string, limit: number = 10): Promise<LibraryInfo[]> {
    try {
      const libraries = await this.db.library.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: [query] } }
          ]
        },
        orderBy: [
          { popularityScore: 'desc' },
          { totalSnippets: 'desc' }
        ],
        take: limit,
        include: {
          _count: {
            select: {
              documentationChunks: true
            }
          }
        }
      })

      return libraries.map((library: typeof libraries[number]) => ({
        id: library.id,
        name: library.name,
        displayName: library.displayName,
        description: library.description || undefined,
        defaultVersion: library.defaultVersion || undefined,
        vendor: library.vendor || undefined,
        docsUrl: library.docsUrl || undefined,
        language: library.language,
        ecosystem: library.ecosystem,
        tags: library.tags,
        popularityScore: library.popularityScore,
        totalSnippets: library.totalSnippets,
        totalTokens: library.totalTokens
      }))
    } catch (error) {
      console.error(`Error searching libraries with query "${query}":`, error)
      throw new Error(`Failed to search libraries: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async getPopularLibraries(limit: number = 20): Promise<LibraryInfo[]> {
    try {
      const libraries = await this.db.library.findMany({
        orderBy: [
          { popularityScore: 'desc' },
          { totalSnippets: 'desc' }
        ],
        take: limit,
        include: {
          _count: {
            select: {
              documentationChunks: true
            }
          }
        }
      })

      return libraries.map((library: typeof libraries[number]) => ({
        id: library.id,
        name: library.name,
        displayName: library.displayName,
        description: library.description || undefined,
        defaultVersion: library.defaultVersion || undefined,
        vendor: library.vendor || undefined,
        docsUrl: library.docsUrl || undefined,
        language: library.language,
        ecosystem: library.ecosystem,
        tags: library.tags,
        popularityScore: library.popularityScore,
        totalSnippets: library.totalSnippets,
        totalTokens: library.totalTokens
      }))
    } catch (error) {
      console.error('Error fetching popular libraries:', error)
      throw new Error(`Failed to fetch popular libraries: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async getLibraryVersions(libraryId: string): Promise<string[]> {
    try {
      const versions = await this.db.libraryVersion.findMany({
        where: { libraryId },
        orderBy: { releaseDate: 'desc' },
        select: { version: true }
      })

      return versions.map((v: typeof versions[number]) => v.version)
    } catch (error) {
      console.error(`Error fetching versions for library ${libraryId}:`, error)
      throw new Error(`Failed to fetch library versions: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async getLibraryAliases(libraryId: string): Promise<string[]> {
    try {
      const aliases = await this.db.libraryAlias.findMany({
        where: { libraryId },
        select: { alias: true }
      })

      return aliases.map((a: typeof aliases[number]) => a.alias)
    } catch (error) {
      console.error(`Error fetching aliases for library ${libraryId}:`, error)
      throw new Error(`Failed to fetch library aliases: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async resolveAlias(alias: string): Promise<string | null> {
    try {
      const libraryAlias = await this.db.libraryAlias.findUnique({
        where: { alias } as any,
        select: { libraryId: true }
      })

      return libraryAlias?.libraryId || null
    } catch (error) {
      console.error(`Error resolving alias "${alias}":`, error)
      throw new Error(`Failed to resolve alias: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
