#!/usr/bin/env bash
#
# Fire drill: verify the auto-rollback path actually works end to end.
#
#   1. Push a commit that breaks /blog/what-is-mcp (renames the page folder)
#   2. Wait for the deploy workflow to run: deploy → smoke ❌ → rollback ✅
#   3. Confirm prod is healthy via scripts/smoke-seo.sh
#   4. Push a revert commit, wait for the normal redeploy
#   5. Final smoke check
#
# Requires: gh CLI authenticated, clean main, pushed in sync.
#
# Usage:
#   scripts/fire-drill.sh                     # interactive, https://twinmcp.dev
#   scripts/fire-drill.sh --dry-run           # show plan, change nothing
#   scripts/fire-drill.sh --base https://...  # different target (staging)
#   scripts/fire-drill.sh --yes               # skip the confirmation prompt
#
# IMPORTANT: this pushes TWO commits to origin/main and intentionally breaks
# production for ~5 minutes. Do not run during launch / business hours.

set -euo pipefail

BASE="https://twinmcp.dev"
DRY_RUN=false
ASSUME_YES=false
DRILL_PATH="apps/backend/src/app/blog/what-is-mcp"
DRILL_PATH_BROKEN="apps/backend/src/app/blog/what-is-mcp-FIREDRILL-DISABLED"
DRILL_URL_PATH="/blog/what-is-mcp"
WORKFLOW_NAME="Deploy Backend"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SMOKE_SCRIPT="$SCRIPT_DIR/smoke-seo.sh"

# ── arg parsing ─────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)  DRY_RUN=true ; shift ;;
    --yes|-y)   ASSUME_YES=true ; shift ;;
    --base)     BASE="$2" ; shift 2 ;;
    -h|--help)  sed -n '2,18p' "$0" ; exit 0 ;;
    *)          echo "Unknown arg: $1" >&2 ; exit 2 ;;
  esac
done

# ── color helpers ───────────────────────────────────────────────────────────
if [ -t 1 ]; then
  G=$'\033[0;32m' ; R=$'\033[0;31m' ; Y=$'\033[1;33m' ; B=$'\033[1m' ; D=$'\033[2m' ; X=$'\033[0m'
else
  G='' ; R='' ; Y='' ; B='' ; D='' ; X=''
fi
say()   { printf "\n%s== %s%s\n" "$B" "$1" "$X"; }
ok()    { printf "  %s✓%s %s\n" "$G" "$X" "$1"; }
fail()  { printf "  %s✗%s %s\n" "$R" "$X" "$1"; }
note()  { printf "  %s•%s %s%s%s\n" "$D" "$X" "$D" "$1" "$X"; }
abort() { fail "$1" ; exit 1; }

run() {
  if $DRY_RUN; then
    printf "  %s[dry-run]%s %s\n" "$Y" "$X" "$*"
  else
    "$@"
  fi
}

# ── preflight ───────────────────────────────────────────────────────────────
say "Preflight checks"
command -v gh >/dev/null 2>&1 || abort "gh CLI not found (install: https://cli.github.com)"
gh auth status >/dev/null 2>&1 || abort "gh CLI not authenticated (run: gh auth login)"
ok "gh CLI authenticated"

[ -f "$SMOKE_SCRIPT" ] || abort "smoke-seo.sh not found at $SMOKE_SCRIPT"
ok "smoke-seo.sh available"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = "main" ] || abort "must run from 'main' (currently on '$BRANCH')"
ok "on branch main"

if [ -n "$(git status --porcelain)" ]; then
  abort "working tree must be clean — commit or stash first"
fi
ok "working tree clean"

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] || abort "local main is not in sync with origin/main"
ok "in sync with origin/main"

[ -d "$DRILL_PATH" ] || abort "target folder missing: $DRILL_PATH"
ok "drill target exists: $DRILL_PATH"

# ── plan + confirm ──────────────────────────────────────────────────────────
say "Plan"
printf "  Target site: %s%s%s\n" "$B" "$BASE" "$X"
printf "  Break path:  %s%s%s  (will 404 after deploy)\n" "$Y" "$DRILL_URL_PATH" "$X"
printf "  Expected:    deploy ✓ → smoke ✗ → rollback ✓ → site restored\n"
printf "  Duration:    ~5–10 minutes (build + deploy + rollback + revert)\n\n"
printf "  %sThis pushes 2 commits to origin/main and breaks prod briefly.%s\n" "$Y" "$X"

if ! $ASSUME_YES && ! $DRY_RUN; then
  printf "\n  Proceed? [y/N] "
  read -r ANSWER
  case "$ANSWER" in
    y|Y|yes) ;;
    *) echo "Aborted." ; exit 0 ;;
  esac
fi

# ── phase 1: break + push ───────────────────────────────────────────────────
say "Phase 1 — break ${DRILL_URL_PATH}"
run git mv "$DRILL_PATH" "$DRILL_PATH_BROKEN"
run git commit -m "test(fire-drill): break ${DRILL_URL_PATH} to verify rollback [DRILL]" --no-verify
BREAK_SHA=$(git rev-parse HEAD 2>/dev/null || echo "dry-run-sha")
note "break commit: $BREAK_SHA"
run git push origin main
ok "pushed break commit"

if $DRY_RUN; then
  echo "" ; note "Dry-run stop — no real workflow triggered, no revert needed."
  exit 0
fi

# ── phase 2: watch workflow ─────────────────────────────────────────────────
say "Phase 2 — watch deploy workflow (expecting smoke fail → rollback)"
sleep 5
RUN_ID=$(gh run list --workflow "$WORKFLOW_NAME" --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
[ -n "$RUN_ID" ] || abort "could not find a workflow run for $WORKFLOW_NAME on main"
RUN_URL=$(gh run view "$RUN_ID" --json url --jq '.url')
note "workflow run: $RUN_ID  ($RUN_URL)"

# gh run watch returns non-zero when the run fails — which we expect here.
gh run watch "$RUN_ID" --exit-status >/dev/null 2>&1 || true

WORKFLOW_STATUS=$(gh run view "$RUN_ID" --json conclusion --jq '.conclusion')
ROLLBACK_STATUS=$(gh run view "$RUN_ID" --json jobs --jq '.jobs[] | select(.name == "rollback") | .conclusion' 2>/dev/null || true)

note "workflow conclusion: $WORKFLOW_STATUS"
note "rollback job:        ${ROLLBACK_STATUS:-(did not run)}"

if [ "$ROLLBACK_STATUS" != "success" ]; then
  fail "rollback job did not succeed — production may be broken!"
  fail "investigate run: $RUN_URL"
  fail "you may need to manually deploy a known-good SHA via workflow_dispatch"
  exit 1
fi
ok "rollback job completed successfully"

# ── phase 3: verify prod healthy ────────────────────────────────────────────
say "Phase 3 — verify prod is healthy after rollback"
sleep 10
if bash "$SMOKE_SCRIPT" "$BASE" >/dev/null 2>&1; then
  ok "smoke test passes against $BASE"
else
  fail "smoke test still fails — rollback did not restore a healthy state"
  fail "the on-call response is needed; revert step below will likely fail too"
  exit 1
fi

# ── phase 4: revert + push ──────────────────────────────────────────────────
say "Phase 4 — revert the break commit"
run git mv "$DRILL_PATH_BROKEN" "$DRILL_PATH"
run git commit -m "revert: restore ${DRILL_URL_PATH} [DRILL COMPLETE]" --no-verify
REVERT_SHA=$(git rev-parse HEAD)
note "revert commit: $REVERT_SHA"
run git push origin main
ok "pushed revert commit"

# ── phase 5: watch the redeploy ─────────────────────────────────────────────
say "Phase 5 — watch the redeploy (expecting full success)"
sleep 5
RUN_ID2=$(gh run list --workflow "$WORKFLOW_NAME" --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
RUN_URL2=$(gh run view "$RUN_ID2" --json url --jq '.url')
note "workflow run: $RUN_ID2  ($RUN_URL2)"
if gh run watch "$RUN_ID2" --exit-status >/dev/null 2>&1; then
  ok "redeploy succeeded"
else
  fail "redeploy failed — production is currently running the previous (good) image"
  fail "investigate: $RUN_URL2"
  exit 1
fi

# ── phase 6: final sanity ───────────────────────────────────────────────────
say "Phase 6 — final smoke check"
sleep 10
if bash "$SMOKE_SCRIPT" "$BASE" >/dev/null 2>&1; then
  ok "smoke test passes"
else
  fail "smoke test fails on the redeployed code (this is bad — the supposedly-good version is broken)"
  exit 1
fi

# ── done ────────────────────────────────────────────────────────────────────
printf "\n%s✅ Fire drill passed%s — auto-rollback is working as designed.\n" "$G" "$X"
printf "  Break commit:  %s\n" "$BREAK_SHA"
printf "  Revert commit: %s\n" "$REVERT_SHA"
