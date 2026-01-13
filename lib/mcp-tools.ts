// MCP Tools Configuration
// Centralized definition of all available MCP tools

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { LibraryResolutionService } from './services/library-resolution.service'
import { VectorSearchService } from './services/vector-search.service'

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

// Initialisation des services
const prisma = new PrismaClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

const libraryResolutionService = new LibraryResolutionService(prisma, redis)
const vectorSearchService = new VectorSearchService(prisma, redis)

export const mcpTools: MCPTool[] = [
  // Outils TwinMCP principaux
  {
    name: 'resolve-library-id',
    description: 'Resolve library names and find matching software libraries',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Library name to search for',
          minLength: 1,
          maxLength: 200
        },
        context: {
          type: 'object',
          properties: {
            language: { type: 'string' },
            framework: { type: 'string' },
            ecosystem: { type: 'string' }
          },
          description: 'Optional context to refine search'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Maximum number of results to return'
        },
        include_aliases: {
          type: 'boolean',
          default: true,
          description: 'Include aliases and variants in search'
        }
      },
      required: ['query']
    },
  },
  {
    name: 'query-docs',
    description: 'Search documentation for a specific library',
    inputSchema: {
      type: 'object',
      properties: {
        library_id: { 
          type: 'string', 
          description: 'Library unique identifier',
          minLength: 1
        },
        query: { 
          type: 'string', 
          description: 'Question or search about documentation',
          minLength: 1,
          maxLength: 1000
        },
        version: {
          type: 'string',
          description: 'Specific library version'
        },
        max_results: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Maximum number of results to return'
        },
        include_code: {
          type: 'boolean',
          default: true,
          description: 'Include code snippets in results'
        },
        context_limit: {
          type: 'number',
          minimum: 1000,
          maximum: 8000,
          default: 4000,
          description: 'Token limit for context'
        }
      },
      required: ['library_id', 'query']
    },
  },
  // Outils existants (conservés pour compatibilité)
  {
    name: 'send_email',
    description: 'Send an email using Gmail',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'read_calendar',
    description: 'Read Google Calendar events',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'create_notion_page',
    description: 'Create a new page in Notion',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Page content' },
        parentId: { type: 'string', description: 'Parent page ID' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'firebase_read',
    description: 'Read data from Firebase',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name' },
        documentId: { type: 'string', description: 'Document ID' },
      },
      required: ['collection'],
    },
  },
  {
    name: 'firebase_write',
    description: 'Write data to Firebase',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name' },
        documentId: { type: 'string', description: 'Document ID' },
        data: { type: 'object', description: 'Data to write' },
      },
      required: ['collection', 'data'],
    },
  },
]

export const serverInfo = {
  name: 'twinmcp-server',
  version: '1.0.0',
  capabilities: {
    tools: {},
  },
}

// Tool execution functions
export const executeTool = async (toolName: string, args: any): Promise<string> => {
  try {
    switch (toolName) {
      case 'resolve-library-id':
        const resolveResult = await libraryResolutionService.resolveLibrary(args)
        return JSON.stringify(resolveResult, null, 2)
      
      case 'query-docs':
        const queryResult = await vectorSearchService.searchDocuments(args)
        return JSON.stringify(queryResult, null, 2)
      
      case 'send_email':
        return `Email sent to ${args?.to} with subject "${args?.subject}"`
      
      case 'read_calendar':
        return `Events retrieved from ${args?.startDate} to ${args?.endDate}`
      
      case 'create_notion_page':
        return `Page "${args?.title}" created successfully`
      
      case 'firebase_read':
        return `Data retrieved from ${args?.collection}${args?.documentId ? `/${args.documentId}` : ''}`
      
      case 'firebase_write':
        return `Data written to ${args?.collection}${args?.documentId ? `/${args.documentId}` : ''}`
      
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error)
    return `Error: ${error.message}`
  }
}

// Validation function for tool arguments
export const validateToolArgs = (tool: MCPTool, args: any): string[] => {
  if (!args) return tool.inputSchema.required

  return tool.inputSchema.required.filter(
    (required: string) => !(required in args)
  )
}

// Export des services pour utilisation externe
export { libraryResolutionService, vectorSearchService }
