/**
 * Staging Environment Configuration Service.
 *
 * Multi-environment configuration management:
 *   - Environment definitions (dev, staging, production)
 *   - Per-environment variable management
 *   - Config validation and diff
 *   - Environment promotion (staging → production)
 *   - Snapshot and restore
 *   - Config audit trail
 */

export interface Environment {
  id: string
  name: string
  type: 'development' | 'staging' | 'production' | 'custom'
  status: 'active' | 'inactive' | 'maintenance'
  url: string
  variables: Map<string, EnvVariable>
  createdAt: string
  updatedAt: string
}

export interface EnvVariable {
  key: string
  value: string
  sensitive: boolean
  source: 'manual' | 'vault' | 'inherited'
  overriddenFrom?: string
  description?: string
}

export interface ConfigSnapshot {
  id: string
  environmentId: string
  variables: Record<string, string>
  createdAt: string
  createdBy: string
  description: string
}

export interface ConfigDiff {
  added: Array<{ key: string; value: string }>
  removed: Array<{ key: string; value: string }>
  changed: Array<{ key: string; from: string; to: string }>
  unchanged: string[]
}

export interface PromotionRecord {
  id: string
  fromEnv: string
  toEnv: string
  variables: string[]
  promotedBy: string
  promotedAt: string
  status: 'completed' | 'partial' | 'failed'
  skipped: string[]
}

export class StagingEnvironmentService {
  private environments: Map<string, Environment> = new Map()
  private snapshots: ConfigSnapshot[] = []
  private promotions: PromotionRecord[] = []
  private auditLog: Array<{ timestamp: string; action: string; env: string; details: string }> = []
  private idCounter = 0

  constructor() {
    this.initializeDefaults()
  }

  private initializeDefaults(): void {
    this.createEnvironment('development', 'development', 'http://localhost:3000')
    this.createEnvironment('staging', 'staging', 'https://staging.twinmcp.com')
    this.createEnvironment('production', 'production', 'https://app.twinmcp.com')
  }

  // ── Environment Management ─────────────────────────────────

  createEnvironment(name: string, type: Environment['type'], url: string): Environment {
    const env: Environment = {
      id: `env-${++this.idCounter}`, name, type, status: 'active', url,
      variables: new Map(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    this.environments.set(env.id, env)
    this.audit('env_created', env.id, `Environment ${name} (${type}) created`)
    return env
  }

  getEnvironment(id: string): Environment | undefined { return this.environments.get(id) }
  getEnvironments(): Environment[] { return Array.from(this.environments.values()) }
  getEnvironmentByName(name: string): Environment | undefined { return this.getEnvironments().find(e => e.name === name) }

  setEnvironmentStatus(id: string, status: Environment['status']): boolean {
    const env = this.environments.get(id)
    if (!env) return false
    env.status = status
    env.updatedAt = new Date().toISOString()
    return true
  }

  removeEnvironment(id: string): boolean { return this.environments.delete(id) }

  // ── Variable Management ────────────────────────────────────

  setVariable(envId: string, key: string, value: string, options: Partial<EnvVariable> = {}): boolean {
    const env = this.environments.get(envId)
    if (!env) return false
    env.variables.set(key, {
      key, value, sensitive: options.sensitive || false,
      source: options.source || 'manual', description: options.description,
      overriddenFrom: options.overriddenFrom,
    })
    env.updatedAt = new Date().toISOString()
    this.audit('var_set', envId, `${key} = ${options.sensitive ? '***' : value}`)
    return true
  }

  getVariable(envId: string, key: string): EnvVariable | undefined {
    return this.environments.get(envId)?.variables.get(key)
  }

  getVariables(envId: string): EnvVariable[] {
    const env = this.environments.get(envId)
    if (!env) return []
    return Array.from(env.variables.values())
  }

  removeVariable(envId: string, key: string): boolean {
    const env = this.environments.get(envId)
    if (!env) return false
    const deleted = env.variables.delete(key)
    if (deleted) this.audit('var_removed', envId, `${key} removed`)
    return deleted
  }

  // ── Config Validation ──────────────────────────────────────

  validateEnvironment(envId: string, requiredKeys: string[]): { valid: boolean; missing: string[] } {
    const env = this.environments.get(envId)
    if (!env) return { valid: false, missing: requiredKeys }
    const missing = requiredKeys.filter(k => !env.variables.has(k))
    return { valid: missing.length === 0, missing }
  }

  // ── Config Diff ────────────────────────────────────────────

  diffEnvironments(envIdA: string, envIdB: string): ConfigDiff | null {
    const envA = this.environments.get(envIdA)
    const envB = this.environments.get(envIdB)
    if (!envA || !envB) return null

    const keysA = new Set(envA.variables.keys())
    const keysB = new Set(envB.variables.keys())

    const added: ConfigDiff['added'] = []
    const removed: ConfigDiff['removed'] = []
    const changed: ConfigDiff['changed'] = []
    const unchanged: string[] = []

    for (const key of keysB) {
      if (!keysA.has(key)) {
        added.push({ key, value: envB.variables.get(key)!.value })
      }
    }
    for (const key of keysA) {
      if (!keysB.has(key)) {
        removed.push({ key, value: envA.variables.get(key)!.value })
      } else {
        const valA = envA.variables.get(key)!.value
        const valB = envB.variables.get(key)!.value
        if (valA !== valB) changed.push({ key, from: valA, to: valB })
        else unchanged.push(key)
      }
    }

    return { added, removed, changed, unchanged }
  }

  // ── Promotion ──────────────────────────────────────────────

  promote(fromEnvId: string, toEnvId: string, promotedBy: string, excludeKeys: string[] = []): PromotionRecord | null {
    const from = this.environments.get(fromEnvId)
    const to = this.environments.get(toEnvId)
    if (!from || !to) return null

    const promoted: string[] = []
    const skipped: string[] = []

    for (const [key, variable] of from.variables) {
      if (excludeKeys.includes(key)) {
        skipped.push(key)
        continue
      }
      to.variables.set(key, { ...variable, overriddenFrom: from.name })
      promoted.push(key)
    }
    to.updatedAt = new Date().toISOString()

    const record: PromotionRecord = {
      id: `promo-${++this.idCounter}`, fromEnv: fromEnvId, toEnv: toEnvId,
      variables: promoted, promotedBy, promotedAt: new Date().toISOString(),
      status: promoted.length > 0 ? 'completed' : 'partial', skipped,
    }
    this.promotions.push(record)
    this.audit('promotion', toEnvId, `Promoted ${promoted.length} vars from ${from.name}, skipped ${skipped.length}`)
    return record
  }

  getPromotions(): PromotionRecord[] { return [...this.promotions] }

  // ── Snapshots ──────────────────────────────────────────────

  createSnapshot(envId: string, createdBy: string, description: string = ''): ConfigSnapshot | null {
    const env = this.environments.get(envId)
    if (!env) return null
    const variables: Record<string, string> = {}
    for (const [key, v] of env.variables) variables[key] = v.value

    const snapshot: ConfigSnapshot = {
      id: `snap-${++this.idCounter}`, environmentId: envId, variables,
      createdAt: new Date().toISOString(), createdBy, description,
    }
    this.snapshots.push(snapshot)
    return snapshot
  }

  restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.find(s => s.id === snapshotId)
    if (!snapshot) return false
    const env = this.environments.get(snapshot.environmentId)
    if (!env) return false

    env.variables.clear()
    for (const [key, value] of Object.entries(snapshot.variables)) {
      env.variables.set(key, { key, value, sensitive: false, source: 'manual' })
    }
    env.updatedAt = new Date().toISOString()
    this.audit('snapshot_restored', env.id, `Restored from ${snapshotId}`)
    return true
  }

  getSnapshots(envId?: string): ConfigSnapshot[] {
    if (envId) return this.snapshots.filter(s => s.environmentId === envId)
    return [...this.snapshots]
  }

  // ── Audit ──────────────────────────────────────────────────

  getAuditLog(): typeof this.auditLog { return [...this.auditLog] }
  get auditLogCount(): number { return this.auditLog.length }

  private audit(action: string, env: string, details: string): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, env, details })
  }
}

export const stagingEnvironmentService = new StagingEnvironmentService()
