import { GraphQLGateway, createMCPGraphQLGateway, GraphQLContext } from '../../../lib/mcp/middleware/graphql'

function makeCtx(overrides: Partial<GraphQLContext> = {}): GraphQLContext {
  return { isAuthenticated: true, userId: 'user-1', ...overrides }
}

describe('GraphQLGateway', () => {
  let gw: GraphQLGateway

  beforeEach(() => {
    gw = new GraphQLGateway()
  })

  describe('Schema management', () => {
    it('registers query fields', () => {
      gw.addQuery('hello', { type: 'String', resolve: () => 'world' })
      expect(gw.getSchema().queries.length).toBe(1)
      expect(gw.getSchema().queries[0].name).toBe('hello')
    })

    it('registers mutation fields', () => {
      gw.addMutation('doThing', { type: 'Boolean', resolve: () => true })
      expect(gw.getSchema().mutations.length).toBe(1)
    })

    it('registers custom types', () => {
      gw.addType({
        name: 'Tool',
        description: 'An MCP tool',
        fields: {
          id: { type: 'String', resolve: () => '' },
          name: { type: 'String', resolve: () => '' },
        },
      })
      expect(gw.getSchema().types.length).toBe(1)
      expect(gw.getSchema().types[0].name).toBe('Tool')
    })
  })

  describe('Query execution', () => {
    it('executes a simple query', async () => {
      gw.addQuery('hello', { type: 'String', resolve: () => 'world' })

      const result = await gw.execute({ query: '{ hello }' }, makeCtx())
      expect(result.data?.hello).toBe('world')
      expect(result.errors).toBeUndefined()
    })

    it('executes a query with arguments', async () => {
      gw.addQuery('greet', {
        type: 'String',
        args: { name: { type: 'String', required: true } },
        resolve: (_p, args) => `Hello, ${args.name}!`,
      })

      const result = await gw.execute({ query: '{ greet(name: "Alice") }' }, makeCtx())
      expect(result.data?.greet).toBe('Hello, Alice!')
    })

    it('executes a query with numeric arguments', async () => {
      gw.addQuery('add', {
        type: 'Int',
        args: { a: { type: 'Int' }, b: { type: 'Int' } },
        resolve: (_p, args) => args.a + args.b,
      })

      const result = await gw.execute({ query: '{ add(a: 3, b: 4) }' }, makeCtx())
      expect(result.data?.add).toBe(7)
    })

    it('executes a query with variables', async () => {
      gw.addQuery('echo', {
        type: 'String',
        args: { msg: { type: 'String' } },
        resolve: (_p, args) => args.msg,
      })

      const result = await gw.execute(
        { query: '{ echo(msg: $input) }', variables: { input: 'test-var' } },
        makeCtx()
      )
      expect(result.data?.echo).toBe('test-var')
    })

    it('returns error for unknown field', async () => {
      const result = await gw.execute({ query: '{ unknown }' }, makeCtx())
      expect(result.errors).toBeDefined()
      expect(result.errors![0].message).toContain('not found')
    })

    it('returns error for missing query', async () => {
      const result = await gw.execute({ query: '' }, makeCtx())
      expect(result.errors).toBeDefined()
    })

    it('returns error for malformed query (no braces)', async () => {
      const result = await gw.execute({ query: 'hello' }, makeCtx())
      expect(result.errors).toBeDefined()
      expect(result.errors![0].message).toContain('{ }')
    })

    it('handles resolver errors gracefully', async () => {
      gw.addQuery('fail', {
        type: 'String',
        resolve: () => { throw new Error('boom') },
      })

      const result = await gw.execute({ query: '{ fail }' }, makeCtx())
      expect(result.errors).toBeDefined()
      expect(result.errors![0].message).toBe('boom')
      expect(result.errors![0].path).toEqual(['fail'])
    })
  })

  describe('Mutation execution', () => {
    it('executes a mutation', async () => {
      gw.addMutation('setFlag', {
        type: 'Boolean',
        args: { value: { type: 'Boolean' } },
        resolve: (_p, args) => args.value,
      })

      const result = await gw.execute(
        { query: 'mutation { setFlag(value: true) }' },
        makeCtx()
      )
      expect(result.data?.setFlag).toBe(true)
    })
  })

  describe('Default MCP gateway', () => {
    it('has health query', async () => {
      const mcpGw = createMCPGraphQLGateway()
      const result = await mcpGw.execute({ query: '{ health }' }, makeCtx())
      expect(result.data?.health).toBeDefined()
      expect(result.data?.health.status).toBe('healthy')
    })

    it('has _schema introspection query', async () => {
      const mcpGw = createMCPGraphQLGateway()
      const result = await mcpGw.execute({ query: '{ _schema }' }, makeCtx())
      expect(result.data?._schema).toBeDefined()
      expect(result.data?._schema.queries).toBeDefined()
    })
  })
})
