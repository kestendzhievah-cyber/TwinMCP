# TwinMCP — SEO distribution playbook

Phase 4 of the SEO action plan. Phases 1–3 built the foundations (technical
SEO, schemas, content). This phase turns foundations into traffic.

**TL;DR.** Without backlinks and a launch push, Phase 3 content sits at page
20 of Google for 12 months. With them, the same content can crack page 1 in
4–8 weeks. Follow this playbook in order.

---

## 0 — Prerequisites (do these before any of the below)

- [ ] Deploy Phase 1–3 to production (`twinmcp.dev` resolves with all new pages)
- [ ] Verify Google Search Console (HTML tag method) → set `NEXT_PUBLIC_GSC_VERIFICATION`
- [ ] Verify Bing Webmaster Tools (import from GSC = 1 click) → set `NEXT_PUBLIC_BING_VERIFICATION`
- [ ] Submit sitemap in both GSC and Bing: `https://twinmcp.dev/sitemap.xml`
- [ ] Generate an IndexNow key (any GUID-like string, 8–128 chars) → set `INDEXNOW_KEY`
- [ ] Verify `https://twinmcp.dev/indexnow.txt` returns the key value
- [ ] Test rich results: paste `/`, `/plans`, `/blog/what-is-mcp`, `/use-cases/cursor-mcp-hosting` into <https://search.google.com/test/rich-results>
- [ ] OG preview check: paste each URL into <https://opengraph.xyz> — confirm dynamic OG image renders correctly
- [ ] Twitter card preview: <https://cards-dev.twitter.com/validator>
- [ ] Confirm `robots.txt` allows crawl: <https://twinmcp.dev/robots.txt>
- [ ] PageSpeed Insights ≥ 90 on mobile for `/` and `/plans`: <https://pagespeed.web.dev>

---

## 1 — Launch sequence (week by week)

Days are relative to **T = launch day** (the day you "Show HN").

### T−14 (two weeks out)

- [ ] Pre-warm the GitHub repo. Make sure the README has a clear value prop, a 30-second demo GIF, and a "Try it" CTA pointing at `twinmcp.dev`.
- [ ] Soft-launch on Twitter/X: post a 6-tweet thread (template §3.7) without asking for upvotes. Goal: warm up your audience so they show up on launch day.
- [ ] Reach out personally to 5–10 people likely to crosspost on launch day. No mass DMs. People who already follow MCP topics.

### T−7

- [ ] Schedule the Product Hunt post for T-day, 12:01 AM Pacific (resets the daily ranking). Use template §3.1.
- [ ] Pre-fill the maker comment on PH so it posts immediately when the listing goes live.
- [ ] Prepare 3 screenshots (1280×800) and 1 demo video (≤ 30s, MP4 or animated GIF) for PH and HN.
- [ ] Write the Hacker News post in draft form (template §3.2). Decide the title; HN is brutal to bad titles.

### T (launch day)

The order matters. Do them in this sequence, **not in parallel**:

1. **00:01 PT** — Product Hunt goes live (auto-scheduled). Reply to the first comment within 5 minutes. Stay reachable for 12 hours.
2. **06:00 PT** — Post "Show HN: TwinMCP – ..." on Hacker News. Title hygiene matters more than the body. Do not respond to comments until the post has been on the front page for 30 minutes — early replies can push the post off.
3. **09:00 PT** — Crosspost on Reddit (`r/LocalLLaMA` first, then `r/ClaudeAI`, then `r/cursor`). Don't do all three at once; space by 30 minutes. Template §3.6.
4. **10:00 PT** — Tweet/X thread with the launch announcement. Tag relevant people sparingly (no more than 3).
5. **12:00 PT** — Post the launch announcement on Dev.to and Hashnode with `canonical_url: https://twinmcp.dev/blog/what-is-mcp` (the pillar that fits the platform's audience best). See template §3.3 and §3.4.

### T+1 to T+7 (first week)

- [ ] Submit to the awesome-mcp lists (see §4). Each is a PR. Be patient — they take days to merge.
- [ ] Submit to 5–10 directories from §4. One sitting, ~20 minutes per directory.
- [ ] Monitor GSC daily: are the new pages getting impressions yet? If not by day 7, request indexing manually for the 3 pillars.
- [ ] Reply to every Twitter mention and every PH comment within 2 hours during business hours.

### T+14 to T+30

- [ ] Crosspost the 3 pillars to Medium with strict canonical (see §3.5). Wait until day 14 so Google has indexed the originals first.
- [ ] Pitch newsletter mentions (see §5). Personal email, not a press release.
- [ ] Repurpose pillar posts as Twitter/X threads (one thread per pillar, posted 2 weeks apart).

### T+60

- [ ] Run a backlink audit in Ahrefs or Semrush (free tier OK at this volume). What backlinks are you getting that you did not solicit? Those tell you what's resonating.
- [ ] Decide on Phase 3.e (more content) or wait for organic compounding. If organic traffic doubled month-over-month, double down on content. If flat, the content is not finding its audience — pivot to distribution.

---

## 2 — Key links you'll need handy

| Resource | URL |
|---|---|
| Production site | https://twinmcp.dev |
| Sitemap | https://twinmcp.dev/sitemap.xml |
| Blog index | https://twinmcp.dev/blog |
| Use cases index | https://twinmcp.dev/use-cases |
| Pillar 1 (what-is-mcp) | https://twinmcp.dev/blog/what-is-mcp |
| Pillar 2 (hosting) | https://twinmcp.dev/blog/mcp-server-hosting |
| Pillar 3 (tutorial) | https://twinmcp.dev/blog/build-mcp-server |
| GitHub repo | https://github.com/kestendzhievah-cyber/TwinMCP |
| Search Console | https://search.google.com/search-console |
| Bing Webmaster | https://www.bing.com/webmasters |
| IndexNow docs | https://www.indexnow.org/documentation |

---

## 3 — Ready-to-paste post templates

> **Editorial note.** All templates are starting points. Personalize them. Generic copy reads generic and people downvote it. The harder thing to fake is honesty about trade-offs — every template below leans into limitations. Keep that.

### 3.1 — Product Hunt

**Tagline (max 60 chars)**

```
Run your MCP servers without managing infra
```

**Description (~260 chars)**

```
TwinMCP runs your Model Context Protocol servers in isolated runtimes.
Pick a runtime, install MCPs from a curated marketplace, paste a snippet
into Cursor / Claude / Windsurf — done in 2 minutes. Free tier, no credit
card, secrets encrypted per-server.
```

**First maker comment (paste immediately on PH)**

```
Hey Product Hunt 👋 — I'm [your name], building TwinMCP.

I built this because every team I talked to was running MCP servers as
stdio child processes on each developer's laptop. That works for personal
tools but breaks the moment you want to share an MCP (secrets leak into
shell env, no central logs, restart Cursor and state is gone).

TwinMCP gives each MCP server its own isolated Upstash Box sandbox with
encrypted secrets, a per-user API key, and a config snippet that pastes
straight into your IDE. Free tier covers one server + the full marketplace
(GitHub, Notion, Slack, Postgres, Linear, etc.).

What it's NOT:
- Not a fancy LangChain alternative — TwinMCP is the runtime, not the agent
- Not an open-source self-host (yet — on the roadmap)
- Not faster than Cloudflare Workers at the edge (we use micro-VMs, ~200ms
  cold start). The trade-off buys us full Node compatibility.

Roadmap, pricing, and what's missing — happy to discuss. AMA in the comments.
```

### 3.2 — Hacker News "Show HN"

**Title (use exactly this format, no exclamation marks, no marketing language)**

```
Show HN: TwinMCP – managed runtime for Model Context Protocol servers
```

**Body**

```
Hey HN. I've been building TwinMCP for the last 6 months. It's a managed
runtime for MCP servers — you point it at a package or repo, fill in
install/start commands, and you get an isolated sandbox per server with
encrypted secrets and a config snippet ready for Cursor / Claude / Windsurf.

The motivation: MCP took off in 2025 but the default deployment pattern
(stdio child process on each laptop) doesn't survive contact with teams.
Sharing an MCP across developers means everyone re-installs it, secrets
leak into shell env, no central logs, no audit trail. HTTP transport
solves this in principle but you're back to managing containers, TLS,
isolation between servers, secret rotation.

We use Upstash Box (Firecracker micro-VMs) under the hood, so cold start
is ~200ms vs Cloudflare Workers' ~10ms — but we get full Node/Python/Go/
Ruby/Rust compatibility (any npm package, native modules, sub-processes,
filesystem). It's an honest trade-off.

What's there:
- Free tier with 1 server + the full marketplace (no card)
- Pro/Team for more servers + audit logs + team sharing
- All servers isolated, secrets encrypted at rest, per-user API keys

What's NOT there yet:
- Self-host (control plane is open-source-ready, orchestration is coupled
  to Box currently)
- Custom Docker images (limited to pre-installed runtimes)
- SSO/SAML on Pro (Team only)

Happy to answer questions, especially the awkward ones about pricing,
lock-in, or the comparison with Smithery / serverless / DIY Kubernetes.

Site: https://twinmcp.dev
Pillar post on what MCP actually is, if you're new to it:
https://twinmcp.dev/blog/what-is-mcp
```

**Tone rules on HN:**

- No exclamation marks anywhere.
- No "🚀", no emojis at all.
- Reply to critics first, supporters second.
- If someone says "you're a Smithery clone," acknowledge the overlap and explain the actual differentiator (private MCPs, per-user sandboxes).
- Never delete a comment, even a harsh one.

### 3.3 — Dev.to (crosspost pillar #1)

**Frontmatter**

```yaml
---
title: "What is Model Context Protocol? The complete 2026 guide"
published: true
description: "MCP explained from scratch — what it is, why Anthropic built it, how it actually works, and what you can do with it today."
tags: ai, mcp, anthropic, tutorial
canonical_url: https://twinmcp.dev/blog/what-is-mcp
cover_image: https://twinmcp.dev/blog/what-is-mcp/opengraph-image
---
```

**Body adaptation rules**

- Copy the article body verbatim from `app/blog/what-is-mcp/page.tsx` but convert JSX to Markdown.
- Replace internal Next links with absolute `https://twinmcp.dev/...` URLs.
- Add a top callout: `> Originally published at [twinmcp.dev](https://twinmcp.dev/blog/what-is-mcp).`
- At the end, add: `If you want to skip running MCP servers locally, [TwinMCP](https://twinmcp.dev) hosts them for you.`

### 3.4 — Hashnode (crosspost pillar #3)

Hashnode is heavier on tutorials. Crosspost **build-mcp-server** here.

```yaml
---
title: "How to build a Model Context Protocol server (step-by-step)"
canonicalUrl: https://twinmcp.dev/blog/build-mcp-server
slug: build-mcp-server-tutorial
tags: mcp, typescript, anthropic, tutorial, ai
---
```

Body identical to the Dev.to rules — Markdown body, canonical strict.

### 3.5 — Medium (crosspost pillar #2)

Medium is the lowest-trust crosspost target (their algorithm hides canonical-tagged content) but worth doing for backlink-from-aged-domain SEO value.

- Crosspost **mcp-server-hosting** to Medium.
- Use Medium's "Import a story" feature with the canonical URL — it preserves canonical tags reliably.
- Add a manual top line: `_Originally published at [twinmcp.dev](https://twinmcp.dev/blog/mcp-server-hosting)._`
- Do not paywall the story.

### 3.6 — Reddit

Reddit takes 3 separate posts. Don't crosspost the same URL to all three; rewrite the title for each subreddit's culture.

**`r/LocalLLaMA`** — accept the gravity is more model-than-product.

```
Title: TwinMCP — managed runtime for MCP servers (full Node compat, micro-VMs)

I've been building TwinMCP, a hosted runtime for Model Context Protocol
servers. Each MCP runs in its own Upstash Box sandbox (Firecracker), gets a
per-user API key, and surfaces a config snippet for Cursor / Claude /
Windsurf / Cline.

Trade-off vs serverless options like Cloudflare Workers: we get full Node /
Python / Go / Ruby / Rust compatibility (any npm package, native modules,
sub-processes) at the cost of ~200ms cold start instead of ~10ms.

Free tier is 1 server + the full marketplace. AMA — especially interested
in feedback on the comparison with Smithery and DIY hosting.

https://twinmcp.dev
```

**`r/ClaudeAI`**

```
Title: Run hosted MCP servers in Claude Desktop & Claude Code without
       laptop secrets

If you've been adding MCP servers to claude_desktop_config.json with API
tokens in the env block, you might want to look at TwinMCP. We host the
MCPs server-side, encrypt secrets at rest, and give you a URL + bearer
token to paste into Claude.

Works with Claude Desktop and Claude Code (and Cursor, Windsurf, Cline).
Free tier covers 1 server + the marketplace, no card.

Full guide: https://twinmcp.dev/use-cases/claude-mcp-hosting
```

**`r/cursor`**

```
Title: Hosted MCP servers for Cursor — no Docker, no laptop tokens

Sharing TwinMCP — managed MCP runtime that drops cleanly into Cursor's
mcp.json. Pick a server from the marketplace (GitHub, Postgres, Notion,
Slack, etc.), paste the URL + token from the dashboard, you're done in 2
minutes.

Specifically built to fix the "MCP server holds my GitHub token in shell
env" problem — secrets live encrypted server-side instead.

Free tier (1 server) is the easiest way to try it:
https://twinmcp.dev/use-cases/cursor-mcp-hosting
```

**Reddit rules of engagement:**

- Don't submit to more than 2 subreddits in the same hour (auto-spam filter).
- Don't include affiliate or UTM tags in Reddit URLs — instant downvote.
- Reply to every comment within 4 hours for the first 24 hours.
- If a mod removes your post, message them politely once, don't repost.

### 3.7 — Twitter / X launch thread

Six tweets, no thread tail begging for RTs.

```
1/ I'm launching TwinMCP today — a managed runtime for Model Context
   Protocol servers. Thread on what it does and the trade-offs.

2/ Today, most MCP servers run as stdio child processes on each
   developer's laptop. That works for personal tools but breaks when
   teams want to share an MCP — secrets leak into shell env, no
   central logs, restart your IDE and state is gone.

3/ TwinMCP gives each MCP server its own isolated Upstash Box sandbox
   (Firecracker micro-VM) with encrypted secrets and a per-user API
   key. The dashboard shows a config snippet you paste into Cursor /
   Claude Desktop / Windsurf / Cline.

4/ Trade-off vs Cloudflare Workers: we have ~200ms cold start instead
   of ~10ms. The win is full Node / Python / Go / Ruby / Rust
   compatibility — every npm package, native modules, sub-processes,
   filesystem. Workers can't do any of that.

5/ Free tier: 1 server + the full marketplace, no credit card. Pro
   $20/mo gets you 25 servers + audit logs. Team $50/mo for sharing.
   Pricing page: https://twinmcp.dev/plans

6/ Repo: https://github.com/kestendzhievah-cyber/TwinMCP
   Site:  https://twinmcp.dev
   Pillar guide on what MCP actually is:
   https://twinmcp.dev/blog/what-is-mcp
```

### 3.8 — LinkedIn (single post, not a thread)

LinkedIn is low-traffic for developer tools but high-traffic for B2B leads.

```
Spent the last 6 months building TwinMCP — a managed runtime for Model
Context Protocol (MCP) servers.

Today, most teams run MCP servers as child processes on every developer's
laptop. That works for personal tools but doesn't scale: secrets leak into
shell env, there's no central log, and you have to convince every
teammate to install the same thing.

TwinMCP gives each MCP its own sandbox with encrypted secrets and a stable
URL. You get a config snippet to paste into Cursor / Claude / Windsurf,
and the same hosted MCP works across all of them.

If your team is building AI agents on top of Claude or Cursor and you've
hit the "where do we actually run these MCP servers" wall — would love
your feedback: https://twinmcp.dev

Comments and DMs open.
```

---

## 4 — Backlink targets (tier-1 first)

PR or submission targets, in priority order. Tier 1 = highest authority + most relevant. Tier 2 = useful but lower priority. Tier 3 = volume play.

### Tier 1 — MCP-specific catalogs (PRs to open in week 1)

| Target | URL | What to add |
|---|---|---|
| modelcontextprotocol.io catalog | https://github.com/modelcontextprotocol/servers (README) | TwinMCP under "Hosting Providers" |
| awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers | TwinMCP under "Hosting Platforms" or similar |
| awesome-mcp (jpedraza-isart) | https://github.com/jpedraza-isart/awesome-mcp | Same |
| MCP Hub directory | https://mcphub.io (or similar aggregator) | Submit your hosted MCPs |
| Smithery catalog | https://smithery.ai | Even though competitor — submit our public MCPs |

For each: open a PR with a clean diff. Title format: `Add TwinMCP — managed MCP runtime`. Include a 1-line value prop and the canonical URL.

### Tier 1 — Anthropic ecosystem

| Target | Path |
|---|---|
| Claude Desktop docs | Anthropic discord — community contributions channel |
| MCP discussions | https://github.com/orgs/modelcontextprotocol/discussions — open a "Show & Tell" |

### Tier 2 — Developer tool directories

| Target | URL |
|---|---|
| AlternativeTo | https://alternativeto.net — submit as alt to "Smithery" |
| StackShare | https://stackshare.io |
| Slant.co | https://www.slant.co — "Best MCP hosting" question if doesn't exist, create it |
| BetaList | https://betalist.com |
| SaaSHub | https://www.saashub.com |
| Product Hunt collections | After PH launch, get added to "Developer Tools 2026" collection |

### Tier 2 — AI/dev newsletters (cold pitch, personalized)

| Newsletter | Editor's contact |
|---|---|
| TLDR AI | Submit via https://tldr.tech/ai/submit |
| AlphaSignal | https://alphasignal.ai (submission link in footer) |
| Ben's Bites | https://www.bensbites.com (newsletter pitch form) |
| The Rundown AI | https://www.therundown.ai |
| Latent.Space | Pitch via Twitter to @swyx with a one-liner |
| Pragmatic Engineer | Subscriber recommendations section |
| Bytes (JavaScript) | https://bytes.dev — only relevant if MCP/JS angle |

Cold pitch template (one paragraph max — never longer):

```
Subject: [TwinMCP] managed runtime for MCP servers — possible fit?

Hi [name],

Quick one: I'm building TwinMCP, a managed runtime for Model Context
Protocol servers (the protocol Anthropic released for AI tool use).
Solves the "where do MCP servers actually run when shared across a team"
problem — sandboxes per server, encrypted secrets, drops into Cursor /
Claude in 2 minutes.

If it's a fit for [newsletter name]'s audience, happy to send a draft
brief or jump on a call. No pressure if not.

[your name] · https://twinmcp.dev
```

### Tier 3 — Volume directories (set aside 1 hour, do them all in one sitting)

- https://www.indiehackers.com (submit product)
- https://www.tinylaunch.com
- https://www.uneed.best
- https://www.startupbase.io
- https://www.startupranking.com
- https://www.saasworthy.com
- https://capterra.com (longer review, only if positioning B2B)
- https://g2.com (same)

Most return only nofollow links, but they help with brand search ("twinmcp") which signals to Google that the brand is real.

### Tier 3 — GitHub presence (passive backlinks)

- [ ] Add a "Built on top of MCP" badge to TwinMCP's own repo README, linking to modelcontextprotocol.io
- [ ] Star and watch the 20 most popular MCP repositories — your account becomes visible to their watchers
- [ ] Contribute one substantive PR to the MCP spec repo or to an official SDK — even a typo fix gives you a profile link from the contributor list

---

## 5 — Post-launch monitoring (what to actually watch)

### Daily for first 14 days

- **GSC → Performance**: impressions per query, click-through rate. The first signal of "Google noticed us" is impressions on long-tail queries you didn't optimize for.
- **GSC → Coverage**: any page showing "Discovered – not indexed"? Request indexing manually.
- **PostHog funnel** (already configured): landing → signup → first server. Distribution traffic from HN/Reddit converts very differently from organic — if signup rate is below 2%, the landing page is failing the traffic.

### Weekly for first 90 days

- **Total indexed pages** (GSC URL inspection on 4–5 sample URLs)
- **Backlinks discovered** (Ahrefs free tier or `ahrefs.com/backlink-checker`)
- **Brand search volume** ("twinmcp" in GSC — should grow weekly if launch worked)
- **Top 10 queries by impressions** — these tell you what content to write next

### Alerts to set up

- GSC: enable email alerts for critical issues (manual actions, security issues)
- PostHog: alert if signups drop below baseline for 24h
- Sentry (already wired): alert on 5xx error rate above 1%

---

## 6 — When something works, double down

The mistake people make at month 2 is treating the launch as a single event. The actual playbook:

1. Identify the **top-traffic blog post** at day 30.
2. Write **2 more posts on adjacent topics** within 2 weeks.
3. Update the original with the new internal links.
4. Repeat monthly.

The compounding works because Google rewards topical authority. If your "Cursor MCP setup" post ranks at position 6, three more posts about Cursor + MCP push the entire cluster up — not just the new posts.

The mistake people make at month 6 is writing more pillar content when supporting content is what's missing. Check GSC: which queries are bringing impressions but not clicks? Those are your next titles.

---

## 7 — Things to NOT do

- **Don't buy backlinks.** Detected by Google, leads to manual actions, kills 6 months of work. Worth zero.
- **Don't write thin programmatic pages without distinct content.** 200 "MCP for X" pages with the same boilerplate is the textbook "thin content" pattern Google penalizes since the 2024 helpful-content update.
- **Don't crosspost to Medium with no canonical.** Medium will outrank your original because of domain authority.
- **Don't tag everyone you know on launch day.** Mod removals on Reddit and HN downvotes hurt more than the upvotes help.
- **Don't update the publishedAt date on a post just to bump it.** Google reads dateModified separately. Update real content; leave the publication date alone.
- **Don't run paid ads on the launch.** First 30 days should be 100% organic so you can read the signal cleanly. Add paid only after you know what converts.

---

## 8 — Quick reference: what every new post needs

When you publish blog post #13 (and #14, and #15), this checklist takes 5 minutes:

1. Add entry to `src/lib/blog/posts.ts`
2. Create `app/blog/<slug>/page.tsx` using PostLayout
3. Internal links: 2+ links to existing related posts, 1+ link to /plans or /sign-up
4. Schemas: Article + BreadcrumbList come for free, add FAQPage if there are 3+ Q&As
5. Deploy
6. Request indexing in GSC (URL Inspection → Request indexing)
7. Call `submitUrls([url])` for IndexNow (Bing/Yandex notified within minutes)
8. Tweet/X thread the same day
9. If it's a substantive post, crosspost to Dev.to or Hashnode after 48h with canonical

If you skip steps 6–7, the post takes 1–4 weeks to get indexed instead of 1–4 hours.
