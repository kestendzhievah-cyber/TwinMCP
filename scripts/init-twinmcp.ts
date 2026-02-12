#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { execSync } from 'child_process'
import { LibraryResolutionService } from '../lib/services/library-resolution.service'
import { VectorSearchService } from '../lib/services/vector-search.service'
import { AuthService } from '../lib/services/auth.service'

const prisma = new PrismaClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

async function initializeTwinMCP() {
  console.log('🚀 Initializing TwinMCP System...')

  try {
    // 1. Vérifier la connexion à la base de données
    console.log('📊 Checking database connection...')
    await prisma.$connect()
    console.log('✅ Database connected successfully')

    // 2. Vérifier la connexion Redis
    console.log('🔴 Checking Redis connection...')
    await redis.ping()
    console.log('✅ Redis connected successfully')

    // 3. Exécuter les migrations Prisma
    console.log('🔄 Running database migrations...')
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      console.log('✅ Database migrations completed')
    } catch (error) {
      console.log('ℹ️  No new migrations to apply')
    }

    // 4. Seeding des données
    console.log('🌱 Seeding database...')
    try {
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
      console.log('✅ Database seeding completed')
    } catch (error) {
      console.error('❌ Database seeding failed:', error instanceof Error ? error.message : String(error))
    }

    // 5. Initialiser les services TwinMCP
    console.log('🔧 Initializing TwinMCP services...')
    
    const libraryResolutionService = new LibraryResolutionService(prisma, redis)
    const vectorSearchService = new VectorSearchService(prisma, redis)
    const authService = new AuthService(prisma, redis)

    // Test des services
    console.log('🧪 Testing services...')

    // Test Library Resolution
    try {
      const testResult = await libraryResolutionService.resolveLibrary({
        query: 'react',
        limit: 3,
        include_aliases: true
      })
      console.log(`✅ Library Resolution test: Found ${testResult.results.length} results`)
    } catch (error) {
      console.error('❌ Library Resolution test failed:', error instanceof Error ? error.message : String(error))
    }

    // Test Vector Search
    try {
      const testResult = await vectorSearchService.searchDocuments({
        library_id: '/react/react',
        query: 'hooks',
        max_results: 3,
        include_code: true,
        context_limit: 4000
      })
      console.log(`✅ Vector Search test: Found ${testResult.results.length} results`)
    } catch (error) {
      console.error('❌ Vector Search test failed:', error instanceof Error ? error.message : String(error))
    }

    // 6. Créer une clé API de test
    console.log('🔑 Creating test API key...')
    try {
      const testUsers = await prisma.user.findMany({
        where: { email: 'test@twinmcp.com' }
      })

      if (testUsers.length > 0) {
        const testApiKey = await authService.generateApiKey(testUsers[0].id, 'Test API Key')
        console.log(`✅ Test API key created: ${testApiKey.apiKey}`)
        console.log(`   Prefix: ${testApiKey.prefix}`)
        console.log('   ⚠️  Save this key for testing!')
      }
    } catch (error) {
      console.error('❌ Failed to create test API key:', error instanceof Error ? error.message : String(error))
    }

    console.log('')
    console.log('🎉 TwinMCP System initialization completed!')
    console.log('')
    console.log('📋 Available endpoints:')
    console.log('   POST   /api/mcp/resolve-library-id  - Resolve library names')
    console.log('   POST   /api/mcp/query-docs         - Search documentation')
    console.log('   GET    /api/mcp/tools              - List available tools')
    console.log('   POST   /api/mcp/call               - Execute tools (legacy)')
    console.log('')
    console.log('🔐 Authentication:')
    console.log('   Header: x-api-key: twinmcp_live_...')
    console.log('   Header: Authorization: Bearer twinmcp_live_...')
    console.log('')
    console.log('🧪 Test commands:')
    console.log(`   curl -X POST http://localhost:3000/api/mcp/resolve-library-id \\`)
    console.log(`     -H "Content-Type: application/json" \\`)
    console.log(`     -H "x-api-key: YOUR_API_KEY" \\`)
    console.log(`     -d '{"query": "react", "limit": 3}'`)
    console.log('')

  } catch (error) {
    console.error('❌ TwinMCP initialization failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    await redis.disconnect()
  }
}

// Gestion des signaux pour arrêt propre
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down TwinMCP initialization...')
  await prisma.$disconnect()
  await redis.disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down TwinMCP initialization...')
  await prisma.$disconnect()
  await redis.disconnect()
  process.exit(0)
})

// Lancer l'initialisation
if (require.main === module) {
  initializeTwinMCP()
}
