// Import the real registry from the correct path
import { registry } from '../core/registry'

export interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  servers?: Array<{
    url: string
    description?: string
  }>
  paths: Record<string, any>
  components: {
    schemas: Record<string, any>
    securitySchemes?: Record<string, any>
    responses?: Record<string, any>
  }
}

export class DocsGenerator {
  private baseUrl: string

  constructor(baseUrl: string = 'https://api.example.com') {
    this.baseUrl = baseUrl
  }

  async generateOpenAPI(): Promise<OpenAPISpec> {
    const tools = registry.getAll()

    return {
      openapi: '3.0.0',
      info: {
        title: 'MCP Server API',
        version: '1.0.0',
        description: 'Model Context Protocol Server API with advanced tools and features'
      },
      servers: [
        {
          url: this.baseUrl,
          description: 'MCP API Server'
        }
      ],
      paths: {
        '/v1/mcp/tools': {
          get: {
            summary: 'List available tools',
            description: 'Get a list of all available MCP tools with their metadata',
            security: [
              { ApiKeyAuth: [] },
              { BearerAuth: [] }
            ],
            responses: {
              200: {
                description: 'List of tools',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        tools: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Tool' }
                        },
                        totalCount: { type: 'number' },
                        apiVersion: { type: 'string' },
                        metadata: { $ref: '#/components/schemas/Metadata' }
                      }
                    }
                  }
                }
              },
              401: { $ref: '#/components/responses/Unauthorized' },
              429: { $ref: '#/components/responses/RateLimit' }
            }
          }
        },
        '/v1/mcp/execute': {
          post: {
            summary: 'Execute a tool',
            description: 'Execute an MCP tool with the provided arguments',
            security: [
              { ApiKeyAuth: [] },
              { BearerAuth: [] }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['toolId'],
                    properties: {
                      toolId: { type: 'string' },
                      args: { type: 'object' },
                      async: { type: 'boolean', default: false }
                    }
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'Tool executed successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        result: { type: 'object' },
                        success: { type: 'boolean' },
                        apiVersion: { type: 'string' },
                        metadata: { $ref: '#/components/schemas/Metadata' }
                      }
                    }
                  }
                }
              },
              400: { $ref: '#/components/responses/BadRequest' },
              401: { $ref: '#/components/responses/Unauthorized' },
              403: { $ref: '#/components/responses/Forbidden' },
              404: { $ref: '#/components/responses/NotFound' },
              429: { $ref: '#/components/responses/RateLimit' }
            }
          }
        },
        '/v1/mcp/health': {
          get: {
            summary: 'Health check',
            description: 'Get system health status and performance metrics',
            responses: {
              200: {
                description: 'System is healthy',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Health' }
                  }
                }
              },
              503: { $ref: '#/components/responses/ServiceUnavailable' }
            }
          }
        },
        '/v1/mcp/metrics': {
          get: {
            summary: 'System metrics',
            description: 'Get detailed system metrics and performance data',
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: 'period',
                in: 'query',
                schema: { type: 'string', enum: ['day', 'week', 'month'] },
                description: 'Time period for metrics'
              },
              {
                name: 'toolId',
                in: 'query',
                schema: { type: 'string' },
                description: 'Specific tool metrics'
              }
            ],
            responses: {
              200: {
                description: 'Metrics data',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Metrics' }
                  }
                }
              },
              401: { $ref: '#/components/responses/Unauthorized' },
              403: { $ref: '#/components/responses/Forbidden' }
            }
          }
        }
      },
      components: {
        schemas: this.generateSchemas(tools),
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key'
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer'
          }
        },
        responses: {
          BadRequest: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    details: { type: 'array' },
                    apiVersion: { type: 'string' }
                  }
                }
              }
            }
          },
          Unauthorized: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    apiVersion: { type: 'string' }
                  }
                }
              }
            }
          },
          Forbidden: {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    apiVersion: { type: 'string' }
                  }
                }
              }
            }
          },
          NotFound: {
            description: 'Not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    apiVersion: { type: 'string' }
                  }
                }
              }
            }
          },
          RateLimit: {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    apiVersion: { type: 'string' }
                  }
                }
              }
            }
          },
          ServiceUnavailable: {
            description: 'Service unavailable',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    error: { type: 'string' },
                    apiVersion: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  private generateSchemas(tools: any[]) {
    const schemas: Record<string, any> = {
      Tool: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          version: { type: 'string' },
          category: { type: 'string', enum: ['communication', 'productivity', 'development', 'data'] },
          description: { type: 'string' },
          author: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          capabilities: {
            type: 'object',
            properties: {
              async: { type: 'boolean' },
              batch: { type: 'boolean' },
              streaming: { type: 'boolean' },
              webhook: { type: 'boolean' }
            }
          },
          rateLimit: {
            type: 'object',
            properties: {
              requests: { type: 'number' },
              period: { type: 'string' },
              strategy: { type: 'string', enum: ['fixed', 'sliding', 'token-bucket'] }
            }
          },
          cache: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              ttl: { type: 'number' },
              strategy: { type: 'string', enum: ['memory', 'redis', 'hybrid'] }
            }
          }
        }
      },
      Metadata: {
        type: 'object',
        properties: {
          executionTime: { type: 'number' },
          cacheHit: { type: 'boolean' },
          cost: { type: 'number' },
          authenticated: { type: 'boolean' },
          authMethod: { type: 'string', enum: ['api_key', 'jwt', 'none'] }
        }
      },
      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'unhealthy'] },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number' },
          version: { type: 'string' },
          apiVersion: { type: 'string' },
          services: {
            type: 'object',
            properties: {
              registry: { $ref: '#/components/schemas/ServiceStatus' },
              queue: { $ref: '#/components/schemas/ServiceStatus' },
              metrics: { $ref: '#/components/schemas/ServiceStatus' }
            }
          },
          performance: {
            type: 'object',
            properties: {
              avgResponseTime: { type: 'number' },
              cacheHitRate: { type: 'number' },
              errorRate: { type: 'number' }
            }
          }
        }
      },
      ServiceStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'unhealthy'] },
          toolsCount: { type: 'number' },
          categories: { type: 'array', items: { type: 'string' } }
        }
      },
      Metrics: {
        type: 'object',
        properties: {
          systemStats: { $ref: '#/components/schemas/SystemStats' },
          topTools: { type: 'array', items: { $ref: '#/components/schemas/ToolStats' } },
          errorAnalysis: { $ref: '#/components/schemas/ErrorAnalysis' },
          report: { $ref: '#/components/schemas/Report' },
          apiVersion: { type: 'string' },
          metadata: { $ref: '#/components/schemas/Metadata' }
        }
      },
      SystemStats: {
        type: 'object',
        properties: {
          totalExecutions: { type: 'number' },
          activeUsers: { type: 'number' },
          toolsUsed: { type: 'number' },
          avgResponseTime: { type: 'number' },
          errorRate: { type: 'number' },
          cacheHitRate: { type: 'number' }
        }
      },
      ToolStats: {
        type: 'object',
        properties: {
          toolId: { type: 'string' },
          executions: { type: 'number' },
          stats: {
            type: 'object',
            properties: {
              totalExecutions: { type: 'number' },
              successRate: { type: 'number' },
              avgExecutionTime: { type: 'number' },
              errorCount: { type: 'number' }
            }
          }
        }
      },
      ErrorAnalysis: {
        type: 'object',
        properties: {
          byTool: { type: 'array', items: { $ref: '#/components/schemas/ErrorByTool' } },
          byType: { type: 'array', items: { $ref: '#/components/schemas/ErrorByType' } },
          recent: { type: 'array', items: { $ref: '#/components/schemas/RecentError' } }
        }
      },
      ErrorByTool: {
        type: 'object',
        properties: {
          toolId: { type: 'string' },
          errors: { type: 'number' },
          errorRate: { type: 'number' }
        }
      },
      ErrorByType: {
        type: 'object',
        properties: {
          errorType: { type: 'string' },
          count: { type: 'number' }
        }
      },
      RecentError: {
        type: 'object',
        properties: {
          toolId: { type: 'string' },
          userId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          executionTime: { type: 'number' },
          errorType: { type: 'string' }
        }
      },
      Report: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month'] },
          systemStats: { $ref: '#/components/schemas/SystemStats' },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      }
    }

    return schemas
  }

  async generateMarkdown(): Promise<string> {
    const tools = registry.getAll()
    const stats = registry.getStats()

    let markdown = `# MCP Server API Documentation

## Overview

The Model Context Protocol (MCP) Server provides a scalable, production-ready API for executing various tools and services. This API supports authentication, rate limiting, caching, queue management, and comprehensive monitoring.

## Features

- 🔧 **${stats.totalTools} Available Tools** across ${Object.keys(stats.toolsByCategory).length} categories
- ⚡ **High Performance** with caching and queue management
- 🔒 **Enterprise Security** with multi-level authentication
- 📊 **Real-time Monitoring** and analytics
- 📚 **Auto-generated Documentation**
- 🔄 **Async Processing** for long-running tasks

## Authentication

The API supports two authentication methods:

### API Key Authentication
\`\`\`http
GET /api/v1/mcp/tools
Headers:
  x-api-key: mcp-default-key-12345
\`\`\`

### JWT Authentication
\`\`\`http
GET /api/v1/mcp/tools
Headers:
  Authorization: Bearer your-jwt-token
\`\`\`

## API Endpoints

### List Tools
\`\`\`http
GET /api/v1/mcp/tools
\`\`\`

Returns all available tools with their metadata.

### Execute Tool
\`\`\`http
POST /api/v1/mcp/execute
Content-Type: application/json

{
  "toolId": "email",
  "args": {
    "to": "user@example.com",
    "subject": "Hello",
    "body": "World"
  },
  "async": false
}
\`\`\`

### Health Check
\`\`\`http
GET /api/v1/mcp/health
\`\`\`

### System Metrics
\`\`\`http
GET /api/v1/mcp/metrics?period=day
\`\`\`

## Available Tools

`

    // Grouper les outils par catégorie
    const toolsByCategory = tools.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = []
      acc[tool.category].push(tool)
      return acc
    }, {} as Record<string, any[]>)

    for (const [category, categoryTools] of Object.entries(toolsByCategory)) {
      markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Tools\n\n`

      for (const tool of categoryTools) {
        markdown += `#### ${tool.name} (\`${tool.id}\`)

${tool.description}

**Version:** ${tool.version}
**Author:** ${tool.author || 'MCP Team'}
**Tags:** ${tool.tags.join(', ')}

**Capabilities:**
- Async: ${tool.capabilities.async ? '✅' : '❌'}
- Batch: ${tool.capabilities.batch ? '✅' : '❌'}
- Streaming: ${tool.capabilities.streaming ? '✅' : '❌'}
- Webhook: ${tool.capabilities.webhook ? '✅' : '❌'}

${tool.rateLimit ? `**Rate Limit:** ${tool.rateLimit.requests} requests per ${tool.rateLimit.period}` : ''}
${tool.cache ? `**Cache:** ${tool.cache.enabled ? 'Enabled' : 'Disabled'} (${tool.cache.ttl}s TTL)` : ''}

**Example Usage:**
\`\`\`json
{
  "toolId": "${tool.id}",
  "args": {
    // Tool-specific arguments
  }
}
\`\`\`

---

`
      }
    }

    markdown += `## Categories Summary

| Category | Tools | Description |
|----------|-------|-------------|
`

    for (const [category, count] of Object.entries(stats.toolsByCategory)) {
      markdown += `| ${category.charAt(0).toUpperCase() + category.slice(1)} | ${count} | ${this.getCategoryDescription(category)} |\n`
    }

    markdown += `
## Rate Limiting

Different tools have different rate limits to ensure fair usage:

- **Communication tools**: 100-200 requests/hour
- **Productivity tools**: 50-200 requests/hour
- **Development tools**: 500 requests/hour
- **Data tools**: 1000 requests/hour

## Caching

Tools implement intelligent caching strategies:

- **Memory cache**: Fast access for frequently used data
- **Redis cache**: Distributed caching for scalability
- **Hybrid cache**: Best of both worlds

## Error Handling

The API provides comprehensive error handling:

- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Tool or resource not found
- **429 Rate Limited**: Too many requests
- **500 Internal Error**: Server-side error

## Support

For support and questions:
- 📧 Email: admin@example.com
- 📚 Documentation: Auto-generated from code
- 🔧 API Key: mcp-default-key-12345 (for testing)

---

*This documentation is auto-generated and always up-to-date with the current API implementation.*
`

    return markdown
  }

  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      communication: 'Email, messaging, and communication tools',
      productivity: 'Calendar, task management, and productivity tools',
      development: 'Git, CI/CD, and development workflow tools',
      data: 'Database, API, and data processing tools'
    }
    return descriptions[category] || 'General purpose tools'
  }

  async generateREADME(): Promise<string> {
    const markdown = await this.generateMarkdown()
    return markdown
  }
}

// Instance globale
export const docsGenerator = new DocsGenerator()
