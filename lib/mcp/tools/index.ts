// Export centralisé de tous les outils MCP
export { EmailTool } from './communication/email'
export { SlackTool } from './communication/slack'
export { CalendarTool } from './productivity/calendar'
export { NotionTool } from './productivity/notion'
export { FirebaseTool } from './data/firebase'
export { GitHubTool } from './development/github'

// Outils TwinMCP principaux
export { ResolveLibraryIdTool } from './resolve-library-id.tool'
export { QueryDocsTool } from './query-docs.tool'

// Import du registry pour l'enregistrement automatique
import { registry } from '../core/registry'
import { validator } from '../core/validator'
import { EmailTool } from './communication/email'
import { SlackTool } from './communication/slack'
import { CalendarTool } from './productivity/calendar'
import { NotionTool } from './productivity/notion'
import { FirebaseTool } from './data/firebase'
import { GitHubTool } from './development/github'
import { ResolveLibraryIdTool } from './resolve-library-id.tool'
import { QueryDocsTool } from './query-docs.tool'

// Liste de tous les outils disponibles (outils de base uniquement)
export const allTools = [
  // Outils de productivité existants
  new EmailTool(),
  new SlackTool(),
  new CalendarTool(),
  new NotionTool(),
  new FirebaseTool(),
  new GitHubTool()
]

// Fonction d'initialisation - enregistre tous les outils
export async function initializeTools(services: any = {}): Promise<void> {
  console.log('🔧 Initializing MCP Tools...')

  // Initialiser les services TwinMCP
  const { libraryResolutionService, vectorSearchService } = services

  // Enregistrer les outils TwinMCP en premier (seulement si les services sont disponibles)
  if (libraryResolutionService) {
    try {
      const resolveLibraryTool = new ResolveLibraryIdTool(libraryResolutionService)
      registry.register(resolveLibraryTool)
      console.log(`✅ Registered TwinMCP tool: ${resolveLibraryTool.name} (${resolveLibraryTool.category})`)
    } catch (error) {
      console.error(`❌ Failed to register ResolveLibraryIdTool:`, error)
    }
  } else {
    console.log(`ℹ️  Skipping ResolveLibraryIdTool registration (service not provided)`)
  }

  // QueryDocsTool crée ses propres connexions - skip en mode test
  if (process.env.NODE_ENV !== 'test') {
    try {
      const queryDocsTool = new QueryDocsTool()
      registry.register(queryDocsTool)
      console.log(`✅ Registered TwinMCP tool: ${queryDocsTool.name} (${queryDocsTool.category})`)
    } catch (error) {
      console.error(`❌ Failed to register QueryDocsTool:`, error)
    }
  } else {
    console.log(`ℹ️  Skipping QueryDocsTool registration (test mode)`)
  }

  // Enregistrer les autres outils
  const otherTools = [
    new EmailTool(),
    new SlackTool(),
    new CalendarTool(),
    new NotionTool(),
    new FirebaseTool(),
    new GitHubTool()
  ]

  for (const tool of otherTools) {
    try {
      registry.register(tool)
      console.log(`✅ Registered tool: ${tool.name} (${tool.category})`)
    } catch (error) {
      console.error(`❌ Failed to register tool ${tool.name}:`, error)
    }
  }

  // Register validation schemas for all tools
  let schemasRegistered = 0
  for (const tool of registry.getAll()) {
    if (tool.inputSchema) {
      try {
        validator.registerSchema(tool.id, tool.inputSchema)
        schemasRegistered++
      } catch (error) {
        console.warn(`⚠️ Failed to register schema for tool ${tool.id}:`, error)
      }
    }
  }

  const stats = registry.getStats()
  console.log(`📊 Registry initialized with ${stats.totalTools} tools`)
  console.log(`   📋 Validation schemas registered: ${schemasRegistered}`)
  console.log(`   📁 Categories: ${Object.entries(stats.toolsByCategory).map(([cat, count]) => `${cat}(${count})`).join(', ')}`)
  console.log(`   ⚡ Async tools: ${stats.asyncTools}`)
  console.log(`   🎯 Tools with rate limits: ${stats.toolsWithRateLimit}`)
  console.log(`   💾 Tools with cache: ${stats.toolsWithCache}`)
  console.log(`   🔗 Tools with webhooks: ${stats.toolsWithWebhooks}`)
}

// Fonction pour obtenir un outil par ID
export function getTool(toolId: string) {
  return registry.get(toolId)
}

// Fonction pour obtenir tous les outils
export function getAllTools() {
  return registry.getAll()
}

// Fonction pour rechercher des outils
export function searchTools(query: string, filters?: any) {
  return registry.search(query, filters)
}

// Fonction pour obtenir les outils par catégorie
export function getToolsByCategory(category: string) {
  return registry.getByCategory(category)
}

// Export du registry pour un accès direct si nécessaire
export { registry } from '../core/registry'

// Export du ToolExecutor pour l'exécution unifiée
export { getToolExecutor } from '../core/tool-executor'

// Fonction d'exécution unifiée d'un outil par ID
export async function executeTool(toolId: string, args: any, config: any = {}, options: any = {}) {
  const { getToolExecutor } = await import('../core/tool-executor')
  const tool = registry.get(toolId)
  if (!tool) {
    return {
      success: false,
      error: `Tool not found: ${toolId}`,
      metadata: { executionTime: 0, cacheHit: false, apiCallsCount: 0 }
    }
  }
  return getToolExecutor().execute(tool, args, config, options)
}

// Fonction d'exécution batch
export async function executeBatch(
  requests: Array<{ toolId: string; args: any; config?: any; options?: any }>,
  concurrency: number = 5
) {
  const { getToolExecutor } = await import('../core/tool-executor')
  const executor = getToolExecutor()

  const resolved = requests.map(req => {
    const tool = registry.get(req.toolId)
    if (!tool) {
      return null
    }
    return { tool, args: req.args, config: req.config, options: req.options }
  })

  // Return errors for missing tools, execute the rest
  const results: any[] = new Array(requests.length)
  const validRequests: Array<{ index: number; tool: any; args: any; config?: any; options?: any }> = []

  resolved.forEach((req, index) => {
    if (!req) {
      results[index] = {
        success: false,
        error: `Tool not found: ${requests[index].toolId}`,
        metadata: { executionTime: 0, cacheHit: false, apiCallsCount: 0 }
      }
    } else {
      validRequests.push({ index, ...req })
    }
  })

  if (validRequests.length > 0) {
    const batchResults = await executor.executeBatch(
      validRequests.map(r => ({ tool: r.tool, args: r.args, config: r.config, options: r.options })),
      concurrency
    )
    validRequests.forEach((req, i) => {
      results[req.index] = batchResults[i]
    })
  }

  return results
}
