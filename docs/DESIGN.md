# TwinMCP design system — "the card"

**Reference:** a letterpress business card on bone stock (the *Pierce & Pierce* card:
phone top-left, firm + "Mergers and Acquisitions" top-right, the name and title engraved
dead-centre in letterspaced small capitals, one address line along the bottom). The whole
product — marketing site, auth, onboarding, dashboard, docs, blog — is typeset like that
card. Think 1987 Wall Street: restraint, hairlines, serif small caps, bone paper, ink.
No gradients, no glass, no glow, no rounded pills, no emoji.

Everything below is already encoded in `apps/backend/src/app/globals.css`,
`apps/backend/tailwind.config.ts` and `apps/backend/src/components/ui/*`. Pages compose
those primitives; this document says how.

---

## 1. Material

| Token | Light ("the card") | Dark ("after hours") | Use |
|---|---|---|---|
| `background` | bone `hsl(40 35% 93%)` + paper grain | ink stock `hsl(36 12% 8%)` | page |
| `card` / `popover` | lighter bone `hsl(42 45% 96%)` | `hsl(34 13% 10%)` | cards, dialogs, inputs |
| `foreground` | pressed charcoal `hsl(30 8% 16%)` | bone `hsl(42 31% 87%)` | ink |
| `muted-foreground` | `hsl(35 9% 37%)` | `hsl(39 11% 62%)` | secondary text (AA on bone) |
| `secondary` / `muted` / `accent` | darker bone `hsl(40 31% 89%)` | `hsl(26 10% 14%)` | chips, hover surfaces, skeletons |
| `border` / `input` | warm hairline `hsl(40 21% 81%)` | `hsl(33 12% 19%)` | every rule |
| `primary` | ink | bone | filled buttons/badges |
| `brand` | pinstripe navy `hsl(222 37% 22%)` | steel `hsl(219 35% 68%)` | links, active nav marker, selection |
| `gilt` | brass foil `hsl(41 55% 36%)` | `hsl(42 52% 56%)` | "Most popular", Pro/Team seals, admin markers — rare |
| `success` | racing green | lighter green | running / paid / ok |
| `warning` | ochre | lighter ochre | provisioning / pending / quota |
| `info` | steel blue | lighter steel | neutral notices |
| `destructive` | oxblood `hsl(355 50% 33%)` | `hsl(357 47% 62%)` | errors, danger buttons |

Rules:
- Semantic colours are **text + hairline + 10 % tint**: `border-success/40 bg-success/10 text-success`.
  Never a solid fill except `destructive` buttons and the `default` badge.
- **No Tailwind palette classes** (`emerald-500`, `amber-100`, `sky-700`, `violet-…`, `blue-…`,
  `red-400`, `green-…`, `zinc/gray/slate/neutral-…`). The vitest guard
  `src/__tests__/design-tokens.test.ts` fails on them.
- No `dark:` colour overrides — tokens already flip. (`dark:` for layout is fine.)
- Light-on-ink panels ("ink stock"): give the panel the `dark` class so tokens flip locally
  (`<div className="dark bg-background text-foreground">`). Use for the logs viewer and code
  terminal mockups, nothing else.

## 2. Type

- **Everything** is EB Garamond (`font-serif`; `font-sans` is aliased to it). Code, slugs, keys,
  URLs, logs, IDs = Courier Prime (`font-mono`).
- Weights: `font-normal` 400 (body), `font-medium` 500 (headings, labels, buttons). `font-semibold`
  and `font-bold` are remapped to 500/600 — write `font-medium` in new code.
- The scale is ~6 % larger than Tailwind's (Garamond has a small x-height). Do **not** use
  `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`: minimum is `text-xs` (13 px).
- **Small capitals** are the card's voice. Utility `smallcaps` (= `font-variant-caps: small-caps`
  + 0.08 em tracking). Use it, adding `tracking-sc` (0.12 em) where it needs more air, for:
  wordmark, nav links, eyebrows, buttons, badges, labels, table headers, tabs, breadcrumbs,
  stat captions, footer "address line", dialog/card titles, dashboard page `<h1>`s.
  Never on body copy, never on code, never on number-heavy cells.
- `eyebrow` utility = tiny, 0.28 em tracked, muted small caps (the "Mergers and Acquisitions" line).
- `display` utility = big engraved small caps for marketing `<h1>`s:
  `display letterpress text-5xl md:text-6xl lg:text-7xl`.
- Section `<h2>`s: sentence case, `text-3xl md:text-4xl font-medium` (no small caps, no negative tracking).
- Secondary/explanatory lines may be *italic* (card/dialog descriptions, captions, placeholders).
  Keep italics short; never italicise a paragraph.
- Numerals: body is old-style (`onum`) by default; data is lining tabular. Tables, code, inputs and
  `<time>` are already lining. Add the `lining` utility on any stat, price, quota, count or date
  outside those.
- `tracking-tight` is remapped to 0 — remove it when you touch a line. Negative tracking is banned.
- Never `uppercase` + `tracking-[0.18em]`/`tracking-wider` for labels anymore — that is the Inter
  look. Use `smallcaps` (keep the original casing of the text).

## 3. Shape, rules, elevation

- Radius is **0 everywhere** (`rounded-*` are all remapped to 0). Only `rounded-full` stays, for
  status dots and avatars, nothing else (no pill buttons, no round icon tiles). Delete
  `rounded-xl/2xl/lg/md/sm` from class strings when you touch a line.
- Hairline: `border border-border`. Ink hairline for emphasis (dialogs, popovers, the highlighted
  pricing tier, focused inputs): `border-foreground/60` to `/70`.
- Double rule (`rule-double` utility or `<Separator variant="double" />`): under dashboard
  page-title blocks, on top of major marketing sections (`bordered`), around the footer address line.
- Shadows: `shadow-sm` (hairline lift, cards), `shadow-lg` (one card offset under: popovers,
  toasts), `shadow-stack` (two bone cards fanned under at 4 px / 8 px — the photo): hero mockup,
  dialogs, highlighted pricing tier, auth side-panel figure, 404/error card. Nothing else.
  `shadow-inner` on inputs (debossed). Remove `shadow-2xl shadow-black/5`, `blur-*`,
  `backdrop-blur`, halos, `bg-gradient-*`, `bg-clip-text`, `bg-[radial-gradient(...)]`.
- Dividers between inline meta: a middle dot `·` in `text-muted-foreground`, not a pipe.
- Icons: lucide, stroke 1.5 (global), `h-4 w-4` default, muted colour. Icons never sit in round
  tinted circles: put them bare, or in a hairline square
  (`grid h-9 w-9 place-items-center border border-border text-muted-foreground`).
- Spacing rhythm: marketing sections `py-20 md:py-28`, dashboard pages `space-y-8`, cards `p-6`.

## 4. Motifs (use them — they are what makes it *the card*)

1. **Card header** (marketing header, auth header, onboarding header): `<Logo />` is the small-caps
   wordmark with the tagline "Managed MCP Runtimes" under it. The header is a bone bar with one
   hairline below (`border-b border-border bg-background/95`, sticky). Nav links:
   `smallcaps tracking-sc text-sm text-muted-foreground hover:text-foreground`; hovered/active link
   `underline decoration-brand underline-offset-[6px]`. Primary CTA = default button, secondary = ghost.
2. **The centred name** (home hero, pricing hero, use-case heroes, 404): eyebrow-with-rules →
   `display letterpress` `<h1>` centred → a short centred hairline (`mx-auto h-px w-12 bg-foreground/40`)
   → lead paragraph `mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground` → buttons → one
   small-caps "address line" of facts (`smallcaps tracking-sc text-xs text-muted-foreground`,
   items separated by ` · `).
3. **Stacked cards**: anything that is "the product" (hero mockup, dialogs, the auth figure) sits on
   `shadow-stack`. Keep it square — no rotation.
4. **Address line** (footer bottom, auth footer, onboarding footer): one centred line of small caps
   separated by ` · `, between two hairlines:
   `twinmcp.fr · hello@twinmcp.fr · security@twinmcp.fr · status.twinmcp.fr`.
   Only real facts — never invent a phone, fax, telex, street address, city or founding date.
5. **Ledger tables**: `Table` primitive — small-caps header row on a firmer rule, hairline rows,
   lining numerals, mono slugs.
6. **Typewriter code**: `CodeSnippet` / `<pre>` on `border border-border bg-secondary/60`, Courier,
   `text-sm leading-relaxed`; filename tab in `smallcaps tracking-sc text-xs text-muted-foreground`.
   The copy button is a hairline square (`border border-border bg-card`).
7. **Eyebrow with rules** (section headers): the eyebrow sits between two short hairlines:
   `<p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">`.
   Left-aligned variants drop the `after:` half.
8. **Seal** (`<Badge variant="gilt">`): "Most popular", "Official", "Pro". At most one per view.
9. **Status**: `success` running · `warning` provisioning / pending · `secondary` stopped ·
   `destructive` error · `outline` destroyed / unknown · `info` informational · `brand` "current / you".
10. **Hero mockup**: a bone dashboard card on `shadow-stack`: titlebar = hairline row with the mono
    URL (no traffic-light dots), sidebar with small-caps items (active = left ink rule), a ledger
    table of servers with status badges (§4.9), mono slugs and regions.

## 5. Component recipes (page level)

- **Marketing `Section`**: `py-20 md:py-28`; `bordered` → `rule-double` on top. Header block
  centred `max-w-2xl`: eyebrow-with-rules, `<h2 className="text-3xl md:text-4xl font-medium">`,
  description `mt-4 text-lg text-muted-foreground`.
- **Feature / benefit card**: `border border-border bg-card p-6`, title
  `smallcaps tracking-sc text-lg font-medium`, body `mt-2 text-base text-muted-foreground`.
  Hover: `hover:border-foreground/60` only. Numbered steps: the number in a hairline square,
  `lining font-medium`.
- **Pricing tier**: card; highlighted tier gets `border-foreground/70 shadow-stack` and a `gilt`
  seal `absolute -top-3 left-6`. Price `lining text-4xl font-medium`, cadence
  `text-sm italic text-muted-foreground`. Check marks `<Check className="h-4 w-4 text-success" />`,
  missing `<Minus className="h-4 w-4 text-muted-foreground/50" />`.
- **Dashboard page header**: `<h1 className="smallcaps tracking-sc text-2xl font-medium">` +
  `<p className="mt-1 text-sm italic text-muted-foreground">`, then
  `<Separator variant="double" className="mt-4" />` (or `rule-double` on the wrapper's bottom).
  Page-level actions (e.g. "New server") sit on the same row, right-aligned.
- **Stat card**: `CardDescription` (caption) + `CardTitle className="lining text-3xl"` (number) with
  `<span className="text-sm font-normal text-muted-foreground">/ limit</span>`. Progress bar:
  `h-1.5 w-full bg-secondary` + `h-full bg-foreground`. Quota warning → `bg-warning`,
  exhausted → `bg-destructive`.
- **Empty state**: `border border-dashed border-foreground/40 bg-transparent`, bare icon in
  `text-muted-foreground`, title small caps, body italic.
- **Forms**: `Label` (small caps) + `Input`; help text `text-xs italic text-muted-foreground`;
  errors: `flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive`
  with `AlertCircle`. Success confirmations use the `success` tint the same way.
- **Callouts / alerts**: the tint recipe per semantic (`info`, `warning`, `success`, `destructive`),
  `border-l-2 border-l-<semantic>` optional for a memo feel.
- **Dialogs**: already styled (ink hairline, `shadow-stack`, small-caps title, hairline under the
  header). Keep `DialogDescription`.
- **Sidebar nav (dashboard)**: bone, `border-r border-border`, `w-64`. Top block
  `<Logo tagline="Control Plane" />`; identity block = email `text-xs break-all text-muted-foreground`
  + plan badge (`success` for paid, `secondary` for free, `gilt` for team/enterprise); links
  `smallcaps tracking-sc text-sm`, active = `border-l-2 border-foreground pl-[11px] text-foreground`
  (inactive `border-l-2 border-transparent text-muted-foreground hover:text-foreground`); count
  badges = `Badge variant="destructive"` with `lining`. Icons `h-4 w-4`. Mobile drawer: same list.
- **Logs viewer**: the panel gets `dark bg-background text-foreground font-mono text-xs` (tokens flip
  locally); levels: info `text-foreground`, debug `text-muted-foreground`, warn `text-warning`,
  error `text-destructive`.
- **Kanban / columns**: hairline-separated (`divide-x divide-border`), column titles small caps with
  a `lining` count, cards inside are plain `border border-border bg-card p-3`.
- **Breadcrumbs**: `smallcaps tracking-sc text-xs text-muted-foreground`, separators `·`,
  current page `text-foreground`.
- **Blog `Prose`**: body `text-lg leading-8`; h2 `mt-12 text-3xl font-medium`; h3 `mt-8 text-2xl font-medium`;
  links `text-brand underline underline-offset-4 decoration-brand/40 hover:decoration-brand`;
  inline code `bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]`; `pre` as the typewriter block;
  blockquote `border-l-2 border-foreground/40 pl-5 italic`; tables as ledgers (hairlines only,
  header small caps); `hr` → `rule-double`.
- **404 / error pages**: a centred card on the stack (`border border-border bg-card p-10 shadow-stack`),
  `eyebrow` code ("404" / "Error"), serif title `text-3xl font-medium`, italic body, two buttons.
- **OG image** (`src/app/opengraph-image.tsx`): literally the business card at 1200×630: bone
  background `#f4f0e8`, a hairline frame inset 48 px (`#d8d1c3`), "TwinMCP" centred in letterspaced
  capitals (ink `#2b2825`, EB Garamond, ~110 px, letterSpacing 10), "MANAGED MCP RUNTIMES" under it
  (28 px, letterSpacing 8, muted `#665f55`), "twinmcp.fr" top-right in Courier, and one bottom line
  in small Courier caps: `CURSOR · CLAUDE CODE · WINDSURF · CLINE   —   HELLO@TWINMCP.FR`.
  Fonts: `src/app/fonts/EBGaramond-Medium.ttf` and `src/app/fonts/CourierPrime-Regular.ttf`,
  loaded with `await fetch(new URL("./fonts/EBGaramond-Medium.ttf", import.meta.url)).then(r => r.arrayBuffer())`
  (edge runtime, Satori needs real TTF). Satori has no `font-variant-caps`: write the small-caps
  lines in uppercase with letterSpacing instead.

## 6. Migration map (old → new)

| Old | New |
|---|---|
| `rounded-xl / rounded-2xl / rounded-lg / rounded-md / rounded-sm / rounded` | delete |
| `rounded-full` on icon tiles / pills / buttons / toggles | delete (square) — keep only on dots & avatars |
| `shadow-2xl shadow-black/5 dark:shadow-black/40` | `shadow-stack` |
| `shadow-md shadow-foreground/[0.04]` | `shadow-stack` (if highlighted) else `shadow-sm` |
| `bg-gradient-to-r … bg-clip-text text-transparent` | plain `text-foreground` (or wrap in `<em>`) |
| radial/halo `bg-[radial-gradient…]`, `blur-2xl` divs | delete the element |
| `backdrop-blur supports-[backdrop-filter]:bg-background/60` | `bg-background/95` |
| `text-emerald-500` (check marks) | `text-success` |
| `bg-emerald-100 text-emerald-800 dark:…` / `ring-emerald-…` | `border border-success/40 bg-success/10 text-success` |
| `bg-amber-…`, `text-amber-…`, `border-amber-…` | `border-warning/40 bg-warning/10 text-warning` |
| `border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400` | `border-info/40 bg-info/10 text-info` |
| `text-red-400` / `text-red-…` | `text-destructive` |
| `text-green-600` | `text-success` |
| `text-zinc-…`, `bg-zinc-950`, `text-cyan-400` (logs) | the `dark` panel trick + tokens (§5 logs) |
| `bg-emerald-500 text-white` / `bg-emerald-600 … hover:bg-emerald-700` (promo) | `bg-gilt text-gilt-foreground hover:bg-gilt/90` or `Badge variant="gilt"` |
| `bg-yellow-400` (password meter) | `bg-warning`; weak `bg-destructive`; strong `bg-success` |
| `from-violet-500 to-blue-500` | delete |
| `text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground` | `eyebrow` |
| `text-xs font-semibold uppercase tracking-wider` | `smallcaps tracking-sc text-xs font-medium` |
| `text-[10px]` / `text-[11px]` / `text-[12px]` / `text-[13px]` | `text-xs` |
| `font-semibold` / `font-bold` | `font-medium` |
| `tracking-tight` | delete |
| `bg-muted/40 px-4 py-2` code header | `bg-secondary/60` + small-caps filename |
| `h-9` inputs/buttons | `h-10` |
| icon in `rounded-full bg-secondary` / `rounded-md bg-secondary` tile | bare icon, or hairline square |
| `border-dashed` empty state | keep dashed, `border-foreground/40` |
| `hover:bg-accent` on links | `hover:text-brand` or `hover:bg-secondary` |
| `text-foreground underline decoration-dotted` | `text-brand underline underline-offset-4` |
| `bg-black/50` overlays | `bg-foreground/30` |
| `text-white` | `text-primary-foreground` / `text-background` |

## 7. Non-negotiables when restyling a file

1. **Behaviour is frozen.** Do not change logic, state, data fetching, handlers, props, exports,
   routes, `Route` casts, `"use client"`, analytics (`track`, `TrackOnMount`), SEO (`metadata`,
   `JsonLd`, hreflang), i18n string tables, a11y attributes (`aria-*`, `role`, `sr-only`,
   landmarks, heading levels, `autoFocus`), `content-visibility` wrappers, or comments explaining
   why something exists.
2. Copy may be **lightly** adjusted only where a motif needs it (a footer address line, an
   eyebrow). Never invent facts: no phone/fax/telex numbers, street address, city, founding year,
   customer names, testimonials, or stats that are not already on the page.
3. No new dependencies. No new fonts. No inline `style` colours (except in the OG image renderer,
   which cannot use CSS classes).
4. Keep files prettier-clean (`printWidth 100`, double quotes, trailing commas es5, LF).
5. Keep the dark theme working: tokens only.
6. Mobile first: 16 px gutters, no horizontal overflow, tap targets ≥ 40 px.
7. Only touch the files you were assigned. Shared primitives live in `components/ui` and are done;
   if one seems wrong, report it instead of editing it.

## 8. Checklist per file (run before you return)

- [ ] zero Tailwind palette colours, zero `dark:` colour classes, zero gradients/blur
- [ ] zero `rounded-*` except `rounded-full` on dots/avatars
- [ ] labels/eyebrows/buttons/badges/tabs/table heads in `smallcaps`; body copy not
- [ ] numbers in data contexts use `lining` (or live inside Table/code)
- [ ] h1/h2 sizes follow §2; no `tracking-tight`, no `font-bold`, no `text-[10px]`
- [ ] one `gilt` seal max per view; `shadow-stack` only on the product / dialogs / highlight
- [ ] the page still reads correctly in dark mode (tokens only)
- [ ] behaviour / props / exports / i18n / SEO / a11y untouched

## 9. Logo

The brand is typography. The monogram is the engraved "T" inside a double-rule frame; the
lockup pairs it with the small-caps wordmark and the tagline. All files are true vectors
(EB Garamond outlines, no font dependency) and live in `apps/backend/public/`:

| File | Use |
|---|---|
| `logo.svg` / `logo-dark.svg` | horizontal lockup (mark + wordmark + tagline), ink / bone |
| `logo-wordmark.svg` / `-dark.svg` | wordmark + tagline only |
| `logo-mark.svg` / `-dark.svg` | monogram on transparent |
| `twinmcp-icon.svg` | monogram on bone (same drawing, legacy name) |
| `twinmcp-logo.svg` | = `logo.svg` (legacy name) |
| `icon-192.png`, `icon-512.png`, `src/app/icon.png`, `apple-icon.png` | PWA / favicon rasters of the monogram |
| `cover.png` | the social card (same render as `/opengraph-image`) |

In the UI use the `Logo` component (`mark` prop draws the same monogram in `currentColor`).
Never stretch, recolour outside ink/bone, or add effects. Minimum size: 16 px for the mark.
The generator script is not in the repo; regenerate from the EB Garamond Medium TTF if the
drawing changes.
