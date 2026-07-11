import { z } from "zod";
import { mcpRuntimes, boxSizes } from "@/db/schema/platform";

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "slug must be lowercase, hyphens only");

export const createServerSchema = z.object({
  name: z.string().min(1).max(80),
  slug: slugSchema.optional(),
  boxSize: z.enum(boxSizes).optional(),
  region: z.string().min(1).max(40).optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  boxSize: z.enum(boxSizes).optional(),
});

export const configSchemaShape = z.object({
  properties: z
    .record(
      z.object({
        type: z.enum(["string", "number", "boolean"]),
        required: z.boolean().optional().default(false),
        description: z.string().optional(),
        secret: z.boolean().optional().default(false),
      })
    )
    .default({}),
});
export type ConfigSchemaShape = z.infer<typeof configSchemaShape>;

// User-published install/start commands run inside a box via a shell. Block the
// characters that enable command chaining / substitution / redirection so a
// crafted command can't break out of the intended `npx`/`uvx <pkg> [args]`
// shape. `$` and `{}` stay allowed for config-value refs ($MY_KEY / ${MY_KEY});
// since `(` is blocked, `$(...)` command substitution can't form, and backticks
// are blocked. Official MCPs are seeded straight to the DB and bypass this.
const SHELL_METACHARS = /[`;|&<>()\n\r\\]/;
const shellSafeCmd = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => !SHELL_METACHARS.test(v), {
      message: "Command may not contain shell metacharacters ( ` ; | & < > ( ) \\ or newlines )",
    });

export const createMcpServerSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  repoUrl: z.string().url().optional(),
  runtime: z.enum(mcpRuntimes),
  installCmd: shellSafeCmd(500),
  startCmd: shellSafeCmd(500),
  version: z.string().min(1).max(40).default("latest"),
  configSchema: configSchemaShape.optional(),
  isPublic: z.boolean().optional().default(false),
});

export const installMcpSchema = z.object({
  mcpServerId: z.string().min(1),
  config: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export const updateUserServerSchema = z
  .object({
    enabled: z.boolean().optional(),
    config: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .refine((v) => v.enabled !== undefined || v.config !== undefined, {
    message: "Provide either 'enabled' or 'config'",
  });

export function validateConfigAgainstSchema(
  config: Record<string, unknown>,
  schema: ConfigSchemaShape
): { ok: true } | { ok: false; error: string } {
  for (const [key, def] of Object.entries(schema.properties ?? {})) {
    const val = config[key];
    if (def.required && (val === undefined || val === null || val === "")) {
      return { ok: false, error: `Missing required config key: ${key}` };
    }
    if (val !== undefined && typeof val !== def.type) {
      return { ok: false, error: `Config key ${key} must be ${def.type}` };
    }
  }
  return { ok: true };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
