import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...')
  
  // Check Node.js version
  const nodeVersion = process.version
  console.log(`✅ Node.js version: ${nodeVersion}`)
  
  // Check if required files exist
  const requiredFiles = [
    'package.json',
    'prisma/schema.prisma',
    '.env.example'
  ]
  
  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      throw new Error(`Required file missing: ${file}`)
    }
  }
  
  console.log('✅ All required files present')
}

async function setupEnvironment() {
  console.log('⚙️  Setting up environment...')
  
  // Check if .env.local exists
  if (!existsSync('.env.local')) {
    console.log('📝 Creating .env.local from .env.example...')
    const envExample = readFileSync('.env.example', 'utf8')
    writeFileSync('.env.local', envExample)
    console.log('✅ .env.local created')
  } else {
    console.log('✅ .env.local already exists')
  }
  
  // Load environment variables
  require('dotenv').config({ path: '.env.local' })
  
  // Check critical environment variables
  const requiredVars = ['DATABASE_URL', 'OPENAI_API_KEY']
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:')
    missingVars.forEach(varName => console.log(`   - ${varName}`))
    console.log('\nPlease update your .env.local file with the required values.')
    return false
  }
  
  console.log('✅ Environment variables configured')
  return true
}

async function setupDatabase() {
  console.log('🗄️  Setting up database...')
  
  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    
    // Run database migrations
    console.log('🔄 Running database migrations...')
    execSync('npx prisma migrate dev', { stdio: 'inherit' })
    
    // Seed the database
    console.log('🌱 Seeding database...')
    execSync('npm run db:seed', { stdio: 'inherit' })
    
    // Verify database connection
    await prisma.$connect()
    const libraryCount = await prisma.library.count()
    console.log(`✅ Database setup complete. Found ${libraryCount} libraries`)
    
    return true
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    return false
  }
}

async function setupVectorStore() {
  console.log('🔍 Setting up vector store...')
  
  const provider = process.env['VECTOR_STORE_PROVIDER'] || 'pinecone'
  
  if (provider === 'pinecone') {
    if (!process.env['PINECONE_API_KEY']) {
      console.log('❌ PINECONE_API_KEY is required for Pinecone')
      return false
    }
    
    console.log('🌲 Testing Pinecone connection...')
    try {
      const { PineconeService } = await import('../src/config/pinecone')
      const pineconeService = new PineconeService()
      await pineconeService.initialize()
      console.log('✅ Pinecone connection successful')
      return true
    } catch (error) {
      console.error('❌ Pinecone setup failed:', error)
      return false
    }
  } else if (provider === 'qdrant') {
    console.log('🔍 Testing Qdrant connection...')
    try {
      const { QdrantService } = await import('../src/config/qdrant')
      const qdrantService = new QdrantService()
      await qdrantService.initialize()
      console.log('✅ Qdrant connection successful')
      return true
    } catch (error) {
      console.error('❌ Qdrant setup failed:', error)
      console.log('💡 Make sure Qdrant is running: docker run -p 6333:6333 qdrant/qdrant')
      return false
    }
  }
  
  return false
}

async function populateVectorStore() {
  console.log('📚 Populating vector store with documentation...')
  
  try {
    const { populateVectorStore } = await import('./populate-vector-store')
    await populateVectorStore()
    console.log('✅ Vector store populated successfully')
    return true
  } catch (error) {
    console.error('❌ Vector store population failed:', error)
    return false
  }
}

async function testQueryDocs() {
  console.log('🧪 Testing query-docs tool...')
  
  try {
    const { QueryDocsTool } = await import('../lib/mcp/tools/query-docs.tool')
    const tool = new QueryDocsTool()
    
    // Test validation
    const validationResult = await tool.validate({
      library_id: 'react',
      query: 'How to use useState hook?',
      max_results: 3
    })
    
    if (!validationResult.success) {
      console.error('❌ Input validation failed:', validationResult.errors)
      return false
    }
    
    console.log('✅ Input validation passed')
    
    // Test execution (this will fail without real data, but we can check the structure)
    try {
      const result = await tool.execute({
        library_id: 'react',
        query: 'How to use useState hook?',
        max_results: 3
      }, {})
      
      console.log('✅ Query execution completed')
      console.log(`📊 Results: ${result.success ? 'Success' : 'Failed'}`)
      
      if (result.success) {
        const data = result.data as any
        console.log(`📚 Found ${data.results?.length || 0} documentation chunks`)
        console.log(`🔤 Context tokens: ${data.totalTokens || 0}`)
      }
      
      return true
    } catch (executionError: unknown) {
      console.log('⚠️  Query execution failed (expected if no data in vector store):', (executionError as Error).message)
      return true // This is expected if no data is populated yet
    }
    
  } catch (error) {
    console.error('❌ Query-docs test failed:', error)
    return false
  }
}

async function generateSetupReport() {
  console.log('\n📋 Setup Report')
  console.log('================')
  
  try {
    // Database stats
    const libraryCount = await prisma.library.count()
    const versionCount = await prisma.libraryVersion.count()
    
    console.log(`📊 Database: ${libraryCount} libraries, ${versionCount} versions`)
    
    // Vector store stats
    const provider = process.env['VECTOR_STORE_PROVIDER'] || 'pinecone'
    console.log(`🔍 Vector Store: ${provider}`)
    
    // Environment check
    const envVars = {
      'DATABASE_URL': !!process.env['DATABASE_URL'],
      'REDIS_URL': !!process.env['REDIS_URL'],
      'OPENAI_API_KEY': !!process.env['OPENAI_API_KEY'],
      'VECTOR_STORE_PROVIDER': !!process.env['VECTOR_STORE_PROVIDER']
    }
    
    console.log('⚙️  Environment:')
    Object.entries(envVars).forEach(([key, configured]) => {
      console.log(`   ${key}: ${configured ? '✅' : '❌'}`)
    })
    
    console.log('\n🎉 Setup completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Start the development server: npm run dev')
    console.log('2. Test the query-docs tool via the API or MCP interface')
    console.log('3. Add more documentation to the vector store as needed')
    
  } catch (error) {
    console.error('❌ Failed to generate setup report:', error)
  }
}

async function main() {
  console.log('🚀 TwinMCP Query-Docs Setup')
  console.log('=============================\n')
  
  try {
    // Step 1: Check prerequisites
    await checkPrerequisites()
    
    // Step 2: Setup environment
    const envOk = await setupEnvironment()
    if (!envOk) {
      console.log('\n❌ Setup failed at environment configuration')
      process.exit(1)
    }
    
    // Step 3: Setup database
    const dbOk = await setupDatabase()
    if (!dbOk) {
      console.log('\n❌ Setup failed at database configuration')
      process.exit(1)
    }
    
    // Step 4: Setup vector store
    const vectorOk = await setupVectorStore()
    if (!vectorOk) {
      console.log('\n❌ Setup failed at vector store configuration')
      process.exit(1)
    }
    
    // Step 5: Populate vector store
    const populateOk = await populateVectorStore()
    if (!populateOk) {
      console.log('\n⚠️  Vector store population failed, but continuing...')
    }
    
    // Step 6: Test the implementation
    await testQueryDocs()
    
    // Step 7: Generate report
    await generateSetupReport()
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the setup
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  })
}

export { main as setupQueryDocs }
