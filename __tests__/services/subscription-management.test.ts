import { SubscriptionManagementService } from '../../src/services/billing/subscription-management.service'

describe('SubscriptionManagementService', () => {
  let service: SubscriptionManagementService

  beforeEach(() => {
    service = new SubscriptionManagementService()
    service.createPlan('Starter', 29, 'monthly', { trialDays: 14, features: ['basic'] })
    service.createPlan('Pro', 99, 'monthly', { features: ['basic', 'advanced'] })
    service.createPlan('Enterprise', 299, 'yearly', { features: ['all'] })
  })

  describe('Plan management', () => {
    it('creates plans', () => {
      expect(service.getPlans().length).toBe(3)
    })

    it('gets a plan by ID', () => {
      const plans = service.getPlans()
      expect(service.getPlan(plans[0].id)?.name).toBe('Starter')
    })

    it('deactivates a plan', () => {
      const plan = service.getPlans()[0]
      expect(service.deactivatePlan(plan.id)).toBe(true)
      expect(service.getPlans().length).toBe(2)
    })
  })

  describe('Subscription lifecycle', () => {
    it('subscribes a user', () => {
      const plans = service.getPlans()
      const sub = service.subscribe('user-1', plans[1].id)!
      expect(sub.status).toBe('active')
      expect(sub.billingHistory.length).toBe(1)
      expect(sub.billingHistory[0].type).toBe('charge')
    })

    it('subscribes with trial', () => {
      const plans = service.getPlans()
      const starter = plans.find(p => p.name === 'Starter')!
      const sub = service.subscribe('user-1', starter.id)!
      expect(sub.status).toBe('trialing')
      expect(sub.trialStart).toBeDefined()
      expect(sub.trialEnd).toBeDefined()
      expect(sub.billingHistory[0].type).toBe('trial_start')
    })

    it('returns null for inactive plan', () => {
      const plan = service.getPlans()[0]
      service.deactivatePlan(plan.id)
      expect(service.subscribe('user-1', plan.id)).toBeNull()
    })

    it('gets user subscriptions', () => {
      const plans = service.getPlans()
      service.subscribe('user-1', plans[0].id)
      service.subscribe('user-1', plans[1].id)
      expect(service.getUserSubscriptions('user-1').length).toBe(2)
    })

    it('gets active subscription', () => {
      const plans = service.getPlans()
      const pro = plans.find(p => p.name === 'Pro')!
      service.subscribe('user-1', pro.id)
      const active = service.getActiveSubscription('user-1')
      expect(active).toBeDefined()
      expect(active!.status).toBe('active')
    })
  })

  describe('Trial management', () => {
    it('converts trial to paid', () => {
      const starter = service.getPlans().find(p => p.name === 'Starter')!
      const sub = service.subscribe('user-1', starter.id)!
      expect(service.convertTrial(sub.id)).toBe(true)
      expect(service.getSubscription(sub.id)!.status).toBe('active')
      const history = service.getSubscription(sub.id)!.billingHistory
      expect(history.some(e => e.type === 'trial_end')).toBe(true)
      expect(history.some(e => e.type === 'charge')).toBe(true)
    })

    it('does not convert non-trialing subscription', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      expect(service.convertTrial(sub.id)).toBe(false)
    })

    it('checks trial expiry', () => {
      const starter = service.getPlans().find(p => p.name === 'Starter')!
      const sub = service.subscribe('user-1', starter.id)!
      expect(service.isTrialExpired(sub.id)).toBe(false)
    })

    it('gets trial days remaining', () => {
      const starter = service.getPlans().find(p => p.name === 'Starter')!
      const sub = service.subscribe('user-1', starter.id)!
      const days = service.getTrialDaysRemaining(sub.id)
      expect(days).toBeGreaterThan(0)
      expect(days).toBeLessThanOrEqual(14)
    })
  })

  describe('Proration', () => {
    it('calculates proration for upgrade', () => {
      const plans = service.getPlans()
      const starter = plans.find(p => p.name === 'Starter')!
      const pro = plans.find(p => p.name === 'Pro')!

      // Subscribe to starter (skip trial by using Pro which has no trial)
      const sub = service.subscribe('user-1', starter.id)!
      service.convertTrial(sub.id) // convert trial first

      const proration = service.calculateProration(sub.id, pro.id)
      expect(proration).not.toBeNull()
      expect(proration!.chargeAmount).toBeGreaterThan(proration!.creditAmount)
      expect(proration!.description).toContain('Upgrade')
    })

    it('calculates proration for downgrade', () => {
      const plans = service.getPlans()
      const pro = plans.find(p => p.name === 'Pro')!
      const starter = plans.find(p => p.name === 'Starter')!

      const sub = service.subscribe('user-1', pro.id)!
      const proration = service.calculateProration(sub.id, starter.id)
      expect(proration).not.toBeNull()
      expect(proration!.creditAmount).toBeGreaterThan(proration!.chargeAmount)
      expect(proration!.description).toContain('Downgrade')
    })

    it('executes plan change', () => {
      const plans = service.getPlans()
      const pro = plans.find(p => p.name === 'Pro')!
      const starter = plans.find(p => p.name === 'Starter')!

      const sub = service.subscribe('user-1', pro.id)!
      const result = service.changePlan(sub.id, starter.id)
      expect(result).not.toBeNull()
      expect(service.getSubscription(sub.id)!.planId).toBe(starter.id)
      expect(service.getSubscription(sub.id)!.billingHistory.some(e => e.type === 'plan_change')).toBe(true)
    })

    it('returns null for unknown subscription', () => {
      expect(service.calculateProration('unknown', 'plan-1')).toBeNull()
    })
  })

  describe('Billing cycles', () => {
    it('renews a subscription', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      const event = service.renewSubscription(sub.id, true)
      expect(event).not.toBeNull()
      expect(event!.type).toBe('charge')
      expect(event!.success).toBe(true)
    })

    it('checks if renewal needed', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      expect(service.needsRenewal(sub.id)).toBe(false) // just created
    })
  })

  describe('Dunning management', () => {
    it('handles failed payment', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      const event = service.handleFailedPayment(sub.id)
      expect(event).not.toBeNull()
      expect(event!.success).toBe(false)
      expect(event!.type).toBe('dunning_attempt')
      expect(service.getSubscription(sub.id)!.status).toBe('past_due')
    })

    it('escalates dunning levels', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!

      service.handleFailedPayment(sub.id)
      expect(service.getSubscription(sub.id)!.dunningState!.escalationLevel).toBe('email')

      service.handleFailedPayment(sub.id)
      expect(service.getSubscription(sub.id)!.dunningState!.escalationLevel).toBe('warning')

      service.handleFailedPayment(sub.id)
      expect(service.getSubscription(sub.id)!.dunningState!.escalationLevel).toBe('final_notice')
    })

    it('cancels after max attempts', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!

      for (let i = 0; i < 4; i++) service.handleFailedPayment(sub.id)
      expect(service.getSubscription(sub.id)!.status).toBe('canceled')
    })

    it('recovers from dunning on successful renewal', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      service.handleFailedPayment(sub.id)
      expect(service.getSubscription(sub.id)!.status).toBe('past_due')

      service.renewSubscription(sub.id, true)
      expect(service.getSubscription(sub.id)!.status).toBe('active')
      expect(service.getSubscription(sub.id)!.dunningState).toBeUndefined()
    })

    it('lists subscriptions in dunning', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      service.handleFailedPayment(sub.id)
      expect(service.getSubscriptionsInDunning().length).toBe(1)
    })

    it('gets and sets dunning config', () => {
      expect(service.getDunningConfig().maxAttempts).toBe(4)
      service.setDunningConfig({ maxAttempts: 6 })
      expect(service.getDunningConfig().maxAttempts).toBe(6)
    })
  })

  describe('Pause / Resume / Cancel', () => {
    it('pauses a subscription', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      expect(service.pause(sub.id)).toBe(true)
      expect(service.getSubscription(sub.id)!.status).toBe('paused')
    })

    it('resumes a paused subscription', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      service.pause(sub.id)
      expect(service.resume(sub.id)).toBe(true)
      expect(service.getSubscription(sub.id)!.status).toBe('active')
    })

    it('cannot pause non-active subscription', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      service.cancel(sub.id)
      expect(service.pause(sub.id)).toBe(false)
    })

    it('cancels a subscription', () => {
      const pro = service.getPlans().find(p => p.name === 'Pro')!
      const sub = service.subscribe('user-1', pro.id)!
      expect(service.cancel(sub.id)).toBe(true)
      expect(service.getSubscription(sub.id)!.status).toBe('canceled')
      expect(service.getSubscription(sub.id)!.canceledAt).toBeDefined()
    })
  })
})
