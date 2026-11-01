# TwinMCP design system: "Clear sky"

Light-blue grounds, white cards, navy ink. **Rose** is the colour of the one thing we want
you to do (claim the free credit, take the next activation step, top up). **Blue** is for
links, selection and eyebrows. Sans-serif type, sentence case, soft corners, soft
navy-tinted shadows, and the real logos of the tools people already use.

This replaces the letterpress "card" system (EB Garamond small caps, bone paper, radius 0),
retired on 2026-10-31.

Everything below is encoded in `apps/backend/src/app/globals.css`,
`apps/backend/tailwind.config.ts` and `apps/backend/src/components/ui/*`. Pages compose
those primitives; this document says how. Paths below are relative to `apps/backend/`.

---

## 1. Principles

1. **Conversion first.** Each screen has one primary action, drawn as the rose `Button`
   (`variant="default"`). On marketing pages that action is "claim the €10"; in the app it
   is the next activation step, or a top-up when the balance is low. Everything else is
   `outline`, `ghost` or `link`, so the rose stands out because it is rare.
2. **The offer is the headline, not the small print**, and it is never misleading: the terms
   line (30 days, no card, no subscription, the server limit, the MCPs that wait for a
   top-up) is always next to the CTA.
3. **Clarity over ornament.** No small caps, no italic subtitles, no paper grain, no double
   rules, no gradients, no clipped text.
4. **Light and friendly.** Light-blue grounds, rounded corners, soft shadows, generous
   spacing.
5. **Honest EU/FR trust.** Prices in euros, FR as a first-class locale, GDPR / DPA /
   sub-processors linked. No claim the facts do not support (see §7).
6. **Accessible by construction.** Every text pair below meets WCAG AA. Focus is always a
   visible 2px navy ring with a 2px offset. Errors never rely on colour alone.

---

## 2. Tokens

HSL triplets in `globals.css`, so `bg-x/10` alpha works. Light is the default theme
(`ThemeProvider defaultTheme="light"`, `enableSystem` kept so the toggle offers System).

### 2.1 Light (`:root`)

| Token                                                          | Hex     | HSL                 | Role                                           |
| -------------------------------------------------------------- | ------- | ------------------- | ---------------------------------------------- |
| `--background`                                                 | #F3F8FF | `215 100% 97.6%`    | Page background (light blue)                   |
| `--surface-alt`                                                | #E6F0FC | `212.7 78.6% 94.5%` | Alternate section, table header, sidebar hover |
| `--surface-band`                                               | #D6E6FA | `213.3 78.3% 91%`   | Strong band (logo bar, auth side panel)        |
| `--card` / `--popover`                                         | #FFFFFF | `0 0% 100%`         | Cards, dialogs, menus, inputs                  |
| `--foreground` (+ card/popover/secondary/accent `-foreground`) | #0B1F3A | `214.5 68.1% 13.5%` | Ink (navy)                                     |
| `--muted-foreground`                                           | #3D5272 | `216.2 30.3% 34.3%` | Secondary text                                 |
| `--secondary` / `--muted` / `--accent`                         | #E6F0FC | `212.7 78.6% 94.5%` | Quiet fills, ghost hover                       |
| `--border`                                                     | #D2DEEE | `214.3 45.2% 87.8%` | Decorative hairlines, card borders             |
| `--input`                                                      | #7489A9 | `216.2 23.6% 55.9%` | Form controls and outline buttons              |
| `--ring`                                                       | #0B1F3A | `214.5 68.1% 13.5%` | Focus ring                                     |
| `--primary`                                                    | #C2255C | `339 68% 45.3%`     | Rose: primary buttons, key figures             |
| `--primary-foreground`                                         | #FFFFFF | `0 0% 100%`         |                                                |
| `--primary-hover`                                              | #A61E4D | `339.3 69.4% 38.4%` | Button hover                                   |
| `--primary-active`                                             | #8C1940 | `339.7 69.7% 32.4%` | Button pressed                                 |
| `--offer`                                                      | #FFE8EE | `344.3 100% 95.5%`  | Soft pink surface (offer badge, credit card)   |
| `--offer-foreground`                                           | #8A1538 | `342.1 73.6% 31.2%` | Text on the pink surface                       |
| `--offer-border`                                               | #F3A6BA | `344.4 76.2% 80.2%` | 1px border on pink surfaces                    |
| `--brand`                                                      | #1E4FC2 | `222.1 73.2% 43.9%` | Links, selected nav/chip/tab, eyebrows         |
| `--brand-foreground`                                           | #FFFFFF | `0 0% 100%`         |                                                |
| `--success`                                                    | #0E7A4B | `153.9 79.4% 26.7%` |                                                |
| `--warning`                                                    | #8A5A00 | `39.1 100% 27.1%`   |                                                |
| `--info`                                                       | #1D62B5 | `212.8 72.4% 41.2%` |                                                |
| `--destructive`                                                | #B42318 | `4.2 76.5% 40%`     | Error red (hue 4° vs the rose's 339°)          |
| status `-foreground`                                           | #FFFFFF | `0 0% 100%`         |                                                |
| `--shadow-color`                                               | navy    | `214.5 68.1% 13.5%` | `hsl(var(--shadow-color) / a)`                 |
| `--radius`                                                     |         | `0.75rem`           |                                                |

Tailwind names: `bg-surface-alt`, `bg-surface-band`, `bg-primary-hover`,
`bg-primary-active`, `bg-offer`, `text-offer-foreground`, `border-offer-border`, plus the
usual shadcn names.

**Light contrast ratios** (WCAG relative luminance; AA = 4.5 body, 3.0 large text / UI):

| Pair                                                                       | Ratio                            | Result                                                           |
| -------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| foreground on background / card / surface-alt / surface-band               | 15.48 / 16.52 / 14.34 / 13.02    | AAA                                                              |
| muted-foreground on background / card / surface-alt / surface-band / offer | 7.43 / 7.93 / 6.89 / 6.25 / 6.81 | AAA                                                              |
| White on primary (rest / hover / active)                                   | 5.66 / 7.21 / 9.02               | AA                                                               |
| Primary as text on background / card / surface-alt                         | 5.30 / 5.66 / 4.91               | AA                                                               |
| Primary as text on surface-band                                            | **4.46**                         | **Fails small text**: use `text-offer-foreground` or ≥ 24px      |
| Primary button fill against the page (1.4.11)                              | 5.30                             | Passes 3:1                                                       |
| offer-foreground on offer                                                  | 8.03                             | AAA                                                              |
| Primary text on offer                                                      | 4.86                             | AA                                                               |
| brand on background / card / surface-alt / surface-band                    | 6.67 / 7.11 / 6.18 / 5.61        | AA                                                               |
| White on brand                                                             | 7.11                             | AA                                                               |
| input border on card / background / surface-alt                            | 3.56 / 3.34 / 3.09               | Passes 3:1                                                       |
| success / warning / info / destructive on card                             | 5.38 / 5.93 / 6.06 / 6.57        | AA                                                               |
| ... on background                                                          | 5.04 / 5.55 / 5.68 / 6.16        | AA                                                               |
| ... on their 10% tint (`bg-x/10` over white)                               | 4.72 / 5.29 / 5.16 / 5.65        | AA                                                               |
| White on success / warning / info / destructive fills                      | 5.38 / 5.93 / 6.06 / 6.57        | AA                                                               |
| Focus ring (navy) on background                                            | 15.48                            | Passes                                                           |
| border on card                                                             | 1.36                             | Decorative only, never the sole cue for a control                |
| offer on background                                                        | 1.09                             | Pink surfaces always get `border-offer-border` + meaningful text |
| **Do not use:** rose button on a navy surface                              | 2.92                             | No navy band holds a rose button; use white text links           |

### 2.2 Dark (`.dark`)

| Token                                              | Hex     | HSL                 |
| -------------------------------------------------- | ------- | ------------------- |
| background                                         | #0A1424 | `216.9 56.5% 9%`    |
| surface-alt                                        | #0D1A2E | `216.4 55.9% 11.6%` |
| surface-band                                       | #13233D | `217.1 52.5% 15.7%` |
| card / popover                                     | #101D33 | `217.7 52.2% 13.1%` |
| foreground (and `-foreground` on neutral surfaces) | #E8EFFA | `216.7 64.3% 94.5%` |
| muted-foreground                                   | #A6B6CF | `216.6 29.9% 73.1%` |
| secondary / muted / accent                         | #13233D | `217.1 52.5% 15.7%` |
| border                                             | #263A5C | `217.8 41.5% 25.5%` |
| input                                              | #5B7299 | `217.7 25.4% 47.8%` |
| ring                                               | #E8EFFA | `216.7 64.3% 94.5%` |
| primary                                            | #F06A93 | `341.6 81.7% 67.8%` |
| primary-foreground                                 | #1B0610 | `331.4 63.6% 6.5%`  |
| primary-hover                                      | #FF85A8 | `342.8 100% 76.1%`  |
| primary-active                                     | #E0517D | `341.5 69.8% 59.8%` |
| offer                                              | #3A1426 | `331.6 48.7% 15.3%` |
| offer-foreground                                   | #FFB8CB | `343.9 100% 86.1%`  |
| offer-border                                       | #7A2A4A | `336 48.8% 32.2%`   |
| brand                                              | #8FB4FF | `220.2 100% 78%`    |
| brand / status `-foreground`                       | #0A1424 | `216.9 56.5% 9%`    |
| success                                            | #4ACB8E | `151.6 55.4% 54.3%` |
| warning                                            | #F2B755 | `37.5 85.8% 64.1%`  |
| info                                               | #7DB3F5 | `213 85.7% 72.5%`   |
| destructive                                        | #FF8A7A | `7.2 100% 73.9%`    |
| shadow-color                                       | black   | `0 0% 0%`           |

| Dark pair                                      | Ratio                     |
| ---------------------------------------------- | ------------------------- |
| Text on background / card / band               | 15.95 / 14.58 / 13.60     |
| Muted text on background / card / band         | 8.97 / 8.20 / 7.65        |
| #1B0610 on primary (rest / hover / active)     | 6.65 / 8.49 / 5.22        |
| Primary as text on background / card           | 6.31 / 5.77               |
| brand on card                                  | 8.14                      |
| success / warning / info / destructive on card | 8.21 / 9.38 / 7.74 / 7.36 |
| offer-foreground on offer                      | 9.92                      |
| input border on card                           | 3.46                      |

**Dark rule:** primary buttons use dark text (`text-primary-foreground` already does it).
White on #F06A93 is 2.92 and fails.

---

## 3. Rose budget

| Use                                                                                                                                                                        | Colour                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Primary button (at most **one solid rose button per viewport**), the offer badge, the € figure in the H1, balance and credit figures, the "Unlocks with first top-up" pill | Rose / offer                                                                          |
| Links, eyebrows, selected nav item, selected chip or tab, info, completed steps                                                                                            | Brand blue                                                                            |
| Text, tables, outline and ghost buttons, icons                                                                                                                             | Navy / muted                                                                          |
| Errors                                                                                                                                                                     | Destructive red, **always with a lucide icon** (`AlertTriangle`, `XCircle`, `Trash2`) |
| Logos                                                                                                                                                                      | Never tinted with theme colours (§7)                                                  |

- A second action on the same screen is `outline`. When in doubt, demote.
- `Badge` default is **blue**, not rose.
- Destructive buttons are `outline` + `text-destructive` everywhere except the confirm
  button inside a confirmation dialog, which is `variant="destructive"`.

---

## 4. Typography

Loaded with `next/font/google` in `src/app/layout.tsx`, self-hosted (CSP `font-src 'self'`),
variable fonts, normal style only:

| Role                                                | Font                           | Variable         | Tailwind       |
| --------------------------------------------------- | ------------------------------ | ---------------- | -------------- |
| UI and body                                         | Inter (`latin`, `latin-ext`)   | `--font-sans`    | `font-sans`    |
| Display (H1–H3, `.display`, card and dialog titles) | Plus Jakarta Sans              | `--font-display` | `font-display` |
| Code, keys, slugs, logs                             | JetBrains Mono (not preloaded) | `--font-mono`    | `font-mono`    |

Tailwind's default type scale, weights and tracking apply. There is no `font-serif`
stack any more (the guard test bans the class). `h1`–`h3` default to `font-display font-bold tracking-tight`; `h4`–`h6` to
`font-sans font-semibold`.

| Element              | Classes                                                                                      | Desktop   |
| -------------------- | -------------------------------------------------------------------------------------------- | --------- |
| Hero H1              | `font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]` | 60px      |
| Section H2           | `font-display text-3xl md:text-4xl font-bold tracking-tight`                                 | 36px      |
| H3 / card title      | `font-display text-xl font-semibold tracking-tight` (cards `text-lg`)                        | 20 / 18px |
| Dashboard page title | `font-display text-2xl font-bold tracking-tight`                                             | 24px      |
| Lead                 | `text-lg md:text-xl text-muted-foreground`                                                   | 20px      |
| Body                 | `text-base`                                                                                  | 16px      |
| UI / table           | `text-sm`                                                                                    | 14px      |
| Caption / terms      | `text-xs sm:text-sm text-muted-foreground`                                                   | 12–14px   |
| Eyebrow              | `.eyebrow` (12px, 600, 0.08em, uppercase, brand blue)                                        | 12px      |

- Weights: body 400, UI labels 500, buttons and table headers 600, headings 700–800.
- Numbers: `tabular-nums` for balances, tables and prices (tables, inputs, code and `<time>`
  get it by default).
- Body features `"cv11" 1, "ss01" 1`. Lucide icons use `stroke-width: 2`.
- No `italic` in class names except on `<em>`, quotes and blog prose.
- The Open Graph card (`src/app/opengraph-image.tsx`) cannot use `next/font`, so it reads
  static OFL TTFs from `src/app/fonts/`: `Inter-SemiBold.ttf` and
  `PlusJakartaSans-ExtraBold.ttf` (licences alongside). Nothing else lives there.

---

## 5. Radius, shadows, spacing, motion

| Radius                   | Value  | Where                                              |
| ------------------------ | ------ | -------------------------------------------------- |
| `rounded-none`           | 0      |                                                    |
| `rounded-sm`             | 6px    |                                                    |
| `rounded` / `rounded-md` | 8px    | Menu items, skeletons                              |
| `rounded-lg`             | 10px   | Buttons, inputs, tab triggers                      |
| `rounded-xl`             | 12px   | Tabs list, table frame, toasts, menus, `xl` button |
| `rounded-2xl`            | 16px   | Cards, dialogs                                     |
| `rounded-3xl`            | 24px   | Hero panels, offer band                            |
| `rounded-full`           | 9999px | Badges, pills, avatars                             |

Shadows are navy-tinted (`c = hsl(var(--shadow-color)`), black in dark mode:

| Key                        | Value                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `shadow-sm`                | `0 1px 2px 0 c / .06)`                                            |
| `shadow`                   | `0 1px 3px 0 c / .08), 0 1px 2px -1px c / .06)`                   |
| `shadow-md`                | `0 4px 12px -2px c / .08), 0 2px 4px -2px c / .05)`               |
| `shadow-lg`                | `0 12px 24px -6px c / .10), 0 4px 8px -4px c / .06)`              |
| `shadow-xl` / `shadow-2xl` | `0 24px 48px -12px c / .16)`                                      |
| `shadow-inner`             | `inset 0 1px 2px 0 c / .06)`                                      |
| `shadow-cta`               | `0 6px 16px -4px hsl(var(--primary) / .35)` (primary button only) |

Spacing uses Tailwind's 4px scale.

- Marketing container: `mx-auto max-w-6xl px-4 sm:px-6` (16px phone gutter is a
  requirement; `container` pads 1rem / 1.5rem / 2rem).
- Section rhythm `py-16 md:py-24`, alternating `bg-background` and `bg-surface-alt`.
- Card padding `--card-padding` (20px, 24px from `sm`); grid gaps `gap-4 md:gap-6`.
- Dashboard `main`: `max-w-6xl px-4 sm:px-6 py-6 md:py-8`, stacks `space-y-6 md:space-y-8`.
- Mobile: 375–390px with no horizontal page scroll; touch targets ≥ 40px; buttons
  `w-full` on phones where labels are long (FR).
- Motion: short colour/shadow transitions only. `prefers-reduced-motion: reduce` collapses
  every animation and transition globally (`globals.css`).

---

## 6. Component recipes (`src/components/ui/*`)

`components/ui` is owned by the foundation package; change requests go there instead of
local overrides.

**Button.** Base `rounded-lg border font-semibold`, 2px navy focus ring with offset,
`active:translate-y-px`, icons 16px.

| Variant       | Use                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `default`     | Rose primary with `shadow-cta`; hover `primary-hover`, pressed `primary-active`. One per viewport. |
| `outline`     | Secondary: white card, `border-input`, hover `bg-accent`.                                          |
| `secondary`   | Quiet fill `bg-secondary`, hover `bg-surface-band`.                                                |
| `ghost`       | Transparent, hover `bg-accent`.                                                                    |
| `link`        | Brand blue text, no padding, underline on hover.                                                   |
| `destructive` | Solid red. Only inside confirmation dialogs.                                                       |

Sizes: `sm` h-9, `default` h-10, `lg` h-12, `xl` h-14 `rounded-xl text-lg` (hero and
final CTA), `icon` 40×40.

**Card.** `rounded-2xl border bg-card shadow-sm`; `CardTitle` `font-display text-lg
font-semibold`; `CardDescription` plain muted `text-sm` (no italic). Recipes via
`className`: interactive `transition hover:border-input hover:shadow-md`; offer
`border-offer-border bg-offer`; selected `border-brand ring-1 ring-brand`.

**Badge.** Pill, `text-xs font-semibold`. `default` brand blue fill; `secondary`;
`outline`; `success` / `warning` / `info` / `destructive` / `brand` as `border-x/30
bg-x/10 text-x`; `offer` as `border-offer-border bg-offer text-offer-foreground` (the "unlocks with
first top-up" pill).

**Offer badge** (`components/marketing/offer-badge.tsx`). Pill with a lucide `Gift`,
`bg-offer text-offer-foreground border-offer-border`; `tone="solid"` (rose fill) for use on
the surface-band. Copy comes from the wallet facts (§8).

**Input / Textarea / Select.** White, `rounded-lg border-input`, `h-10`; focus
`border-brand` + 3px `ring-brand/25`; `aria-invalid="true"` turns the border red (always
with a message). Select list `rounded-xl shadow-lg`, items `rounded-md`, hover `bg-accent`.
`Label` is `text-sm font-medium`.

**Table.** Rounded white frame (`rounded-xl border`) that scrolls horizontally inside
itself; inside a `Card` the frame drops its own border. Header row `bg-surface-alt`,
`text-xs font-semibold uppercase tracking-wide`; cells `px-4 py-3 tabular-nums`; row hover
`bg-accent/40`, selected `bg-brand/5`. Frame styling via `containerClassName`.

**Tabs.** `TabsList` default is **segmented** (light-blue track, active trigger a white pill
with `shadow-sm`, scrolls when it overflows). `<TabsList variant="underline">` is the index
line with a brand-blue underline (server detail sections, settings on mobile).

**Dialog.** `rounded-2xl border bg-card shadow-xl`, overlay `bg-foreground/40` with a 2px
blur (page wash in dark mode); title `font-display text-xl font-bold`.

**Dropdown.** `rounded-xl shadow-lg`, items `rounded-md`, hover `bg-accent`.
**Accordion.** Hairline between items; trigger `py-4 font-semibold hover:text-brand`;
chevron rotates. **Separator.** 1px `bg-border`, horizontal or vertical. **Skeleton.** `rounded-md bg-secondary animate-pulse`. **Toasts
(sonner).** `rounded-xl border shadow-lg`; success / error / warning / info icons tinted
with the status token.

**Brand logo (TwinMCP).** A 28px `rounded-lg bg-foreground` square holding a white "T"
(Plus Jakarta 800) with a 6px `bg-primary` dot at the top right; wordmark "TwinMCP" in
`font-display font-extrabold tracking-tight`.

**Empty states.** `rounded-2xl border-2 border-dashed bg-card p-8 sm:p-10 text-center`, a
48px `bg-secondary text-brand` icon circle, a `font-display text-lg font-semibold` title,
one muted line, one primary button and an optional `link` button.

### Retired letterpress classes

The letterpress system (EB Garamond small caps, bone paper, radius 0) is gone, and so is its
compatibility layer: no `.smallcaps` / `.letterpress` / `.rule-double` / `.oldstyle` shims,
no `gilt` token or Badge variant, no `sc` / `eyebrow` tracking keys, no `shadow-stack` /
`shadow-press`, no `font-serif`, no `variant` prop on `Separator`. The guard test (§9) fails
on any of those class names. If you port old markup, translate it like this:

| Old                                                                           | New                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `smallcaps`, `tracking-sc`, `tracking-eyebrow`, `letterpress`, `no-smallcaps` | Remove                                                                  |
| `oldstyle`                                                                    | `tabular-nums` on numbers, otherwise remove                             |
| `italic` on descriptions, subtitles, leads                                    | Remove (keep on `<em>`, quotes, blog prose)                             |
| `border-foreground/{10–40}`                                                   | `border-border`                                                         |
| `border-foreground/{50–100}`                                                  | `border-input` (controls) or `border-border` (containers)               |
| `bg-foreground text-background` (selected chip or tab)                        | `bg-brand text-brand-foreground`                                        |
| `rule-double`, `rule-double-ink`                                              | `border-t border-border`                                                |
| eyebrow with `before:` / `after:` hairlines                                   | plain `eyebrow`                                                         |
| `shadow-stack`                                                                | `shadow-lg`                                                             |
| `text-gilt` / `bg-gilt/10` / `border-gilt/50`                                 | `text-offer-foreground` / `bg-offer` / `border-offer-border`            |
| `<Badge variant="gilt">`                                                      | `variant="offer"`                                                       |
| `font-serif`                                                                  | `font-sans` (body default) or `font-display` (headings)                 |
| Headings with `font-medium`                                                   | `font-display font-bold tracking-tight` (H1–H2) or `font-semibold` (H3) |
| `text-brand underline decoration-brand/40 …` links                            | `text-brand underline-offset-4 hover:underline`                         |

The one navy surface left on purpose is the Smithery announcement bar
(`bg-foreground text-background`); it holds white text links, never a rose button.

---

## 7. Logos and trademark rules

Third-party marks come from Simple Icons (pinned `simple-icons@16.35.0`, CC0 paths; Git is
CC-BY-3.0, credit Jason Long), generated once into `src/components/brand/logos.generated.ts`
by `scripts/build-brand-logos.ts` (no runtime CDN call) and rendered by
`<BrandLogo slug size mono />`. Callers fall back to their lucide icon when
`hasBrandLogo(slug)` is false.

- Never tint a logo with theme colours. Marks whose hex is `null` render `currentColor`
  and follow `text-foreground` (so they flip in dark mode). Claude marks stay Clay
  `#D97757` in both themes. ClickHouse and DuckDB are forced monochrome.
- Logos sit on `bg-card` tiles or the surface-band, never on rose. Unmodified: no lockups
  with the TwinMCP mark, no badges or overlays on the glyph.
- Placement is always "works with / connect to / available in the catalogue". No "built
  on" infrastructure band (Upstash, Supabase, Next.js, Hostinger).
- Stripe appears only on the billing page ("Payments secured by Stripe", linked to
  stripe.com), in slate, blurple or white.
- **Excluded:** GitHub (retired slug), VS Code / Excel / MarkItDown (Microsoft rules: VS
  Code is text only, never the Copilot icon in its place), Slack (until the media-kit
  asset is obtained), NASA, Revit, Airbnb, YouTube / `youtube-data`. Marks not in Simple
  Icons keep their fallback.
- Write "Cursor", never "Cursor AI". Windsurf black or white only. Zed `#1348DC`, black or
  white only.
- Every marketing and auth page carries the trademark line: "Logos are trademarks of their
  respective owners; their use does not imply endorsement." / "Les logos sont des marques
  de leurs propriétaires respectifs ; leur présence n’implique aucun partenariat."

---

## 8. Copy rules

- **Facts only from the helpers.** Every number in copy comes from `walletFacts()`,
  `SIGNUP_OFFER`, `FUNDED_UNLOCKS`, `TEN_EURO`, `PRICE_TABLE`
  (`components/pricing/wallet-copy.ts`) and `FREE_MCP_LIMIT`
  (`components/pricing/pricing-data.ts`). Never type "€10", "100,000" or "4" by hand in JSX;
  build template strings over those facts.
- **The offer terms line is mandatory** wherever the credit is promoted: 30 days, no card,
  no subscription, the server limit, the compute-heavy MCPs that wait for a top-up.
- No invented customers, testimonials, usage counts, certifications or hosting region.
  "EU company" only once `lib/legal/entity.ts` is filled in; "hosted in the EU" only once
  the VPS, Upstash Box and Supabase regions are all confirmed EU; "prices incl. VAT" only
  once the OSS VAT set-up is confirmed (until then: "Prices in euros").
- Marketing is EN at `/` and FR at `/fr`, one shared component per section with a
  `locale?: Locale` prop defaulting to `"en"`. Natural French with a narrow no-break space
  (U+202F) before `; : ! ? »`. The dashboard stays English.
- Keep every existing `data-cta-location`; new ones only where the redesign spec names them
  (`offer_band`, `sticky_mobile`, `home_trust`).
- Sentence case everywhere; no small caps, no ALL CAPS except the `.eyebrow` utility and
  table headers.

---

## 9. Guard tests

`src/__tests__/design-tokens.test.ts` fails the suite when UI code:

1. uses a raw Tailwind palette colour (`bg-rose-600`, `text-sky-50`, …);
2. uses an arbitrary colour value in a class name (`bg-[#C2255C]`, `text-[rgb(…)]`,
   `border-[hsl(…)]`). Files that legitimately hold hex constants (`components/brand/**`
   via the SVG `fill` attribute, `opengraph-image.tsx`, `lib/email-layout.ts`,
   `lib/admin/digest-email.ts`, `api-reference-client.tsx`) use attributes, inline styles
   or CSS strings, so the pattern does not match them;
3. uses a gradient or clipped text (`bg-gradient-to-*`, `bg-clip-text`);
4. uses a retired letterpress class (`smallcaps`, `no-smallcaps`, `tracking-sc`,
   `tracking-eyebrow`, `letterpress`, `rule-double(-ink)`, `oldstyle`, `shadow-stack`,
   `shadow-press`, `font-serif`, `text-/bg-/border-gilt…`), in `.ts`/`.tsx` and in every
   `.css` file under `src/`. `.eyebrow`, `.display` and `.lining` are real utilities and
   stay allowed.

`src/__tests__/brand-logos.test.ts` guards the logo allow-list and deny-list.

Per-file checklist before you return:

- [ ] tokens only: no palette classes, no arbitrary colours, no gradients
- [ ] one rose primary per viewport; extras demoted to `outline`
- [ ] no rose text below 24px on `surface-band`; no rose button on navy
- [ ] errors carry an icon; destructive buttons outline-only outside confirm dialogs
- [ ] letterpress classes removed per the migration table (§6)
- [ ] numbers from the wallet-copy / pricing helpers; offer terms line present
- [ ] light and dark both read correctly; 375–390px with no horizontal scroll
- [ ] behaviour, props, exports, i18n, SEO, analytics and a11y attributes untouched
