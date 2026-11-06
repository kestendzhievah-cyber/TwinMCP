// Smithery → TwinMCP migration assistant: turns whatever a Smithery user pastes
// (a server.smithery.ai URL, a registry page, an `@owner/name`, an npx / uvx /
// Smithery CLI command, a GitHub or npm link, or a whole smithery.yaml) into a
// migration plan against the TwinMCP catalogue.
//
// Pure module: no I/O, no React, safe in client components. The catalogue is
// passed in (built from lib/servers/seed-catalog.ts by migrationCatalogue()), so
// a plan can only point at an MCP a user can really install.
//
// Honesty rules the plans encode (lib/plan-features.ts, lib/wallet/eligibility.ts):
//   - a catalogue MCP installs on the sign-up credit, except the slugs in
//     PROMO_EXCLUDED_MCP_SLUGS, which wait for a first top-up;
//   - publishing your own npm / PyPI package needs a funded wallet;
//   - a server that only ships as a Docker image cannot run in the sandbox.

import type { SeedEntry } from "@/lib/servers/seed-catalog";

// ─── Catalogue ───────────────────────────────────────────────────────────────

export interface MigrationConfigField {
  key: string;
  required: boolean;
  secret: boolean;
  description?: string;
}

export interface MigrationCatalogueEntry {
  slug: string;
  name: string;
  runtime: string;
  /** The npm or PyPI package the catalogue runs, parsed from its startCmd. */
  pkg: string | null;
  repoUrl: string | null;
  config: MigrationConfigField[];
  /** True when the MCP waits for a first top-up (PROMO_EXCLUDED_MCP_SLUGS). */
  needsTopUp: boolean;
}

/** The package a catalogue startCmd runs: `npx -y @a/b@1.2 --x` → `@a/b`, `uvx --from p q` → `p`. */
export function packageOfStartCmd(startCmd: string): { tool: "npx" | "uvx"; pkg: string } | null {
  const tokens = startCmd.trim().split(/\s+/);
  const tool = tokens[0];
  if (tool !== "npx" && tool !== "uvx") return null;
  let i = 1;
  while (i < tokens.length && tokens[i]!.startsWith("-")) {
    // uvx --from <pkg> <cmd>: the package is the --from value.
    if (tool === "uvx" && tokens[i] === "--from" && tokens[i + 1]) {
      const from = tokens[i + 1]!;
      return from.includes("://") ? null : { tool, pkg: stripVersion(from) };
    }
    i++;
  }
  const raw = tokens[i];
  if (!raw || raw.includes("://") || raw.startsWith("$")) return null;
  return { tool, pkg: stripVersion(raw) };
}

/** `@scope/name@1.2.3` → `@scope/name`, `name@latest` → `name`, `name==1.0` → `name`. */
export function stripVersion(spec: string): string {
  const s = spec.replace(/[=<>~!]=.*$/, "");
  if (s.startsWith("@")) {
    const at = s.indexOf("@", 1);
    return at === -1 ? s : s.slice(0, at);
  }
  const at = s.indexOf("@");
  return at === -1 ? s : s.slice(0, at);
}

/** Build the assistant's catalogue from the seed (only installable, box-hosted MCPs). */
export function migrationCatalogue(
  seeds: readonly SeedEntry[],
  excludedOnPromo: readonly string[]
): MigrationCatalogueEntry[] {
  const excluded = new Set(excludedOnPromo);
  return seeds
    .filter((s) => (s.hostMode ?? "box") === "box" && s.slug !== "twinmcp-docs")
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      runtime: s.runtime,
      pkg: packageOfStartCmd(s.startCmd)?.pkg ?? null,
      repoUrl: s.repoUrl ?? null,
      config: Object.entries(s.configSchema.properties).map(([key, p]) => ({
        key,
        required: Boolean(p.required),
        secret: Boolean(p.secret),
        description: p.description,
      })),
      needsTopUp: excluded.has(s.slug),
    }));
}

// ─── Parsing what the user pastes ────────────────────────────────────────────

export type MigrationSource =
  | { kind: "smithery"; qualifiedName: string }
  | { kind: "npm"; pkg: string }
  | { kind: "pypi"; pkg: string }
  | { kind: "github"; owner: string; repo: string; path?: string }
  | { kind: "docker" };

export interface ParsedMigration {
  sources: MigrationSource[];
  /** The Smithery URL the user's client points at today, when we can tell. */
  smitheryUrl?: string;
  /** Config keys declared in a pasted smithery.yaml (startCommand.configSchema). */
  configKeys: string[];
  /** True when the input looked like a smithery.yaml. */
  yaml: boolean;
}

const NPM_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
const SMITHERY_CLI = /^@smithery\/cli(@.*)?$/;

function pushUnique(list: MigrationSource[], s: MigrationSource): void {
  if (!list.some((x) => JSON.stringify(x) === JSON.stringify(s))) list.push(s);
}

/** The config keys under `startCommand: … configSchema: … properties:` of a smithery.yaml. */
export function yamlConfigKeys(yaml: string): string[] {
  const lines = yaml.replace(/\t/g, "  ").split(/\r?\n/);
  const keys: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)properties:\s*$/.exec(lines[i]!);
    if (!m) continue;
    const base = m[1]!.length;
    let childIndent = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]!;
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const indent = line.length - line.trimStart().length;
      if (indent <= base) break;
      if (childIndent === -1) childIndent = indent;
      if (indent !== childIndent) continue;
      const k = /^\s*["']?([A-Za-z_][\w-]*)["']?\s*:/.exec(line);
      if (k && !keys.includes(k[1]!)) keys.push(k[1]!);
    }
    break; // the first `properties:` block is the config schema
  }
  return keys;
}

/** Read a pasted value into the sources it names. Never throws. */
export function parseMigrationInput(raw: string): ParsedMigration {
  const input = raw.trim();
  const out: ParsedMigration = { sources: [], configKeys: [], yaml: false };
  if (!input) return out;

  // smithery.yaml (startCommand / runtime keys at the top level)
  if (/^\s*(startCommand|runtime)\s*:/m.test(input)) {
    out.yaml = true;
    out.configKeys = yamlConfigKeys(input);
    if (/^\s*runtime\s*:\s*["']?container/m.test(input) || /^\s*dockerfile\s*:/im.test(input)) {
      pushUnique(out.sources, { kind: "docker" });
    }
    // commandFunction that runs a published package: command 'npx' / 'uvx', args [...]
    const cmd = /command\s*:\s*["'](npx|uvx)["'][\s\S]*?args\s*:\s*\[([^\]]*)\]/.exec(input);
    if (cmd) {
      const args = cmd[2]!
        .split(",")
        .map((a) => a.trim().replace(/^["'`]|["'`]$/g, ""))
        .filter(Boolean);
      const pkg = args.find((a) => !a.startsWith("-"));
      if (pkg && !pkg.includes("://")) {
        pushUnique(
          out.sources,
          cmd[1] === "npx"
            ? { kind: "npm", pkg: stripVersion(pkg) }
            : { kind: "pypi", pkg: stripVersion(pkg) }
        );
      }
    }
  }

  // URLs anywhere in the input
  for (const m of input.matchAll(/https?:\/\/server\.smithery\.ai\/([^\s?#"'`]+)/gi)) {
    const path = decodeURIComponent(m[1]!)
      .replace(/\/mcp\/?$/, "")
      .replace(/\/+$/, "");
    if (path) {
      pushUnique(out.sources, { kind: "smithery", qualifiedName: path });
      out.smitheryUrl ??= m[0];
    }
  }
  for (const m of input.matchAll(/https?:\/\/[a-z0-9.-]*\.run\.tools[^\s"'`]*/gi)) {
    out.smitheryUrl ??= m[0];
  }
  for (const m of input.matchAll(/smithery\.ai\/server\/([^\s?#"'`]+)/gi)) {
    const qn = decodeURIComponent(m[1]!).replace(/\/+$/, "");
    if (qn) pushUnique(out.sources, { kind: "smithery", qualifiedName: qn });
  }
  for (const m of input.matchAll(/npmjs\.com\/package\/((?:@[^/\s]+\/)?[^/\s?#"'`]+)/gi)) {
    pushUnique(out.sources, { kind: "npm", pkg: decodeURIComponent(m[1]!) });
  }
  for (const m of input.matchAll(/pypi\.org\/project\/([^/\s?#"'`]+)/gi)) {
    pushUnique(out.sources, { kind: "pypi", pkg: m[1]! });
  }
  for (const m of input.matchAll(
    /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/[^/\s]+\/([^\s?#"'`]+))?(?=[\s?#"'`]|\/?$|\/(?!tree))/gi
  )) {
    const path = m[3]?.replace(/\/+$/, "");
    pushUnique(out.sources, {
      kind: "github",
      owner: m[1]!,
      repo: m[2]!,
      ...(path ? { path } : {}),
    });
  }
  if (/\bdocker\s+(run|pull)\b|\bghcr\.io\//i.test(input))
    pushUnique(out.sources, { kind: "docker" });

  // Commands: npx [-y] <pkg>, the Smithery CLI, uvx <pkg>, pip install <pkg>
  if (!out.yaml) {
    for (const line of input.split(/\r?\n/)) {
      const tokens = line
        .trim()
        .replace(/^\$\s*/, "")
        .split(/\s+/);
      const at = tokens.findIndex((t) => t === "npx" || t === "uvx" || t === "pip" || t === "pipx");
      if (at === -1) continue;
      const tool = tokens[at];
      const rest = tokens.slice(at + 1).filter((t) => t !== "install" || tool !== "pip");
      if (tool === "npx") {
        const args = rest.filter((t) => !t.startsWith("-"));
        const first = args[0];
        if (!first) continue;
        if (SMITHERY_CLI.test(first)) {
          // npx @smithery/cli install|run <qualified-name> [--client …]
          const name = args[1] === "install" || args[1] === "run" ? args[2] : args[1];
          if (name) pushUnique(out.sources, { kind: "smithery", qualifiedName: name });
        } else if (NPM_NAME.test(stripVersion(first))) {
          pushUnique(out.sources, { kind: "npm", pkg: stripVersion(first) });
        }
      } else {
        const fromIdx = rest.indexOf("--from");
        const spec = fromIdx !== -1 ? rest[fromIdx + 1] : rest.find((t) => !t.startsWith("-"));
        if (spec && !spec.includes("://") && /^[a-z0-9][\w.-]*/i.test(spec))
          pushUnique(out.sources, { kind: "pypi", pkg: stripVersion(spec) });
      }
    }
  }

  // A bare name: `@owner/server` or `server` (a Smithery name, maybe an npm package)
  if (out.sources.length === 0 && !out.yaml && /^\S+$/.test(input) && NPM_NAME.test(input)) {
    pushUnique(out.sources, { kind: "smithery", qualifiedName: input });
  }
  return out;
}

// ─── Matching against the catalogue ──────────────────────────────────────────

function normRepo(url: string): { owner: string; repo: string; path?: string } | null {
  const m = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/[^/]+\/(.+?))?\/?$/i.exec(url);
  if (!m) return null;
  return {
    owner: m[1]!.toLowerCase(),
    repo: m[2]!.toLowerCase(),
    ...(m[3] ? { path: m[3]!.toLowerCase() } : {}),
  };
}

/** `@smithery-ai/brave-search` → `brave-search`; `mcp-server-time` → `time`; `context7-mcp` → `context7`. */
export function coreName(name: string): string {
  const last = name.toLowerCase().split("/").pop() ?? "";
  return last
    .replace(/^@/, "")
    .replace(/^(mcp-server-|server-|mcp-)/, "")
    .replace(/(-mcp-server|-mcp|-server|mcp)$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface CatalogueMatch {
  entry: MigrationCatalogueEntry;
  /** exact = same package or repository; probable = same name only. */
  confidence: "exact" | "probable";
}

export function matchCatalogue(
  sources: readonly MigrationSource[],
  catalogue: readonly MigrationCatalogueEntry[]
): CatalogueMatch | null {
  const byPkg = (pkg: string) =>
    catalogue.find((c) => c.pkg && c.pkg.toLowerCase() === pkg.toLowerCase());
  for (const s of sources) {
    if (s.kind === "npm" || s.kind === "pypi") {
      const hit = byPkg(s.pkg);
      if (hit) return { entry: hit, confidence: "exact" };
    }
    if (s.kind === "smithery") {
      const hit = byPkg(s.qualifiedName);
      if (hit) return { entry: hit, confidence: "exact" };
    }
    if (s.kind === "github") {
      for (const c of catalogue) {
        const r = c.repoUrl ? normRepo(c.repoUrl) : null;
        if (!r || r.owner !== s.owner.toLowerCase() || r.repo !== s.repo.toLowerCase()) continue;
        // A monorepo (modelcontextprotocol/servers) only matches on the same subfolder.
        if (r.path ? s.path?.toLowerCase() === r.path : true)
          return { entry: c, confidence: "exact" };
      }
    }
  }
  for (const s of sources) {
    const name =
      s.kind === "smithery"
        ? s.qualifiedName
        : s.kind === "npm" || s.kind === "pypi"
          ? s.pkg
          : s.kind === "github"
            ? (s.path ?? s.repo)
            : null;
    if (!name) continue;
    const core = coreName(name);
    if (!core) continue;
    const hit = catalogue.find(
      (c) =>
        c.slug === core || coreName(c.name) === core || (c.pkg !== null && coreName(c.pkg) === core)
    );
    if (hit) return { entry: hit, confidence: "probable" };
  }
  return null;
}

// ─── The plan ────────────────────────────────────────────────────────────────

export type MigrationPlan =
  | { route: "empty" }
  | ({ route: "catalogue" } & CatalogueMatch & { smitheryUrl?: string; yamlKeys: string[] })
  | {
      route: "publish";
      runtime: "node" | "python";
      pkg: string;
      name: string;
      slug: string;
      startCmd: string;
      smitheryUrl?: string;
      yamlKeys: string[];
    }
  | {
      route: "manual";
      reason: "docker" | "no-package" | "unknown";
      qualifiedName?: string;
      repo?: string;
      smitheryUrl?: string;
      yamlKeys: string[];
    };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function titleCase(s: string): string {
  return s
    .replace(/(^|[-_ ])(\w)/g, (_, sep: string, c: string) => (sep ? " " : "") + c.toUpperCase())
    .trim();
}

export function planMigration(
  raw: string,
  catalogue: readonly MigrationCatalogueEntry[]
): MigrationPlan {
  const parsed = parseMigrationInput(raw);
  const { sources, smitheryUrl, configKeys: yamlKeys } = parsed;
  if (sources.length === 0 && !parsed.yaml && !smitheryUrl) {
    return raw.trim() ? { route: "manual", reason: "unknown", yamlKeys } : { route: "empty" };
  }
  const match = matchCatalogue(sources, catalogue);
  if (match) return { route: "catalogue", ...match, smitheryUrl, yamlKeys };

  const pkgSource = sources.find(
    (s): s is Extract<MigrationSource, { kind: "npm" | "pypi" }> =>
      s.kind === "npm" || s.kind === "pypi"
  );
  if (pkgSource) {
    const runtime = pkgSource.kind === "npm" ? "node" : "python";
    const base = coreName(pkgSource.pkg) || slugify(pkgSource.pkg);
    return {
      route: "publish",
      runtime,
      pkg: pkgSource.pkg,
      name: titleCase(base),
      slug: slugify(base),
      startCmd: runtime === "node" ? `npx -y ${pkgSource.pkg}` : `uvx ${pkgSource.pkg}`,
      smitheryUrl,
      yamlKeys,
    };
  }
  if (sources.some((s) => s.kind === "docker"))
    return { route: "manual", reason: "docker", smitheryUrl, yamlKeys };
  const sm = sources.find(
    (s): s is Extract<MigrationSource, { kind: "smithery" }> => s.kind === "smithery"
  );
  const gh = sources.find(
    (s): s is Extract<MigrationSource, { kind: "github" }> => s.kind === "github"
  );
  return {
    route: "manual",
    reason: "no-package",
    ...(sm ? { qualifiedName: sm.qualifiedName } : {}),
    ...(gh ? { repo: `${gh.owner}/${gh.repo}` } : {}),
    smitheryUrl,
    yamlKeys,
  };
}
