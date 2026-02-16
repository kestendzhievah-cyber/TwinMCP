/**
 * Role-Based Access Control (RBAC) for MCP.
 *
 * Predefined roles with hierarchical permissions.
 * Roles: admin > manager > developer > viewer > anonymous
 */

import { Permission } from './auth-types'

export type RoleName = 'admin' | 'manager' | 'developer' | 'viewer' | 'anonymous'

export interface Role {
  name: RoleName
  description: string
  permissions: Permission[]
  /** Roles this role inherits from (lower privilege) */
  inherits?: RoleName[]
}

const PREDEFINED_ROLES: Record<RoleName, Role> = {
  admin: {
    name: 'admin',
    description: 'Full system access — manage users, tools, and configuration',
    permissions: [
      { resource: 'global', actions: ['read', 'write', 'execute', 'admin', 'delete'] },
    ],
    inherits: ['manager'],
  },
  manager: {
    name: 'manager',
    description: 'Manage tools, API keys, and view analytics',
    permissions: [
      { resource: 'global', actions: ['read', 'write', 'execute'] },
      { resource: 'api-keys', actions: ['read', 'write', 'delete'] },
      { resource: 'analytics', actions: ['read'] },
      { resource: 'users', actions: ['read'] },
    ],
    inherits: ['developer'],
  },
  developer: {
    name: 'developer',
    description: 'Execute tools, read docs, manage own API keys',
    permissions: [
      { resource: 'global', actions: ['read', 'execute'] },
      { resource: 'api-keys', actions: ['read', 'write'], conditions: { maxRequests: 1000 } },
      { resource: 'tools', actions: ['read', 'execute'] },
    ],
    inherits: ['viewer'],
  },
  viewer: {
    name: 'viewer',
    description: 'Read-only access to tools and documentation',
    permissions: [
      { resource: 'global', actions: ['read'] },
      { resource: 'tools', actions: ['read'] },
    ],
  },
  anonymous: {
    name: 'anonymous',
    description: 'Minimal access for unauthenticated users',
    permissions: [
      { resource: 'global', actions: ['read'], conditions: { maxRequests: 10 } },
    ],
  },
}

export class RBACService {
  private roles: Map<RoleName, Role> = new Map()
  private userRoles: Map<string, RoleName[]> = new Map()

  constructor() {
    // Load predefined roles
    for (const [name, role] of Object.entries(PREDEFINED_ROLES)) {
      this.roles.set(name as RoleName, role)
    }
  }

  /** Get a role definition by name. */
  getRole(name: RoleName): Role | undefined {
    return this.roles.get(name)
  }

  /** Get all predefined roles. */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values())
  }

  /** Assign a role to a user. */
  assignRole(userId: string, role: RoleName): void {
    if (!this.roles.has(role)) {
      throw new Error(`Unknown role: ${role}`)
    }
    const current = this.userRoles.get(userId) || []
    if (!current.includes(role)) {
      current.push(role)
      this.userRoles.set(userId, current)
    }
  }

  /** Remove a role from a user. */
  removeRole(userId: string, role: RoleName): boolean {
    const current = this.userRoles.get(userId)
    if (!current) return false
    const idx = current.indexOf(role)
    if (idx === -1) return false
    current.splice(idx, 1)
    if (current.length === 0) {
      this.userRoles.delete(userId)
    } else {
      this.userRoles.set(userId, current)
    }
    return true
  }

  /** Get all roles assigned to a user. */
  getUserRoles(userId: string): RoleName[] {
    return this.userRoles.get(userId) || []
  }

  /**
   * Resolve the effective permissions for a user by merging all assigned roles
   * (including inherited roles).
   */
  getEffectivePermissions(userId: string): Permission[] {
    const roles = this.getUserRoles(userId)
    if (roles.length === 0) {
      return PREDEFINED_ROLES.anonymous.permissions
    }

    const visited = new Set<RoleName>()
    const permissions: Permission[] = []

    const collect = (roleName: RoleName) => {
      if (visited.has(roleName)) return
      visited.add(roleName)

      const role = this.roles.get(roleName)
      if (!role) return

      permissions.push(...role.permissions)

      if (role.inherits) {
        for (const parent of role.inherits) {
          collect(parent)
        }
      }
    }

    for (const role of roles) {
      collect(role)
    }

    return permissions
  }

  /**
   * Check if a user has a specific permission on a resource.
   */
  hasPermission(userId: string, resource: string, action: string): boolean {
    const permissions = this.getEffectivePermissions(userId)

    return permissions.some(p => {
      const resourceMatch = p.resource === 'global' || p.resource === resource
      const actionMatch = p.actions.includes(action) || p.actions.includes('admin')
      return resourceMatch && actionMatch
    })
  }

  /**
   * Check if a user has a specific role (directly, not inherited).
   */
  hasRole(userId: string, role: RoleName): boolean {
    return this.getUserRoles(userId).includes(role)
  }

  /**
   * Check if a user has a role or any role that inherits from it.
   */
  hasRoleOrHigher(userId: string, minimumRole: RoleName): boolean {
    const hierarchy: RoleName[] = ['admin', 'manager', 'developer', 'viewer', 'anonymous']
    const minIdx = hierarchy.indexOf(minimumRole)
    const userRoles = this.getUserRoles(userId)

    return userRoles.some(r => hierarchy.indexOf(r) <= minIdx)
  }

  /** Register a custom role. */
  registerRole(role: Role): void {
    this.roles.set(role.name, role)
  }
}

export const rbacService = new RBACService()
