import {
  createApiKeySchema,
  loginSchema,
  signupSchema,
  sendChatMessageSchema,
  createFullConversationSchema,
  createSubscriptionSchema,
  updateProfileSchema,
  createMcpConfigSchema,
  createDownloadSchema,
  trackUsageSchema,
  parseBody,
} from '@/lib/validations/api-schemas';

describe('Zod API Schemas', () => {
  describe('createApiKeySchema', () => {
    it('should accept valid name', () => {
      expect(createApiKeySchema.safeParse({ name: 'My Key' }).success).toBe(true);
    });
    it('should reject empty name', () => {
      expect(createApiKeySchema.safeParse({ name: '' }).success).toBe(false);
    });
    it('should reject name over 100 chars', () => {
      expect(createApiKeySchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login', () => {
      const result = loginSchema.safeParse({ email: 'user@test.com', password: 'pass123' });
      expect(result.success).toBe(true);
    });
    it('should reject invalid email', () => {
      expect(loginSchema.safeParse({ email: 'notanemail', password: 'pass' }).success).toBe(false);
    });
    it('should reject empty password', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('should accept valid signup', () => {
      const result = signupSchema.safeParse({ email: 'a@b.com', password: 'password123' });
      expect(result.success).toBe(true);
    });
    it('should reject password under 6 chars', () => {
      expect(signupSchema.safeParse({ email: 'a@b.com', password: '12345' }).success).toBe(false);
    });
    it('should reject mismatched confirmPassword', () => {
      const result = signupSchema.safeParse({
        email: 'a@b.com',
        password: 'password123',
        confirmPassword: 'different',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sendChatMessageSchema', () => {
    it('should accept valid message', () => {
      const result = sendChatMessageSchema.safeParse({
        chatbotId: 'bot1',
        message: 'Hello',
        visitorId: 'v1',
      });
      expect(result.success).toBe(true);
    });
    it('should reject empty message', () => {
      const result = sendChatMessageSchema.safeParse({
        chatbotId: 'bot1',
        message: '',
        visitorId: 'v1',
      });
      expect(result.success).toBe(false);
    });
    it('should reject message over 10000 chars', () => {
      const result = sendChatMessageSchema.safeParse({
        chatbotId: 'bot1',
        message: 'x'.repeat(10001),
        visitorId: 'v1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createFullConversationSchema', () => {
    it('should accept valid conversation', () => {
      const result = createFullConversationSchema.safeParse({
        title: 'Test',
        provider: 'openai',
        model: 'gpt-4',
      });
      expect(result.success).toBe(true);
    });
    it('should reject missing provider', () => {
      const result = createFullConversationSchema.safeParse({
        title: 'Test',
        model: 'gpt-4',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createSubscriptionSchema', () => {
    it('should accept valid subscription', () => {
      const result = createSubscriptionSchema.safeParse({
        planId: 'pro',
        paymentMethodId: 'pm_abc123',
      });
      expect(result.success).toBe(true);
    });
    it('should reject invalid planId', () => {
      const result = createSubscriptionSchema.safeParse({
        planId: 'invalid',
        paymentMethodId: 'pm_abc123',
      });
      expect(result.success).toBe(false);
    });
    it('should reject invalid paymentMethodId format', () => {
      const result = createSubscriptionSchema.safeParse({
        planId: 'pro',
        paymentMethodId: 'not_stripe',
      });
      expect(result.success).toBe(false);
    });
    it('should default trialDays to 0', () => {
      const result = createSubscriptionSchema.safeParse({
        planId: 'free',
        paymentMethodId: 'pm_test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trialDays).toBe(0);
      }
    });
  });

  describe('updateProfileSchema', () => {
    it('should accept partial update', () => {
      const result = updateProfileSchema.safeParse({ firstName: 'Alice' });
      expect(result.success).toBe(true);
    });
    it('should reject empty object (no fields)', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(false);
    });
    it('should reject field over 200 chars', () => {
      const result = updateProfileSchema.safeParse({ firstName: 'a'.repeat(201) });
      expect(result.success).toBe(false);
    });
  });

  describe('createMcpConfigSchema', () => {
    it('should accept valid config', () => {
      const result = createMcpConfigSchema.safeParse({
        name: 'My Config',
        configData: { key: 'value' },
      });
      expect(result.success).toBe(true);
    });
    it('should reject missing configData', () => {
      const result = createMcpConfigSchema.safeParse({ name: 'Test' });
      expect(result.success).toBe(false);
    });
  });

  describe('trackUsageSchema', () => {
    it('should accept minimal usage', () => {
      const result = trackUsageSchema.safeParse({ toolName: 'query-docs' });
      expect(result.success).toBe(true);
    });
    it('should reject empty toolName', () => {
      expect(trackUsageSchema.safeParse({ toolName: '' }).success).toBe(false);
    });
    it('should default success to true', () => {
      const result = trackUsageSchema.safeParse({ toolName: 'test' });
      if (result.success) {
        expect(result.data.success).toBe(true);
      }
    });
  });
});

describe('parseBody helper', () => {
  it('should return success with parsed data on valid input', () => {
    const result = parseBody(loginSchema, { email: 'a@b.com', password: 'pass' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('a@b.com');
    }
  });

  it('should return error with Zod issues on invalid input', () => {
    const result = parseBody(loginSchema, { email: 'invalid', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Validation failed');
      expect(result.details.length).toBeGreaterThan(0);
    }
  });

  it('should return error for null input', () => {
    const result = parseBody(loginSchema, null);
    expect(result.success).toBe(false);
  });
});
