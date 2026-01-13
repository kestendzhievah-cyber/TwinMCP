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
import { EmailTool } from './communication/email'
import { SlackTool } from './communication/slack'
import { CalendarTool } from './productivity/calendar'
import { NotionTool } from './productivity/notion'
import { FirebaseTool } from './data/firebase'
import { GitHubTool } from './development/github'
import { ResolveLibraryIdTool } from './resolve-library-id.tool'
import { QueryDocsTool } from './query-docs.tool'

// Liste de tous les outils disponibles
export const allTools = [
  // Outils TwinMCP principaux (priorité haute)
  new ResolveLibraryIdTool(null as any), // Sera initialisé plus tard
  new QueryDocsTool(null as any), // Sera initialisé plus tard
  
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

  // Créer les instances avec les services
  const twinmcpTools = [
    new ResolveLibraryIdTool(libraryResolutionService),
    new QueryDocsTool(vectorSearchService)
  ]

  // Enregistrer les outils TwinMCP en premier
  for (const tool of twinmcpTools) {
    try {
      registry.register(tool)
      console.log(`✅ Registered TwinMCP tool: ${tool.name} (${tool.category})`)
    } catch (error) {
      console.error(`❌ Failed to register TwinMCP tool ${tool.name}:`, error)
    }
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

  const stats = registry.getStats()
  console.log(`📊 Registry initialized with ${stats.totalTools} tools`)
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
