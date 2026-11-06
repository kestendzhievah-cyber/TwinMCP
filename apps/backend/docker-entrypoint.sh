#!/bin/sh
# Production container start: schema first, then the catalogue, then the server.
#
# Dokploy deploys this image straight from the repo, so nothing else runs the
# migrations or the MCP catalogue seed (the GitHub deploy workflow is manual
# only). Both are idempotent, so they run on every start.
#
#   - A failed migration stops the container: never serve new code on an old
#     schema (the container exits instead of starting the server).
#   - A failed seed only warns: the marketplace keeps the previous catalogue.
#   - SKIP_DB_MIGRATIONS=1 skips both (emergency escape hatch).
set -e

if [ "${SKIP_DB_MIGRATIONS:-0}" != "1" ]; then
  echo "[boot] applying database migrations"
  node ops/migrate.mjs
  echo "[boot] seeding the MCP catalogue"
  node ops/seed-mcps.mjs || echo "[boot] WARNING: catalogue seed failed, the marketplace keeps the previous catalogue"
else
  echo "[boot] SKIP_DB_MIGRATIONS=1: migrations and catalogue seed skipped"
fi

exec node server.js
