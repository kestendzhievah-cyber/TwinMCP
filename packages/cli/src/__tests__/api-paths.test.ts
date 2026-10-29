import { describe, expect, test } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Every backend path the shipped CLI calls must exist as a Next.js route
// directory in apps/backend/src/app/api, so no command ships pointing at a 404
// (the Context7 skills registry and /api/v2/cli/events never existed on
// twinmcp.fr).

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");
const API_ROOT = join(SRC, "..", "..", "..", "apps", "backend", "src", "app", "api");

const SHIPPED_SOURCES = [
  "utils/api.ts",
  "utils/auth.ts",
  "utils/hosting.ts",
  "utils/tracking.ts",
  "commands/connect.ts",
  "commands/hosting.ts",
  "commands/auth.ts",
  "commands/setup.ts",
  "commands/docs.ts",
];

/** `/api/...` paths in string or template literals (comments are skipped). */
function apiPaths(file: string): string[] {
  const code = readFileSync(join(SRC, file), "utf-8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
  const out = new Set<string>();
  // A quote, then (on the same line) /api followed by literal or `${…}` segments.
  for (const m of code.matchAll(/["`][^"`\n]*?(\/api(?:\/(?:[\w.-]+|\$\{[^}]*\}))+)/g)) {
    out.add(m[1]!);
  }
  return [...out];
}

/** True when `path` (with `${…}` segments) maps onto a route directory. */
function routeExists(path: string): boolean {
  const segments = path
    .replace(/^\/api\//, "")
    .split("/")
    .filter(Boolean);
  let dirs = [API_ROOT];
  for (const seg of segments) {
    const dynamic = seg.includes("${");
    const next: string[] = [];
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      const children = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const child of children) {
        const isParam = /^\[.+\]$/.test(child.name);
        if ((dynamic && isParam) || (!dynamic && (child.name === seg || isParam))) {
          next.push(join(dir, child.name));
        }
      }
    }
    dirs = next;
    if (dirs.length === 0) return false;
  }
  return dirs.some((d) => existsSync(join(d, "route.ts")));
}

describe("CLI API paths", () => {
  test("the backend route tree is present", () => {
    expect(existsSync(API_ROOT)).toBe(true);
  });

  const all = SHIPPED_SOURCES.flatMap((file) => apiPaths(file).map((path) => ({ file, path })));

  test("finds the management, proxy and agent paths", () => {
    const paths = new Set(all.map((p) => p.path));
    expect(paths.has("/api/v2/servers")).toBe(true);
    expect(paths.has("/api/v2/auth/keys")).toBe(true);
    expect(paths.has("/api/agent/link")).toBe(true);
  });

  test.each(all)("$file calls an existing route: $path", ({ path }) => {
    expect(routeExists(path)).toBe(true);
  });

  test("never calls the unshipped skills registry or CLI events endpoint", () => {
    for (const { path } of all) {
      expect(path).not.toMatch(/\/api\/v2\/(skills|cli\/events)/);
      // OAuth lives at /oauth/*, and the CLI logs in with an API key.
      expect(path).not.toMatch(/\/api\/oauth\//);
    }
  });
});
