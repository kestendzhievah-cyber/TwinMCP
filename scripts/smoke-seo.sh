#!/usr/bin/env bash
#
# Post-deploy smoke test for TwinMCP's SEO surface.
# Runs ~30 curl checks against a deployed instance, exits 0 if all pass.
#
# Usage:
#   scripts/smoke-seo.sh                      # default: https://twinmcp.dev
#   scripts/smoke-seo.sh https://preview.url  # override base
#   BASE=https://preview.url scripts/smoke-seo.sh
#
# Windows: run via Git Bash, WSL, or any POSIX shell. PowerShell will not work.

set -u

BASE="${1:-${BASE:-https://twinmcp.dev}}"
BASE="${BASE%/}"  # strip trailing slash
TIMEOUT=10
PASS=0
FAIL=0
WARN=0

# Color setup (disabled when stdout is not a TTY)
if [ -t 1 ]; then
  GREEN=$'\033[0;32m'
  RED=$'\033[0;31m'
  YELLOW=$'\033[1;33m'
  DIM=$'\033[2m'
  BOLD=$'\033[1m'
  RESET=$'\033[0m'
else
  GREEN='' ; RED='' ; YELLOW='' ; DIM='' ; BOLD='' ; RESET=''
fi

ok()   { printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$1"; PASS=$((PASS + 1)); }
bad()  { printf "  %s✗%s %s %s%s%s\n" "$RED" "$RESET" "$1" "$DIM" "${2:-}" "$RESET"; FAIL=$((FAIL + 1)); }
warn() { printf "  %s!%s %s %s%s%s\n" "$YELLOW" "$RESET" "$1" "$DIM" "${2:-}" "$RESET"; WARN=$((WARN + 1)); }
section() { printf "\n%s── %s ──%s\n" "$DIM" "$1" "$RESET"; }

# ─── Helpers ────────────────────────────────────────────────────────────────

status_of() {
  # curl returns the HTTP code even for 4xx/5xx; "000" on connection failure.
  curl -sSL -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$1" 2>/dev/null
}

body_of() {
  curl -sSL --max-time "$TIMEOUT" "$1" 2>/dev/null || true
}

content_type_of() {
  curl -sSI --max-time "$TIMEOUT" "$1" 2>/dev/null \
    | tr -d '\r' \
    | awk 'BEGIN{IGNORECASE=1} /^content-type:/ {sub(/^[^:]+: */,""); print; exit}'
}

check_200() {
  local url="$1" label="${2:-$1}" code
  code=$(status_of "$url")
  if [ "$code" = "200" ]; then
    ok "$label"
  else
    bad "$label" "HTTP $code"
  fi
}

check_contains() {
  local url="$1" needle="$2" label="$3"
  local body
  body=$(body_of "$url")
  if printf '%s' "$body" | grep -q -- "$needle"; then
    ok "$label"
  else
    bad "$label" "missing: $needle"
  fi
}

# ─── Run ────────────────────────────────────────────────────────────────────

printf "%sSmoke test%s %s%s%s\n" "$BOLD" "$RESET" "$DIM" "$BASE" "$RESET"

# Pre-flight: target reachable at all?
ROOT_CODE=$(status_of "$BASE/")
if [ "$ROOT_CODE" = "000" ] || [ -z "$ROOT_CODE" ]; then
  printf "\n%sCannot reach %s — aborting%s\n" "$RED" "$BASE" "$RESET"
  exit 2
fi

section "Sitemap & robots"
check_200 "$BASE/sitemap.xml" "/sitemap.xml is 200"
URL_COUNT=$(body_of "$BASE/sitemap.xml" | grep -c '<url>' || true)
if [ "${URL_COUNT:-0}" -ge 42 ]; then
  ok "/sitemap.xml lists ${URL_COUNT} URLs (≥42)"
else
  bad "/sitemap.xml lists ${URL_COUNT:-0} URLs" "expected ≥42"
fi
check_200 "$BASE/robots.txt" "/robots.txt is 200"
check_contains "$BASE/robots.txt" "Sitemap:" "/robots.txt references sitemap"

section "Public EN pages"
EN_PATHS="/ /plans /docs /docs/api-reference /blog /blog/what-is-mcp /blog/mcp-server-hosting /blog/build-mcp-server /blog/cursor-mcp-setup /blog/production-mcp-servers /use-cases /use-cases/cursor-mcp-hosting /use-cases/claude-mcp-hosting /use-cases/notion-mcp /use-cases/github-mcp /servers /servers/filesystem /servers/github /servers/notion /servers/linear /servers/playwright"
for p in $EN_PATHS; do
  check_200 "$BASE$p" "$p"
done

section "Public FR pages"
FR_PATHS="/fr /fr/blog /fr/blog/what-is-mcp /fr/blog/mcp-server-hosting /fr/blog/build-mcp-server"
for p in $FR_PATHS; do
  check_200 "$BASE$p" "$p"
done

section "SEO assets"
check_200 "$BASE/manifest.webmanifest" "/manifest.webmanifest is 200"
check_contains "$BASE/manifest.webmanifest" "TwinMCP" "/manifest.webmanifest mentions TwinMCP"
check_200 "$BASE/opengraph-image" "/opengraph-image is 200"
OG_CT=$(content_type_of "$BASE/opengraph-image")
case "$OG_CT" in
  image/*) ok "/opengraph-image content-type is ${OG_CT}" ;;
  *)       bad "/opengraph-image content-type" "got '${OG_CT}' (expected image/*)" ;;
esac
check_200 "$BASE/icon.png" "/icon.png is 200"
check_200 "$BASE/apple-icon.png" "/apple-icon.png is 200"

section "Schema.org JSON-LD"
check_contains "$BASE/"                       'application/ld+json'         "/ has JSON-LD"
check_contains "$BASE/plans"                  '"@type":"Product"'           "/plans has Product schema"
check_contains "$BASE/plans"                  '"@type":"FAQPage"'           "/plans has FAQPage schema"
check_contains "$BASE/"                       '"@type":"SoftwareApplication"' "/ has SoftwareApplication"
check_contains "$BASE/"                       '"@type":"HowTo"'             "/ has HowTo schema"
check_contains "$BASE/blog/build-mcp-server"  '"@type":"HowTo"'             "tutorial has HowTo schema"
check_contains "$BASE/servers/github"         '"@type":"BreadcrumbList"'    "/servers/github has Breadcrumb"
check_contains "$BASE/servers/github"         '"@type":"FAQPage"'           "/servers/github has FAQPage"

section "Hreflang alternates"
check_contains "$BASE/blog/what-is-mcp"      'hreflang="fr"' "EN pillar links to FR alternate"
check_contains "$BASE/fr/blog/what-is-mcp"   'hreflang="en"' "FR pillar links to EN alternate"
check_contains "$BASE/blog/what-is-mcp"      'hreflang="x-default"' "EN pillar has x-default"

section "Verification meta"
ROOT_BODY=$(body_of "$BASE/")
if printf '%s' "$ROOT_BODY" | grep -qi 'name="google-site-verification"'; then
  ok "google-site-verification meta present"
else
  warn "google-site-verification meta" "missing — set NEXT_PUBLIC_GSC_VERIFICATION env"
fi
if printf '%s' "$ROOT_BODY" | grep -qi 'name="msvalidate.01"'; then
  ok "Bing msvalidate.01 meta present"
else
  warn "Bing msvalidate.01 meta" "missing — set NEXT_PUBLIC_BING_VERIFICATION env"
fi

section "IndexNow"
INDEXNOW_CODE=$(status_of "$BASE/indexnow.txt")
case "$INDEXNOW_CODE" in
  200) ok "/indexnow.txt is 200 (INDEXNOW_KEY env set)" ;;
  404) warn "/indexnow.txt is 404" "INDEXNOW_KEY env not set yet — fine until you start submitting" ;;
  *)   bad "/indexnow.txt" "HTTP $INDEXNOW_CODE" ;;
esac

section "Blog RSS"
check_200 "$BASE/blog/feed.xml" "/blog/feed.xml is 200"
RSS_CT=$(content_type_of "$BASE/blog/feed.xml")
case "$RSS_CT" in
  *rss*|*xml*) ok "/blog/feed.xml content-type is ${RSS_CT}" ;;
  *)           warn "/blog/feed.xml content-type" "got '${RSS_CT}' (expected rss+xml)" ;;
esac
check_contains "$BASE/blog/feed.xml" '<rss' "/blog/feed.xml is valid RSS"

section "Canonical tags"
check_contains "$BASE/blog/what-is-mcp" 'rel="canonical"' "pillar has canonical link"
check_contains "$BASE/servers/github"   'rel="canonical"' "server page has canonical link"

# ─── Summary ────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL))
printf "\n"
if [ "$FAIL" -eq 0 ]; then
  printf "%s%d / %d checks passed%s" "$GREEN" "$PASS" "$TOTAL" "$RESET"
  [ "$WARN" -gt 0 ] && printf " %s(%d warning%s)%s" "$YELLOW" "$WARN" "$([ "$WARN" -gt 1 ] && echo s || echo "")" "$RESET"
  printf "\n"
  exit 0
else
  printf "%s%d / %d checks failed%s" "$RED" "$FAIL" "$TOTAL" "$RESET"
  [ "$WARN" -gt 0 ] && printf " %s(+%d warning%s)%s" "$YELLOW" "$WARN" "$([ "$WARN" -gt 1 ] && echo s || echo "")" "$RESET"
  printf "\n"
  exit 1
fi
