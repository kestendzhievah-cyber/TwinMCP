import { ContextTemplateEngine } from '../src/services/context-template.service'

describe('ContextTemplateEngine', () => {
  let engine: ContextTemplateEngine

  beforeEach(() => {
    engine = new ContextTemplateEngine()
  })

  describe('Default templates', () => {
    it('initializes with 5 default templates', async () => {
      const templates = await engine.listTemplates()
      expect(templates.length).toBe(5)
    })

    it('has general_context, code_context, api_context, example_context, tutorial_context types', async () => {
      const templates = await engine.listTemplates()
      const types = templates.map(t => t.type)
      expect(types).toContain('general_context')
      expect(types).toContain('code_context')
      expect(types).toContain('api_context')
      expect(types).toContain('example_context')
      expect(types).toContain('tutorial_context')
    })
  })

  describe('getTemplate', () => {
    it('throws for unknown template type', async () => {
      await expect(engine.getTemplate('nonexistent')).rejects.toThrow('Template not found')
    })

    it('increments usageCount on each access', async () => {
      const templates = await engine.listTemplates()
      const id = templates[0].id
      const t1 = await engine.getTemplate(id)
      expect(t1.metadata.usageCount).toBe(1)
      const t2 = await engine.getTemplate(id)
      expect(t2.metadata.usageCount).toBe(2)
    })
  })

  describe('render', () => {
    it('substitutes {{variable}} placeholders', async () => {
      const result = await engine.render('Hello {{name}}, welcome to {{place}}!', {
        name: 'Alice',
        place: 'TwinMCP',
      })
      expect(result).toBe('Hello Alice, welcome to TwinMCP!')
    })

    it('replaces missing variables with [varName]', async () => {
      const result = await engine.render('Hello {{name}}, your role is {{role}}', {
        name: 'Bob',
      })
      expect(result).toBe('Hello Bob, your role is [role]')
    })

    it('processes conditionals — truthy', async () => {
      const result = await engine.render(
        'Start {% if showExtra %}EXTRA{% endif %} End',
        { showExtra: true }
      )
      expect(result).toBe('Start EXTRA End')
    })

    it('processes conditionals — falsy', async () => {
      const result = await engine.render(
        'Start {% if showExtra %}EXTRA{% endif %} End',
        { showExtra: false }
      )
      expect(result).toBe('Start  End')
    })

    it('processes loops', async () => {
      const result = await engine.render(
        '{% for item in items %}{{item.name}},{% endfor %}',
        { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }
      )
      expect(result).toBe('A,B,C,')
    })

    it('provides loop index variable alongside item props', async () => {
      const result = await engine.render(
        '{% for item in items %}{{item.name}}{% endfor %}',
        { items: [{ name: 'A' }, { name: 'B' }] }
      )
      expect(result).toBe('AB')
    })

    it('handles empty array in loop', async () => {
      const result = await engine.render(
        'Before {% for item in items %}{{item.name}}{% endfor %} After',
        { items: [] }
      )
      expect(result).toBe('Before  After')
    })

    it('handles non-array in loop gracefully', async () => {
      const result = await engine.render(
        'Before {% for item in items %}{{item.name}}{% endfor %} After',
        { items: 'not-an-array' }
      )
      expect(result).toBe('Before  After')
    })

    it('accepts a ContextTemplate object', async () => {
      const templates = await engine.listTemplates()
      const template = templates[0]
      const result = await engine.render(template, {
        summary: 'Test summary',
        userMessage: 'How do I use X?',
      })
      expect(result).toContain('Test summary')
      expect(result).toContain('How do I use X?')
    })
  })

  describe('CRUD operations', () => {
    it('createTemplate adds a new template', async () => {
      const before = (await engine.listTemplates()).length
      const created = await engine.createTemplate({
        name: 'Custom',
        type: 'custom' as any,
        template: 'Hello {{who}}',
        variables: ['who'],
      })
      expect(created.id).toBeDefined()
      expect(created.metadata.usageCount).toBe(0)
      const after = (await engine.listTemplates()).length
      expect(after).toBe(before + 1)
    })

    it('updateTemplate modifies an existing template', async () => {
      const created = await engine.createTemplate({
        name: 'Original',
        type: 'test' as any,
        template: 'v1',
        variables: [],
      })
      const updated = await engine.updateTemplate(created.id, { name: 'Updated' })
      expect(updated.name).toBe('Updated')
      expect(updated.id).toBe(created.id)
    })

    it('updateTemplate throws for unknown id', async () => {
      await expect(engine.updateTemplate('bad-id', {})).rejects.toThrow('Template not found')
    })

    it('deleteTemplate removes a template', async () => {
      const created = await engine.createTemplate({
        name: 'ToDelete',
        type: 'test' as any,
        template: 'bye',
        variables: [],
      })
      await engine.deleteTemplate(created.id)
      await expect(engine.getTemplate(created.id)).rejects.toThrow('Template not found')
    })

    it('deleteTemplate throws for unknown id', async () => {
      await expect(engine.deleteTemplate('bad-id')).rejects.toThrow('Template not found')
    })
  })

  describe('getTemplateStats', () => {
    it('returns stats with total, byType, and mostUsed', async () => {
      const stats = await engine.getTemplateStats()
      expect(stats.total).toBe(5)
      expect(stats.byType).toHaveProperty('general_context', 1)
      expect(stats.mostUsed.length).toBeLessThanOrEqual(5)
    })
  })
})
