import { z } from 'zod';

export const productBaseSchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)').max(500, 'Nom trop long (max 500)'),
  description: z.string().min(20, 'Description requise (min 20 caractères)').max(10000, 'Description trop longue (max 10000)'),
  category: z.string().max(200).default(''),
  brand: z.string().max(200).nullable().optional(),
  price: z.number().min(0).max(1_000_000).optional().default(0),
  attributes: z.record(z.string(), z.string()).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export const analyzeSchema = productBaseSchema.pick({
  name: true,
  description: true,
  category: true,
  brand: true,
  price: true,
  attributes: true,
  imageUrl: true,
});

export const optimizeSchema = productBaseSchema.pick({
  name: true,
  description: true,
  category: true,
  brand: true,
  attributes: true,
});

const availabilitySchema = z.object({
  status: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'pre_order']),
  quantity: z.number().int().min(0).optional(),
  deliveryEstimate: z.string().max(200).optional(),
}).nullable().optional();

export const ucpContextSchema = productBaseSchema.extend({
  id: z.string().max(100).optional(),
  currency: z.string().length(3).default('EUR'),
  sku: z.string().max(100).nullable().optional(),
  storeName: z.string().max(200).nullable().optional(),
  availability: availabilitySchema,
});

export const createProductSchema = productBaseSchema.extend({
  currency: z.string().length(3).default('EUR'),
  sku: z.string().max(100).nullable().optional(),
  storeName: z.string().max(200).nullable().optional(),
  availability: availabilitySchema,
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;
export type OptimizeInput = z.infer<typeof optimizeSchema>;
export type UCPContextInput = z.infer<typeof ucpContextSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
