import { DependencyGraphService, DependencyInput } from '../../src/services/library/dependency-graph.service'

describe('DependencyGraphService', () => {
  let service: DependencyGraphService

  beforeEach(() => {
    service = new DependencyGraphService()
  })

  function makeLibMap(...libs: DependencyInput[]): Map<string, DependencyInput> {
    const map = new Map<string, DependencyInput>()
    for (const lib of libs) map.set(lib.id, lib)
    return map
  }

  describe('buildGraph', () => {
    it('builds a graph from a root with direct dependencies', () => {
      const root: DependencyInput = {
        id: 'app', name: 'my-app', version: '1.0.0',
        dependencies: [
          { id: 'react', name: 'react', version: '18.2.0' },
          { id: 'lodash', name: 'lodash', version: '4.17.21' },
        ],
      }
      const libs = makeLibMap(root,
        { id: 'react', name: 'react', version: '18.2.0' },
        { id: 'lodash', name: 'lodash', version: '4.17.21' },
      )

      const graph = service.buildGraph(root, libs)
      expect(graph.stats.totalNodes).toBe(3)
      expect(graph.stats.totalEdges).toBe(2)
      expect(graph.stats.maxDepth).toBe(1)
      expect(graph.stats.hasCycles).toBe(false)
    })

    it('handles transitive dependencies', () => {
      const root: DependencyInput = {
        id: 'app', name: 'my-app',
        dependencies: [{ id: 'a', name: 'a' }],
      }
      const a: DependencyInput = {
        id: 'a', name: 'a',
        dependencies: [{ id: 'b', name: 'b' }],
      }
      const b: DependencyInput = { id: 'b', name: 'b' }
      const libs = makeLibMap(root, a, b)

      const graph = service.buildGraph(root, libs)
      expect(graph.stats.totalNodes).toBe(3)
      expect(graph.stats.maxDepth).toBe(2)
      expect(graph.nodes.find(n => n.id === 'b')?.type).toBe('transitive')
    })

    it('detects cycles', () => {
      const root: DependencyInput = {
        id: 'a', name: 'a',
        dependencies: [{ id: 'b', name: 'b' }],
      }
      const b: DependencyInput = {
        id: 'b', name: 'b',
        dependencies: [{ id: 'a', name: 'a' }],
      }
      const libs = makeLibMap(root, b)

      const graph = service.buildGraph(root, libs)
      expect(graph.stats.hasCycles).toBe(true)
      expect(graph.stats.cycles.length).toBeGreaterThan(0)
    })

    it('respects maxDepth', () => {
      const root: DependencyInput = {
        id: 'a', name: 'a',
        dependencies: [{ id: 'b', name: 'b' }],
      }
      const b: DependencyInput = {
        id: 'b', name: 'b',
        dependencies: [{ id: 'c', name: 'c' }],
      }
      const c: DependencyInput = { id: 'c', name: 'c' }
      const libs = makeLibMap(root, b, c)

      const graph = service.buildGraph(root, libs, 1)
      // Should only go 1 level deep: root + b
      expect(graph.nodes.find(n => n.id === 'c')).toBeUndefined()
    })

    it('handles empty dependencies', () => {
      const root: DependencyInput = { id: 'app', name: 'my-app' }
      const graph = service.buildGraph(root, makeLibMap(root))
      expect(graph.stats.totalNodes).toBe(1)
      expect(graph.stats.totalEdges).toBe(0)
    })
  })

  describe('flattenDependencies', () => {
    it('returns all non-root nodes', () => {
      const root: DependencyInput = {
        id: 'app', name: 'app',
        dependencies: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
      }
      const libs = makeLibMap(root,
        { id: 'a', name: 'a' },
        { id: 'b', name: 'b' },
      )
      const graph = service.buildGraph(root, libs)
      const flat = service.flattenDependencies(graph)
      expect(flat.length).toBe(2)
      expect(flat.every(n => n.type !== 'root')).toBe(true)
    })
  })

  describe('findPaths', () => {
    it('finds paths from root to a target', () => {
      const root: DependencyInput = {
        id: 'app', name: 'app',
        dependencies: [{ id: 'a', name: 'a' }],
      }
      const a: DependencyInput = {
        id: 'a', name: 'a',
        dependencies: [{ id: 'b', name: 'b' }],
      }
      const b: DependencyInput = { id: 'b', name: 'b' }
      const libs = makeLibMap(root, a, b)
      const graph = service.buildGraph(root, libs)

      const paths = service.findPaths(graph, 'b')
      expect(paths.length).toBe(1)
      expect(paths[0]).toEqual(['app', 'a', 'b'])
    })

    it('returns empty for non-existent target', () => {
      const root: DependencyInput = { id: 'app', name: 'app' }
      const graph = service.buildGraph(root, makeLibMap(root))
      expect(service.findPaths(graph, 'unknown')).toEqual([])
    })
  })

  describe('toVisualizationJSON', () => {
    it('exports graph in visualization format', () => {
      const root: DependencyInput = {
        id: 'app', name: 'app', version: '1.0.0',
        dependencies: [{ id: 'a', name: 'a', version: '2.0.0' }],
      }
      const libs = makeLibMap(root, { id: 'a', name: 'a', version: '2.0.0' })
      const graph = service.buildGraph(root, libs)
      const viz = service.toVisualizationJSON(graph)

      expect(viz.nodes.length).toBe(2)
      expect(viz.edges.length).toBe(1)
      expect(viz.nodes[0].data.label).toBe('app@1.0.0')
    })
  })
})
