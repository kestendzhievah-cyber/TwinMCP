/**
 * GraphQL Gateway for MCP API.
 *
 * Provides a lightweight GraphQL layer over the existing MCP tools and services.
 * No external GraphQL library required — implements a minimal schema-first
 * execution engine that resolves queries against MCP tools and resources.
 *
 * Endpoints:
 *   POST /api/graphql  — Execute GraphQL queries/mutations
 *   GET  /api/graphql  — GraphQL Playground / introspection
 */

export interface GraphQLField {
  type: string
  description?: string
  args?: Record<string, { type: string; required?: boolean; defaultValue?: any }>
  resolve: (parent: any, args: any, context: GraphQLContext) => Promise<any> | any
}

export interface GraphQLType {
  name: string
  description?: string
  fields: Record<string, GraphQLField>
}

export interface GraphQLContext {
  userId?: string
  apiKey?: string
  isAuthenticated: boolean
  [key: string]: any
}

export interface GraphQLRequest {
  query: string
  variables?: Record<string, any>
  operationName?: string
}

export interface GraphQLResponse {
  data?: Record<string, any> | null
  errors?: Array<{ message: string; path?: string[]; extensions?: any }>
}

export class GraphQLGateway {
  private queryFields: Map<string, GraphQLField> = new Map()
  private mutationFields: Map<string, GraphQLField> = new Map()
  private types: Map<string, GraphQLType> = new Map()

  /** Register a query field. */
  addQuery(name: string, field: GraphQLField): void {
    this.queryFields.set(name, field)
  }

  /** Register a mutation field. */
  addMutation(name: string, field: GraphQLField): void {
    this.mutationFields.set(name, field)
  }

  /** Register a custom type. */
  addType(type: GraphQLType): void {
    this.types.set(type.name, type)
  }

  /** Execute a GraphQL request. */
  async execute(request: GraphQLRequest, context: GraphQLContext): Promise<GraphQLResponse> {
    try {
      const { query, variables } = request

      if (!query || typeof query !== 'string') {
        return { errors: [{ message: 'Query is required' }] }
      }

      const parsed = this.parseQuery(query)

      if (parsed.errors.length > 0) {
        return { errors: parsed.errors }
      }

      const data: Record<string, any> = {}
      const errors: GraphQLResponse['errors'] = []

      for (const selection of parsed.selections) {
        const fields = parsed.type === 'mutation' ? this.mutationFields : this.queryFields
        const field = fields.get(selection.name)

        if (!field) {
          errors.push({ message: `Field "${selection.name}" not found on type "${parsed.type === 'mutation' ? 'Mutation' : 'Query'}"`, path: [selection.name] })
          continue
        }

        try {
          const resolvedArgs = this.resolveArgs(selection.args, field.args || {}, variables || {})
          data[selection.alias || selection.name] = await field.resolve(null, resolvedArgs, context)
        } catch (err) {
          errors.push({
            message: err instanceof Error ? err.message : String(err),
            path: [selection.name],
          })
        }
      }

      return {
        data: Object.keys(data).length > 0 ? data : null,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (err) {
      return {
        errors: [{ message: err instanceof Error ? err.message : 'Internal GraphQL error' }],
      }
    }
  }

  /** Generate a schema description for introspection. */
  getSchema(): {
    queries: Array<{ name: string; type: string; description?: string; args: any }>
    mutations: Array<{ name: string; type: string; description?: string; args: any }>
    types: Array<{ name: string; description?: string; fields: any }>
  } {
    const mapFields = (fields: Map<string, GraphQLField>) =>
      Array.from(fields.entries()).map(([name, f]) => ({
        name,
        type: f.type,
        description: f.description,
        args: f.args || {},
      }))

    return {
      queries: mapFields(this.queryFields),
      mutations: mapFields(this.mutationFields),
      types: Array.from(this.types.values()).map(t => ({
        name: t.name,
        description: t.description,
        fields: Object.fromEntries(
          Object.entries(t.fields).map(([k, v]) => [k, { type: v.type, description: v.description }])
        ),
      })),
    }
  }

  // ── Minimal Query Parser ───────────────────────────────────

  private parseQuery(query: string): {
    type: 'query' | 'mutation'
    selections: Array<{ name: string; alias?: string; args: Record<string, any> }>
    errors: Array<{ message: string }>
  } {
    const trimmed = query.trim()
    const errors: Array<{ message: string }> = []

    let type: 'query' | 'mutation' = 'query'
    let body = trimmed

    // Detect operation type
    if (trimmed.startsWith('mutation')) {
      type = 'mutation'
      body = trimmed.replace(/^mutation\s*(\w+\s*)?(\([^)]*\)\s*)?/, '').trim()
    } else if (trimmed.startsWith('query')) {
      body = trimmed.replace(/^query\s*(\w+\s*)?(\([^)]*\)\s*)?/, '').trim()
    }

    // Strip outer braces
    if (body.startsWith('{') && body.endsWith('}')) {
      body = body.slice(1, -1).trim()
    } else {
      errors.push({ message: 'Query must be wrapped in { }' })
      return { type, selections: [], errors }
    }

    // Parse top-level selections
    const selections = this.parseSelections(body)

    return { type, selections, errors }
  }

  private parseSelections(body: string): Array<{ name: string; alias?: string; args: Record<string, any> }> {
    const selections: Array<{ name: string; alias?: string; args: Record<string, any> }> = []

    // Match field patterns: name(args) or alias: name(args)
    const fieldRegex = /(?:(\w+)\s*:\s*)?(\w+)(?:\s*\(([^)]*)\))?/g
    let match: RegExpExecArray | null

    while ((match = fieldRegex.exec(body)) !== null) {
      const alias = match[1] || undefined
      const name = match[2]
      const argsStr = match[3] || ''

      // Skip GraphQL keywords that might appear in sub-selections
      if (['__typename', 'on'].includes(name)) continue

      const args = this.parseArgs(argsStr)
      selections.push({ name, alias, args })

      // Skip past any sub-selection block { ... }
      const remaining = body.slice(match.index + match[0].length).trimStart()
      if (remaining.startsWith('{')) {
        const closeIdx = this.findMatchingBrace(remaining)
        if (closeIdx > 0) {
          fieldRegex.lastIndex = match.index + match[0].length + closeIdx + 1
        }
      }
    }

    return selections
  }

  private parseArgs(argsStr: string): Record<string, any> {
    const args: Record<string, any> = {}
    if (!argsStr.trim()) return args

    // Match key: value pairs
    const argRegex = /(\w+)\s*:\s*(?:"([^"]*)"|([\w.]+)|\$(\w+))/g
    let match: RegExpExecArray | null

    while ((match = argRegex.exec(argsStr)) !== null) {
      const key = match[1]
      if (match[2] !== undefined) {
        args[key] = match[2] // string value
      } else if (match[3] !== undefined) {
        // Try to parse as number/boolean
        const val = match[3]
        if (val === 'true') args[key] = true
        else if (val === 'false') args[key] = false
        else if (val === 'null') args[key] = null
        else if (!isNaN(Number(val))) args[key] = Number(val)
        else args[key] = val
      } else if (match[4] !== undefined) {
        args[key] = `$${match[4]}` // variable reference
      }
    }

    return args
  }

  private resolveArgs(
    parsed: Record<string, any>,
    schema: Record<string, { type: string; required?: boolean; defaultValue?: any }>,
    variables: Record<string, any>
  ): Record<string, any> {
    const resolved: Record<string, any> = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const varName = value.slice(1)
        resolved[key] = variables[varName] ?? schema[key]?.defaultValue
      } else {
        resolved[key] = value
      }
    }

    // Apply defaults for missing args
    for (const [key, def] of Object.entries(schema)) {
      if (resolved[key] === undefined && def.defaultValue !== undefined) {
        resolved[key] = def.defaultValue
      }
    }

    return resolved
  }

  private findMatchingBrace(str: string): number {
    let depth = 0
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '{') depth++
      if (str[i] === '}') {
        depth--
        if (depth === 0) return i
      }
    }
    return -1
  }
}

// ── Default MCP GraphQL Gateway ──────────────────────────────

export function createMCPGraphQLGateway(): GraphQLGateway {
  const gw = new GraphQLGateway()

  // Built-in queries
  gw.addQuery('health', {
    type: 'HealthStatus',
    description: 'System health check',
    resolve: () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  })

  gw.addQuery('_schema', {
    type: 'Schema',
    description: 'Introspection — list available queries and mutations',
    resolve: () => gw.getSchema(),
  })

  return gw
}
