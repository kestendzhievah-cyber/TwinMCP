/**
 * Attribute-Based Access Control (ABAC) for MCP.
 *
 * Evaluates access policies based on subject attributes, resource attributes,
 * action, and environment conditions. Complements RBAC with fine-grained,
 * context-aware authorization.
 *
 * Policy structure:
 *   - subject conditions: user attributes (role, department, clearance, etc.)
 *   - resource conditions: resource attributes (owner, sensitivity, type, etc.)
 *   - action conditions: which actions are allowed
 *   - environment conditions: time, IP range, location, etc.
 */

export interface ABACAttributes {
  [key: string]: string | number | boolean | string[] | undefined
}

export interface ABACPolicy {
  id: string
  name: string
  description?: string
  effect: 'allow' | 'deny'
  priority: number
  enabled: boolean
  conditions: {
    subject?: Record<string, ABACCondition>
    resource?: Record<string, ABACCondition>
    action?: ABACCondition
    environment?: Record<string, ABACCondition>
  }
}

export type ABACOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'starts_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'regex'
  | 'exists'

export interface ABACCondition {
  operator: ABACOperator
  value: any
}

export interface ABACRequest {
  subject: ABACAttributes
  resource: ABACAttributes
  action: string
  environment?: ABACAttributes
}

export interface ABACDecision {
  allowed: boolean
  matchedPolicy?: string
  reason: string
}

export class ABACService {
  private policies: Map<string, ABACPolicy> = new Map()

  /** Add a policy. */
  addPolicy(policy: ABACPolicy): void {
    this.policies.set(policy.id, policy)
  }

  /** Remove a policy. */
  removePolicy(id: string): boolean {
    return this.policies.delete(id)
  }

  /** Get all policies sorted by priority. */
  getPolicies(): ABACPolicy[] {
    return Array.from(this.policies.values()).sort((a, b) => a.priority - b.priority)
  }

  /** Get a single policy. */
  getPolicy(id: string): ABACPolicy | undefined {
    return this.policies.get(id)
  }

  /**
   * Evaluate an access request against all policies.
   * Uses first-applicable strategy: the first matching policy determines the outcome.
   * If no policy matches, access is denied by default.
   */
  evaluate(request: ABACRequest): ABACDecision {
    const sorted = this.getPolicies().filter(p => p.enabled)

    for (const policy of sorted) {
      if (this.matchesPolicy(policy, request)) {
        return {
          allowed: policy.effect === 'allow',
          matchedPolicy: policy.id,
          reason: `Policy "${policy.name}" (${policy.effect})`,
        }
      }
    }

    return {
      allowed: false,
      reason: 'No matching policy — default deny',
    }
  }

  /**
   * Evaluate and return all matching policies (for audit/debugging).
   */
  evaluateAll(request: ABACRequest): Array<{ policy: ABACPolicy; matches: boolean }> {
    return this.getPolicies()
      .filter(p => p.enabled)
      .map(policy => ({
        policy,
        matches: this.matchesPolicy(policy, request),
      }))
  }

  // ── Policy Matching ────────────────────────────────────────

  private matchesPolicy(policy: ABACPolicy, request: ABACRequest): boolean {
    const { conditions } = policy

    // Check subject conditions
    if (conditions.subject) {
      if (!this.matchAttributes(request.subject, conditions.subject)) return false
    }

    // Check resource conditions
    if (conditions.resource) {
      if (!this.matchAttributes(request.resource, conditions.resource)) return false
    }

    // Check action condition
    if (conditions.action) {
      if (!this.evaluateCondition(request.action, conditions.action)) return false
    }

    // Check environment conditions
    if (conditions.environment) {
      if (!this.matchAttributes(request.environment || {}, conditions.environment)) return false
    }

    return true
  }

  private matchAttributes(
    attributes: ABACAttributes,
    conditions: Record<string, ABACCondition>
  ): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      const value = attributes[key]
      if (!this.evaluateCondition(value, condition)) return false
    }
    return true
  }

  private evaluateCondition(value: any, condition: ABACCondition): boolean {
    const { operator, value: expected } = condition

    switch (operator) {
      case 'equals':
        return value === expected

      case 'not_equals':
        return value !== expected

      case 'in':
        if (Array.isArray(expected)) return expected.includes(value)
        return false

      case 'not_in':
        if (Array.isArray(expected)) return !expected.includes(value)
        return true

      case 'contains':
        if (Array.isArray(value)) return value.includes(expected)
        if (typeof value === 'string') return value.includes(expected)
        return false

      case 'starts_with':
        return typeof value === 'string' && value.startsWith(expected)

      case 'greater_than':
        return typeof value === 'number' && value > expected

      case 'less_than':
        return typeof value === 'number' && value < expected

      case 'between':
        if (typeof value === 'number' && Array.isArray(expected) && expected.length === 2) {
          return value >= expected[0] && value <= expected[1]
        }
        return false

      case 'regex':
        try {
          return typeof value === 'string' && new RegExp(expected).test(value)
        } catch {
          return false
        }

      case 'exists':
        return expected ? value !== undefined && value !== null : value === undefined || value === null

      default:
        return false
    }
  }
}

export const abacService = new ABACService()
