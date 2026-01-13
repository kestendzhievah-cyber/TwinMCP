import { PrismaClient } from '../generated/prisma';
import { DatabaseService } from '../src/services/database.service';
import { connectDatabase, disconnectDatabase } from '../src/config/database';

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('Seeding database...');

  try {
    await connectDatabase();

    // Créer un client par défaut
    const client = await DatabaseService.createClient({
      name: 'TwinMCP Default',
      domain: 'twinmcp.dev',
      apiKeys: {},
      settings: {
        defaultQuota: {
          requestsPerMinute: 60,
          requestsPerDay: 10000,
        },
      },
    });

    console.log(`Created client: ${client.name}`);

    // Créer des bibliothèques de test
    const libraries = [
      {
        id: '/mongodb/docs',
        name: 'MongoDB Documentation',
        displayName: 'MongoDB Official Documentation',
        vendor: 'MongoDB',
        repoUrl: 'https://github.com/mongodb/docs',
        docsUrl: 'https://docs.mongodb.com',
        defaultVersion: '7.0',
        language: 'javascript',
        ecosystem: 'node',
        clientId: client.id,
        popularityScore: 100,
        metadata: {
          tags: ['database', 'nosql', 'mongodb'],
          category: 'database',
        },
      },
      {
        id: '/vercel/next.js',
        name: 'Next.js Documentation',
        displayName: 'Next.js React Framework',
        vendor: 'Vercel',
        repoUrl: 'https://github.com/vercel/next.js',
        docsUrl: 'https://nextjs.org/docs',
        defaultVersion: '14.0',
        language: 'typescript',
        ecosystem: 'react',
        clientId: client.id,
        popularityScore: 95,
        metadata: {
          tags: ['react', 'framework', 'ssr', 'typescript'],
          category: 'framework',
        },
      },
      {
        id: '/supabase/supabase',
        name: 'Supabase Documentation',
        displayName: 'Supabase Open Source Firebase Alternative',
        vendor: 'Supabase',
        repoUrl: 'https://github.com/supabase/supabase',
        docsUrl: 'https://supabase.com/docs',
        defaultVersion: '1.0',
        language: 'typescript',
        ecosystem: 'javascript',
        clientId: client.id,
        popularityScore: 80,
        metadata: {
          tags: ['database', 'backend', 'firebase'],
          category: 'platform',
        },
      },
      {
        id: '/prisma/prisma',
        name: 'Prisma Documentation',
        displayName: 'Prisma Modern Database Toolkit',
        vendor: 'Prisma',
        repoUrl: 'https://github.com/prisma/prisma',
        docsUrl: 'https://www.prisma.io/docs',
        defaultVersion: '5.0',
        language: 'typescript',
        ecosystem: 'node',
        clientId: client.id,
        popularityScore: 90,
        metadata: {
          tags: ['database', 'orm', 'typescript'],
          category: 'orm',
        },
      },
    ];

    for (const libData of libraries) {
      await DatabaseService.createLibrary(libData);
      console.log(`Created library: ${libData.name}`);
    }

    // Créer un utilisateur de test
    const user = await DatabaseService.createUser({
      email: 'test@twinmcp.dev',
      name: 'Test User',
      hashedPassword: 'hashed_test_password',
      clientId: client.id,
    });

    console.log(`Created test user: ${user.email}`);

    // Créer une clé API de test
    const apiKey = await DatabaseService.createApiKey({
      userId: user.id,
      keyHash: 'test_api_key_hash',
      keyPrefix: 'twinmcp_test_',
      name: 'Test API Key',
      quotaRequestsPerMinute: 100,
      quotaRequestsPerDay: 10000,
    });

    console.log(`Created API key: ${apiKey.keyPrefix}`);

    // Créer un token OAuth de test
    await DatabaseService.createOAuthToken({
      userId: user.id,
      provider: 'github',
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    });

    console.log('Created OAuth token for GitHub');

    // Créer quelques logs d'utilisation de test
    await DatabaseService.logUsage({
      userId: user.id,
      apiKeyId: apiKey.id,
      toolName: 'resolve-library-id',
      libraryId: '/mongodb/docs',
      query: 'mongodb connection',
      tokensReturned: 150,
      responseTimeMs: 120,
    });

    await DatabaseService.logUsage({
      userId: user.id,
      apiKeyId: apiKey.id,
      toolName: 'query-docs',
      libraryId: '/vercel/next.js',
      query: 'next.js routing',
      tokensReturned: 200,
      responseTimeMs: 95,
    });

    console.log('Created usage logs');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await disconnectDatabase();
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDatabase };
