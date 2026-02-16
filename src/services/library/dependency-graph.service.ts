/**
 * Dependency Graph Visualization Service.
 *
 * Builds a visual-ready dependency graph (nodes + edges) from library
 * dependency data. Outputs a structure suitable for rendering with
 * D3.js, Cytoscape.js, or any graph visualization library.
 *
 * Features:
 *   - Directed acyclic graph (DAG) construction
 *   - Cycle detection
 *   - Depth-limited traversal
 *   - Layout hints (levels) for hierarchical rendering
 *   - JSON export for frontend consumption
 */

export interface GraphNode {
  id: string
  name: string
  version?: string
  level: number
  type: 'root' | 'direct' | 'transitive' | 'dev'
  metadata?: Record<string, any>
}

export interface GraphEdge {
  source: string
  target: string
  type: 'runtime' | 'dev' | 'peer' | 'optional'
  versionConstraint?: string
}

export interface DependencyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    maxDepth: number
    hasCycles: boolean
    cycles: string[][]
  }
}

export interface DependencyInput {
  id: string
  name: string
  version?: string
  dependencies?: Array<{
    name: string
    id: string
    version?: string
    versionConstraint?: string
    type?: 'runtime' | 'dev' | 'peer' | 'optional'
  }>
}

export class DependencyGraphService {
  /**
   * Build a full dependency graph from a root library.
   */
  buildGraph(
    root: DependencyInput,
    allLibraries: Map<string, DependencyInput>,
    maxDepth: number = 10
  ): DependencyGraph {
    const nodes: Map<string, GraphNode> = new Map()
    const edges: GraphEdge[] = []
    const visited = new Set<string>()
    const cycles: string[][] = []

    // BFS with depth tracking
    const queue: Array<{ lib: DependencyInput; level: number; path: string[] }> = [
      { lib: root, level: 0, path: [root.id] },
    ]

    nodes.set(root.id, {
      id: root.id,
      name: root.name,
      version: root.version,
      level: 0,
      type: 'root',
    })

    while (queue.length > 0) {
      const { lib, level, path } = queue.shift()!

      if (level >= maxDepth) continue
      if (visited.has(lib.id)) continue
      visited.add(lib.id)

      for (const dep of lib.dependencies || []) {
        const depType = dep.type || 'runtime'

        // Add edge
        edges.push({
          source: lib.id,
          target: dep.id,
          type: depType,
          versionConstraint: dep.versionConstraint,
        })

        // Cycle detection
        if (path.includes(dep.id)) {
          cycles.push([...path, dep.id])
          continue
        }

        // Add node if not seen
        if (!nodes.has(dep.id)) {
          nodes.set(dep.id, {
            id: dep.id,
            name: dep.name,
            version: dep.version,
            level: level + 1,
            type: level === 0 ? 'direct' : 'transitive',
          })
        }

        // Recurse into dependency
        const depLib = allLibraries.get(dep.id)
        if (depLib) {
          queue.push({ lib: depLib, level: level + 1, path: [...path, dep.id] })
        }
      }
    }

    const nodeArray = Array.from(nodes.values())
    const maxLevel = nodeArray.reduce((max, n) => Math.max(max, n.level), 0)

    return {
      nodes: nodeArray,
      edges,
      stats: {
        totalNodes: nodeArray.length,
        totalEdges: edges.length,
        maxDepth: maxLevel,
        hasCycles: cycles.length > 0,
        cycles,
      },
    }
  }

  /**
   * Get a flat list of all transitive dependencies (deduplicated).
   */
  flattenDependencies(graph: DependencyGraph): GraphNode[] {
    return graph.nodes.filter(n => n.type !== 'root')
  }

  /**
   * Find all paths from root to a specific dependency.
   */
  findPaths(graph: DependencyGraph, targetId: string): string[][] {
    const adjacency = new Map<string, string[]>()
    for (const edge of graph.edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
      adjacency.get(edge.source)!.push(edge.target)
    }

    const root = graph.nodes.find(n => n.type === 'root')
    if (!root) return []

    const paths: string[][] = []
    const dfs = (current: string, path: string[]) => {
      if (current === targetId) {
        paths.push([...path])
        return
      }
      for (const neighbor of adjacency.get(current) || []) {
        if (!path.includes(neighbor)) {
          dfs(neighbor, [...path, neighbor])
        }
      }
    }

    dfs(root.id, [root.id])
    return paths
  }

  /**
   * Export graph as JSON suitable for visualization libraries.
   */
  toVisualizationJSON(graph: DependencyGraph): {
    nodes: Array<{ data: { id: string; label: string; level: number; type: string } }>
    edges: Array<{ data: { source: string; target: string; type: string } }>
  } {
    return {
      nodes: graph.nodes.map(n => ({
        data: { id: n.id, label: `${n.name}${n.version ? '@' + n.version : ''}`, level: n.level, type: n.type },
      })),
      edges: graph.edges.map(e => ({
        data: { source: e.source, target: e.target, type: e.type },
      })),
    }
  }
}

export const dependencyGraphService = new DependencyGraphService()
