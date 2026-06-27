# ADR 0002 — UI language: defer full French translation, plan an i18n layer

- **Status:** Accepted
- **Date:** 2026-06-27
- **Context epic:** Épopée 9.3 (`docs/PROMPT-LANCEMENT.md`) — "uniformise la langue de l'UI en français".

## Context

The app mixes languages: the marketing site has a French shadow (`app/fr/**` +
`lib/i18n/locales.ts`, SEO-only), the **auth** pages are French, **billing** is
mixed (English structure + French banners), and the **dashboard + onboarding**
are English. The product domain is `twinmcp.fr` and the target audience is
French-speaking, so the intent is a French UI.

Recon findings that drive this decision:
- **No runtime i18n infrastructure** usable by the dashboard. `lib/i18n/locales.ts`
  is SEO-only (hreflang + language-switcher labels) and explicitly states
  "Dashboards and auth remain English-only by design." There is no
  next-intl / react-intl / i18next / lingui dependency and no `t()` helper —
  every string is a hardcoded JSX literal.
- A full-French dashboard + onboarding means manually rewriting literals across
  **~33 files** (27 dashboard `.tsx` + 6 onboarding `.tsx`) plus shared
  `components/pricing/pricing-data.ts` and `PLAN_LABELS`.
- French text is **apostrophe-heavy** (`l'`, `d'`, `s'`, `aujourd'hui`), which
  trips `react/no-unescaped-entities` — every such string needs `&apos;` /
  `{"'"}` handling. Doing this as a raw pre-push patch is large, noisy, and
  regression-prone (interpolation, `aria-label`s, pluralization).

## Decision

**Defer** the full French UI translation. Do **not** ship a partial raw-literal
translation — it increases inconsistency and risks regressions right before a
release. Treat it as a dedicated, reviewable workstream.

When done, do it properly:
1. Introduce an i18n layer (**next-intl** recommended for the App Router).
2. Extract dashboard + onboarding + auth + billing strings into message catalogs
   (`fr`, and `en` if kept), via a `useTranslations()` / `getTranslations()` API.
3. Make `PLAN_LABELS` and `pricing-data.ts` locale-aware (or keep plan names as
   proper nouns).
4. Set French as the default locale for the app shell; keep the existing
   marketing `app/fr/**` SEO setup.

## Consequences

- Launch ships with the current mixed FR/EN UI (functional, not blocking).
- The translation is tracked here as a known follow-up, not silently skipped.
- Everything else in Épopée 9 (catalog hardening, residual plan gating, dashboard
  status polling + quota card) is done and shipped.
