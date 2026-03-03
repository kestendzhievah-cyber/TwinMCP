import { z } from 'zod';

// ─── API Keys ────────────────────────────────────────────────────
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
});

export const deleteApiKeyParamsSchema = z.object({
  id: z.string().min(1, 'Key ID is required'),
});

// ─── Chat ────────────────────────────────────────────────────────
export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  content: z.string().min(1, 'Message content is required').max(50000),
  role: z.enum(['user', 'assistant', 'system']).optional().default('user'),
});

// ─── Downloads ───────────────────────────────────────────────────
export const createDownloadSchema = z
  .object({
    githubUrl: z
      .string()
      .url()
      .regex(/github\.com\/[^/]+\/[^/]+/, 'Invalid GitHub URL')
      .optional(),
    type: z.string().optional(),
    source: z.record(z.unknown()).optional(),
    options: z
      .object({
        shallow: z.boolean().optional().default(true),
        includeDocs: z.boolean().optional().default(true),
        includeTests: z.boolean().optional().default(false),
        includeExamples: z.boolean().optional().default(true),
        maxDepth: z.number().int().min(1).max(20).optional().default(5),
        excludePatterns: z.array(z.string()).optional().default([]),
      })
      .optional(),
    priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  })
  .refine(data => data.githubUrl || (data.type && data.source), {
    message: 'Either githubUrl or type+source must be provided',
  });

// ─── Libraries ───────────────────────────────────────────────────
export const importLibrarySchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().optional(),
  version: z.string().optional(),
});

// ─── Billing ─────────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  method: z.string().optional(),
});

// ─── MCP Configurations ─────────────────────────────────────────
export const createMcpConfigSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  configData: z.record(z.unknown()),
});

// ─── Auth ────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  recaptchaToken: z.string().optional(),
});

export const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().optional(),
    recaptchaToken: z.string().optional(),
  })
  .refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ─── Analytics ───────────────────────────────────────────────────
export const trackEventSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  type: z.union([
    z.string(),
    z.object({ name: z.string(), category: z.string(), schema: z.any() }),
  ]),
  category: z.union([
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      metrics: z.array(z.any()),
    }),
  ]),
  action: z.string().min(1, 'action is required'),
  label: z.string().optional(),
  value: z.number().optional(),
  properties: z.record(z.unknown()).optional().default({}),
  timestamp: z.union([z.string(), z.number()]).optional(),
  page: z
    .object({
      url: z.string(),
      title: z.string().optional(),
      referrer: z.string().optional(),
    })
    .passthrough(),
  userContext: z
    .object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .passthrough(),
});

// ─── Usage Tracking ──────────────────────────────────────────────
export const trackUsageSchema = z.object({
  toolName: z.string().min(1, 'toolName is required'),
  success: z.boolean().optional().default(true),
  responseTimeMs: z.number().int().min(0).optional().default(0),
  libraryId: z.string().optional(),
  query: z.string().optional(),
  tokensReturned: z.number().int().optional(),
});

// ─── Conversations ──────────────────────────────────────────────
export const createConversationMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(50000),
  role: z.enum(['user', 'assistant', 'system']).optional().default('user'),
});

// ─── Helper: parse and return error response ─────────────────────
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: 'Validation failed',
    details: result.error.issues,
  };
}
