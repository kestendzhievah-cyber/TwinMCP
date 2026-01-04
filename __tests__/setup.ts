import { initializeMCP } from '../lib/mcp/init'

// Setup global pour les tests
beforeAll(async () => {
  await initializeMCP()
})

afterAll(async () => {
  // Cleanup après tous les tests
})
