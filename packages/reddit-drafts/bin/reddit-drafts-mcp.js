#!/usr/bin/env node
import { main } from "../src/server.js";

main().catch((e) => {
  console.error("reddit-drafts-mcp failed to start:", e);
  process.exit(1);
});
