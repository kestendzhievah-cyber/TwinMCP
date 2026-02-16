import { RBACService } from '../../../lib/mcp/middleware/rbac'

describe('RBACService', () => {
  let rbac: RBACService

  beforeEach(() => {
    rbac = new RBACService()
  })

  describe('Predefined roles', () => {
    it('has 5 predefined roles', () => {
      expect(rbac.getAllRoles().length).toBe(5)
    })

    it('includes admin, manager, developer, viewer, anonymous', () => {
      const names = rbac.getAllRoles().map(r => r.name)
      expect(names).toContain('admin')
      expect(names).toContain('manager')
      expect(names).toContain('developer')
      expect(names).toContain('viewer')
      expect(names).toContain('anonymous')
    })

    it('admin has global admin action', () => {
      const admin = rbac.getRole('admin')!
      const globalPerm = admin.permissions.find(p => p.resource === 'global')
      expect(globalPerm?.actions).toContain('admin')
    })
  })

  describe('Role assignment', () => {
    it('assigns a role to a user', () => {
      rbac.assignRole('user-1', 'developer')
      expect(rbac.getUserRoles('user-1')).toEqual(['developer'])
    })

    it('does not duplicate roles', () => {
      rbac.assignRole('user-1', 'developer')
      rbac.assignRole('user-1', 'developer')
      expect(rbac.getUserRoles('user-1')).toEqual(['developer'])
    })

    it('supports multiple roles per user', () => {
      rbac.assignRole('user-1', 'developer')
      rbac.assignRole('user-1', 'manager')
      expect(rbac.getUserRoles('user-1')).toEqual(['developer', 'manager'])
    })

    it('throws for unknown role', () => {
      expect(() => rbac.assignRole('user-1', 'superadmin' as any)).toThrow('Unknown role')
    })

    it('removes a role', () => {
      rbac.assignRole('user-1', 'developer')
      rbac.assignRole('user-1', 'manager')
      expect(rbac.removeRole('user-1', 'developer')).toBe(true)
      expect(rbac.getUserRoles('user-1')).toEqual(['manager'])
    })

    it('returns false when removing non-assigned role', () => {
      expect(rbac.removeRole('user-1', 'admin')).toBe(false)
    })
  })

  describe('Permission resolution', () => {
    it('admin inherits all permissions from manager, developer, viewer', () => {
      rbac.assignRole('user-1', 'admin')
      const perms = rbac.getEffectivePermissions('user-1')
      const resources = perms.map(p => p.resource)
      expect(resources).toContain('global')
      expect(resources).toContain('tools')
    })

    it('developer inherits viewer permissions', () => {
      rbac.assignRole('user-1', 'developer')
      const perms = rbac.getEffectivePermissions('user-1')
      const actions = perms.flatMap(p => p.actions)
      expect(actions).toContain('read')
      expect(actions).toContain('execute')
    })

    it('anonymous gets minimal permissions when no role assigned', () => {
      const perms = rbac.getEffectivePermissions('unknown-user')
      expect(perms.length).toBe(1)
      expect(perms[0].resource).toBe('global')
      expect(perms[0].actions).toEqual(['read'])
    })
  })

  describe('hasPermission', () => {
    it('admin can do anything', () => {
      rbac.assignRole('user-1', 'admin')
      expect(rbac.hasPermission('user-1', 'tools', 'execute')).toBe(true)
      expect(rbac.hasPermission('user-1', 'users', 'delete')).toBe(true)
    })

    it('viewer cannot execute', () => {
      rbac.assignRole('user-1', 'viewer')
      expect(rbac.hasPermission('user-1', 'tools', 'read')).toBe(true)
      expect(rbac.hasPermission('user-1', 'tools', 'execute')).toBe(false)
    })

    it('developer can execute tools', () => {
      rbac.assignRole('user-1', 'developer')
      expect(rbac.hasPermission('user-1', 'tools', 'execute')).toBe(true)
    })
  })

  describe('hasRoleOrHigher', () => {
    it('admin is higher than developer', () => {
      rbac.assignRole('user-1', 'admin')
      expect(rbac.hasRoleOrHigher('user-1', 'developer')).toBe(true)
    })

    it('viewer is not higher than developer', () => {
      rbac.assignRole('user-1', 'viewer')
      expect(rbac.hasRoleOrHigher('user-1', 'developer')).toBe(false)
    })

    it('developer matches developer', () => {
      rbac.assignRole('user-1', 'developer')
      expect(rbac.hasRoleOrHigher('user-1', 'developer')).toBe(true)
    })
  })
})
