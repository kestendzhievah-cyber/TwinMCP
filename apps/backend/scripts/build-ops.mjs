// Bundle the database ops scripts (migrations + catalogue seed) into standalone
// ESM files the production image can run with plain `node`, without tsx or the
// dev dependencies. Run in the Docker builder stage (see the root Dockerfile);
// docker-entrypoint.sh runs the output before starting the server.
//
//   node scripts/build-ops.mjs   →   ops/migrate.mjs, ops/seed-mcps.mjs

import { build } from "esbuild";

await build({
  entryPoints: {
    migrate: "src/db/migrate.ts",
    "seed-mcps": "scripts/seed-mcps.ts",
  },
  outdir: "ops",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Bundled CommonJS dependencies (dotenv…) call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
