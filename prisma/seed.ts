import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TwinMCP database...')

  // Créer un client par défaut
  const defaultClient = await prisma.client.upsert({
    where: { name: 'TwinMCP Default' },
    update: {},
    create: {
      name: 'TwinMCP Default',
      apiKeys: {},
      settings: {
        defaultQuotas: {
          requestsPerMinute: 100,
          requestsPerDay: 10000
        }
      }
    }
  })

  console.log('✅ Created default client:', defaultClient.id)

  // Créer un utilisateur admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@twinmcp.com' },
    update: {},
    create: {
      email: 'admin@twinmcp.com',
      name: 'TwinMCP Admin',
      role: 'ADMIN',
      clientId: defaultClient.id
    }
  })

  console.log('✅ Created admin user:', adminUser.id)

  // Créer un utilisateur de test
  const testUser = await prisma.user.upsert({
    where: { email: 'test@twinmcp.com' },
    update: {},
    create: {
      email: 'test@twinmcp.com',
      name: 'Test User',
      role: 'BUYER',
      clientId: defaultClient.id
    }
  })

  console.log('✅ Created test user:', testUser.id)

  // Créer des bibliothèques exemples
  const libraries = [
    {
      id: '/react/react',
      name: 'react',
      displayName: 'React',
      description: 'A JavaScript library for building user interfaces',
      vendor: 'facebook',
      repoUrl: 'https://github.com/facebook/react',
      docsUrl: 'https://react.dev',
      defaultVersion: '18.2.0',
      popularityScore: 0.95,
      language: 'javascript',
      ecosystem: 'npm',
      tags: ['ui', 'frontend', 'javascript', 'components'],
      clientId: defaultClient.id
    },
    {
      id: '/nodejs/node',
      name: 'node',
      displayName: 'Node.js',
      description: 'JavaScript runtime built on Chrome\'s V8 JavaScript engine',
      vendor: 'openjs',
      repoUrl: 'https://github.com/nodejs/node',
      docsUrl: 'https://nodejs.org/docs',
      defaultVersion: '20.0.0',
      popularityScore: 0.90,
      language: 'javascript',
      ecosystem: 'npm',
      tags: ['runtime', 'backend', 'javascript', 'server'],
      clientId: defaultClient.id
    },
    {
      id: '/python/cpython',
      name: 'python',
      displayName: 'Python',
      description: 'The Python programming language',
      vendor: 'python',
      repoUrl: 'https://github.com/python/cpython',
      docsUrl: 'https://docs.python.org',
      defaultVersion: '3.11.0',
      popularityScore: 0.92,
      language: 'python',
      ecosystem: 'pip',
      tags: ['language', 'programming', 'scripting'],
      clientId: defaultClient.id
    },
    {
      id: '/expressjs/express',
      name: 'express',
      displayName: 'Express.js',
      description: 'Fast, unopinionated, minimalist web framework for Node.js',
      vendor: 'expressjs',
      repoUrl: 'https://github.com/expressjs/express',
      docsUrl: 'https://expressjs.com',
      defaultVersion: '4.18.0',
      popularityScore: 0.85,
      language: 'javascript',
      ecosystem: 'npm',
      tags: ['web', 'framework', 'backend', 'api'],
      clientId: defaultClient.id
    },
    {
      id: '/mongodb/mongo-go-driver',
      name: 'mongo-go-driver',
      displayName: 'MongoDB Go Driver',
      description: 'Official MongoDB driver for the Go language',
      vendor: 'mongodb',
      repoUrl: 'https://github.com/mongodb/mongo-go-driver',
      docsUrl: 'https://www.mongodb.com/docs/drivers/go',
      defaultVersion: '1.12.0',
      popularityScore: 0.75,
      language: 'go',
      ecosystem: 'go',
      tags: ['database', 'driver', 'mongodb', 'go'],
      clientId: defaultClient.id
    }
  ]

  for (const libData of libraries) {
    const library = await prisma.library.upsert({
      where: { id: libData.id },
      update: libData,
      create: libData
    })
    console.log(`✅ Created library: ${library.name} (${library.id})`)

    // Créer des aliases
    const aliases = getAliasesForLibrary(library.name)
    for (const alias of aliases) {
      await prisma.libraryAlias.upsert({
        where: {
          libraryId_alias: {
            libraryId: library.id,
            alias: alias
          }
        },
        update: {},
        create: {
          libraryId: library.id,
          alias
        }
      })
    }
  }

  console.log('🎉 Database seeding completed!')
}

function getAliasesForLibrary(libraryName: string): string[] {
  const aliasMap: Record<string, string[]> = {
    'react': ['reactjs', 'react.js', 'reactjs'],
    'node': ['nodejs', 'node.js', 'nodejs'],
    'python': ['python3', 'py', 'python3'],
    'express': ['expressjs', 'express.js', 'expressjs'],
    'mongo-go-driver': ['mongodb-go', 'mongo-go', 'mongodb-go-driver']
  }
  
  return aliasMap[libraryName] || []
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
