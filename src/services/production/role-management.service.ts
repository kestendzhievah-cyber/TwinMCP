/**
 * Role Management UI Service.
 *
 * Backend service for role/permission management UI:
 *   - Role CRUD with hierarchical inheritance
 *   - Permission CRUD with resource/action granularity
 *   - User-role assignment
 *   - Role templates (predefined sets)
 *   - Permission audit (who has access to what)
 *   - Bulk operations
 */

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  inheritsFrom?: string
  isSystem: boolean
  userCount: number
  createdAt: string
  updatedAt: string
}

export interface Permission {
  id: string
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | '*'
  conditions?: Record<string, any>
}

export interface UserRoleAssignment {
  userId: string
  roleId: string
  assignedAt: string
  assignedBy: string
  expiresAt?: string
}

export interface RoleTemplate {
  id: string
  name: string
  description: string
  permissions: Array<{ resource: string; actions: string[] }>
}

export interface PermissionAuditEntry {
  userId: string
  roles: string[]
  effectivePermissions: Permission[]
  inheritedFrom: Record<string, string[]>
}

export class RoleManagementService {
  private roles: Map<string, Role> = new Map()
  private assignments: UserRoleAssignment[] = []
  private templates: Map<string, RoleTemplate> = new Map()
  private idCounter = 0

  constructor() {
    this.initializeDefaults()
  }

  // ── Role CRUD ──────────────────────────────────────────────

  createRole(name: string, description: string = '', inheritsFrom?: string): Role {
    const role: Role = {
      id: `role-${++this.idCounter}`, name, description,
      permissions: [], inheritsFrom, isSystem: false, userCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    this.roles.set(role.id, role)
    return role
  }

  getRole(id: string): Role | undefined { return this.roles.get(id) }
  getRoles(): Role[] { return Array.from(this.roles.values()) }
  getRoleByName(name: string): Role | undefined { return this.getRoles().find(r => r.name === name) }

  updateRole(id: string, updates: Partial<Pick<Role, 'name' | 'description' | 'inheritsFrom'>>): boolean {
    const role = this.roles.get(id)
    if (!role || role.isSystem) return false
    if (updates.name) role.name = updates.name
    if (updates.description !== undefined) role.description = updates.description
    if (updates.inheritsFrom !== undefined) role.inheritsFrom = updates.inheritsFrom
    role.updatedAt = new Date().toISOString()
    return true
  }

  deleteRole(id: string): boolean {
    const role = this.roles.get(id)
    if (!role || role.isSystem) return false
    this.assignments = this.assignments.filter(a => a.roleId !== id)
    return this.roles.delete(id)
  }

  // ── Permission Management ──────────────────────────────────

  addPermission(roleId: string, resource: string, action: Permission['action'], conditions?: Record<string, any>): Permission | null {
    const role = this.roles.get(roleId)
    if (!role) return null
    const existing = role.permissions.find(p => p.resource === resource && p.action === action)
    if (existing) return existing
    const perm: Permission = { id: `perm-${++this.idCounter}`, resource, action, conditions }
    role.permissions.push(perm)
    role.updatedAt = new Date().toISOString()
    return perm
  }

  removePermission(roleId: string, permissionId: string): boolean {
    const role = this.roles.get(roleId)
    if (!role) return false
    const idx = role.permissions.findIndex(p => p.id === permissionId)
    if (idx === -1) return false
    role.permissions.splice(idx, 1)
    role.updatedAt = new Date().toISOString()
    return true
  }

  getEffectivePermissions(roleId: string): Permission[] {
    const role = this.roles.get(roleId)
    if (!role) return []
    const perms = [...role.permissions]
    if (role.inheritsFrom) {
      const parent = this.roles.get(role.inheritsFrom)
      if (parent) {
        for (const perm of this.getEffectivePermissions(parent.id)) {
          if (!perms.find(p => p.resource === perm.resource && p.action === perm.action)) {
            perms.push(perm)
          }
        }
      }
    }
    return perms
  }

  // ── User-Role Assignment ───────────────────────────────────

  assignRole(userId: string, roleId: string, assignedBy: string, expiresAt?: string): boolean {
    const role = this.roles.get(roleId)
    if (!role) return false
    const existing = this.assignments.find(a => a.userId === userId && a.roleId === roleId)
    if (existing) return false
    this.assignments.push({ userId, roleId, assignedAt: new Date().toISOString(), assignedBy, expiresAt })
    role.userCount++
    return true
  }

  revokeRole(userId: string, roleId: string): boolean {
    const idx = this.assignments.findIndex(a => a.userId === userId && a.roleId === roleId)
    if (idx === -1) return false
    this.assignments.splice(idx, 1)
    const role = this.roles.get(roleId)
    if (role) role.userCount = Math.max(0, role.userCount - 1)
    return true
  }

  getUserRoles(userId: string): Role[] {
    const roleIds = this.assignments.filter(a => a.userId === userId).map(a => a.roleId)
    return roleIds.map(id => this.roles.get(id)!).filter(Boolean)
  }

  getRoleUsers(roleId: string): string[] {
    return this.assignments.filter(a => a.roleId === roleId).map(a => a.userId)
  }

  getAssignments(): UserRoleAssignment[] { return [...this.assignments] }

  // ── Bulk Operations ────────────────────────────────────────

  bulkAssignRole(userIds: string[], roleId: string, assignedBy: string): number {
    let count = 0
    for (const userId of userIds) {
      if (this.assignRole(userId, roleId, assignedBy)) count++
    }
    return count
  }

  bulkRevokeRole(userIds: string[], roleId: string): number {
    let count = 0
    for (const userId of userIds) {
      if (this.revokeRole(userId, roleId)) count++
    }
    return count
  }

  // ── Permission Audit ───────────────────────────────────────

  auditUserPermissions(userId: string): PermissionAuditEntry {
    const roles = this.getUserRoles(userId)
    const inheritedFrom: Record<string, string[]> = {}
    const allPerms: Permission[] = []

    for (const role of roles) {
      const effective = this.getEffectivePermissions(role.id)
      for (const perm of effective) {
        if (!allPerms.find(p => p.resource === perm.resource && p.action === perm.action)) {
          allPerms.push(perm)
        }
        const key = `${perm.resource}:${perm.action}`
        if (!inheritedFrom[key]) inheritedFrom[key] = []
        inheritedFrom[key].push(role.name)
      }
    }

    return { userId, roles: roles.map(r => r.name), effectivePermissions: allPerms, inheritedFrom }
  }

  hasPermission(userId: string, resource: string, action: Permission['action']): boolean {
    const audit = this.auditUserPermissions(userId)
    return audit.effectivePermissions.some(p =>
      (p.resource === resource || p.resource === '*') && (p.action === action || p.action === '*')
    )
  }

  // ── Templates ──────────────────────────────────────────────

  getTemplates(): RoleTemplate[] { return Array.from(this.templates.values()) }

  applyTemplate(templateId: string, roleId: string): boolean {
    const template = this.templates.get(templateId)
    const role = this.roles.get(roleId)
    if (!template || !role) return false
    for (const p of template.permissions) {
      for (const action of p.actions) {
        this.addPermission(roleId, p.resource, action as Permission['action'])
      }
    }
    return true
  }

  // ── Internal ───────────────────────────────────────────────

  private initializeDefaults(): void {
    const admin = this.createRole('admin', 'Full system access')
    admin.isSystem = true
    this.addPermission(admin.id, '*', '*')

    const manager = this.createRole('manager', 'Team management', admin.id)
    manager.isSystem = true
    for (const res of ['users', 'api-keys', 'billing', 'analytics']) {
      this.addPermission(manager.id, res, 'read')
      this.addPermission(manager.id, res, 'update')
    }

    const developer = this.createRole('developer', 'API and MCP access', manager.id)
    developer.isSystem = true
    for (const res of ['mcp', 'libraries', 'docs', 'chat']) {
      this.addPermission(developer.id, res, '*')
    }

    const viewer = this.createRole('viewer', 'Read-only access')
    viewer.isSystem = true
    this.addPermission(viewer.id, '*', 'read')

    this.templates.set('api-developer', {
      id: 'api-developer', name: 'API Developer',
      description: 'Access to API and MCP tools',
      permissions: [
        { resource: 'mcp', actions: ['read', 'execute'] },
        { resource: 'libraries', actions: ['read'] },
        { resource: 'docs', actions: ['read'] },
        { resource: 'api-keys', actions: ['read', 'create'] },
      ],
    })
    this.templates.set('billing-admin', {
      id: 'billing-admin', name: 'Billing Admin',
      description: 'Full billing access',
      permissions: [
        { resource: 'billing', actions: ['*'] },
        { resource: 'invoices', actions: ['*'] },
        { resource: 'subscriptions', actions: ['*'] },
      ],
    })
  }
}

export const roleManagementService = new RoleManagementService()
