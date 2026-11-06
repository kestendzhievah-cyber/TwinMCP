// Pure logic of reddit-drafts-mcp: no network, no MCP. Unit-tested in test/core.test.js.
//
// The server never posts. Everything here exists to help a HUMAN decide where a
// reply is genuinely useful and to keep their drafts honest (disclosure, answer
// first, no copy-paste), which is also what keeps an account out of Reddit's
// spam filters.

export const DEFAULT_KEYWORDS = [
  "smithery",
  "mcp hosting",
  "host mcp server",
  "deploy mcp server",
  "remote mcp server",
  "mcp server chatgpt",
];

/** Product facts the drafts may use. Override with DRAFTS_FACTS (one fact per line). */
export const DEFAULT_FACTS = [
  "TwinMCP hosts MCP servers: 70+ ready-made MCPs (Notion, Slack, Stripe, Airtable, Postgres…) or your own npm / PyPI package.",
  "Each server runs in its own isolated sandbox, behind one URL for ChatGPT, Claude, Cursor, VS Code, Windsurf, Cline and Zed.",
  "Claude and ChatGPT connect with OAuth (paste the URL, sign in); other clients use a scoped API key that can only call that server's MCPs.",
  "Per-tool access control (all, read-only or allow-list), enforced by the proxy. Secrets encrypted (AES-256-GCM). Every tool call logged, metadata only.",
  "New accounts get €10 of free credit, no card, valid 30 days. Prepaid, no subscription, stops at zero.",
  "Publishing your OWN package (not in the catalogue) unlocks with a first €10 top-up.",
  "Smithery migration assistant: twinmcp.fr/migrate (paste the Smithery URL or name, get the exact steps).",
  "No SOC 2 / ISO 27001, no uptime SLA, no data-region choice yet. Say so if asked.",
];

export function config(env = process.env) {
  const list = (v) =>
    v
      ? v
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
  const brand = env.DRAFTS_BRAND?.trim() || "TwinMCP";
  // The default facts describe TwinMCP: another brand without DRAFTS_FACTS gets
  // none, so a draft can never state TwinMCP's facts about someone else's product.
  const defaultFacts = brand.toLowerCase() === "twinmcp" ? DEFAULT_FACTS : [];
  return {
    brand,
    brandUrl: env.DRAFTS_BRAND_URL?.trim() || "twinmcp.fr",
    keywords: list(env.DRAFTS_KEYWORDS) ?? DEFAULT_KEYWORDS,
    subreddits: list(env.DRAFTS_SUBREDDITS) ?? [],
    facts: env.DRAFTS_FACTS
      ? env.DRAFTS_FACTS.split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : defaultFacts,
    maxWords: Number.parseInt(env.DRAFTS_MAX_WORDS ?? "", 10) || 80,
  };
}

// ─── Reddit references ───────────────────────────────────────────────────────

/** A thread id from a URL (reddit.com/r/x/comments/ID/…, redd.it/ID), a fullname (t3_ID) or a bare id. */
export function parseThreadRef(ref) {
  const s = String(ref ?? "").trim();
  const m =
    /reddit\.com\/(?:r\/[^/]+\/)?comments\/([a-z0-9]+)/i.exec(s) ??
    /redd\.it\/([a-z0-9]+)/i.exec(s) ??
    /^t3_([a-z0-9]+)$/i.exec(s) ??
    /^([a-z0-9]{4,10})$/i.exec(s);
  return m ? m[1].toLowerCase() : null;
}

export function cleanSubreddit(name) {
  const s = String(name ?? "")
    .trim()
    .replace(/^\/?r\//i, "");
  return /^[A-Za-z0-9_]{2,21}$/.test(s) ? s : null;
}

// ─── Normalising API objects ─────────────────────────────────────────────────

const clip = (s, n) => {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function normalizePost(d, now = Date.now()) {
  return {
    id: d.id,
    title: d.title,
    subreddit: d.subreddit,
    author: d.author,
    url: `https://www.reddit.com${d.permalink}`,
    score: d.score ?? 0,
    numComments: d.num_comments ?? 0,
    ageHours: Math.max(0, Math.round((now / 1000 - (d.created_utc ?? 0)) / 3600)),
    text: clip(d.selftext, 1500),
    locked: Boolean(d.locked),
    archived: Boolean(d.archived),
    nsfw: Boolean(d.over_18),
  };
}

/** Comments listing → flat list (depth ≤ 2), best first as Reddit returned them. */
export function flattenComments(listing, max = 20) {
  const out = [];
  const walk = (children, depth) => {
    for (const c of children ?? []) {
      if (out.length >= max) return;
      if (c.kind !== "t1" || !c.data) continue;
      const d = c.data;
      out.push({ author: d.author, score: d.score ?? 0, depth, text: clip(d.body, 600) });
      if (depth < 2 && d.replies && typeof d.replies === "object")
        walk(d.replies.data?.children, depth + 1);
    }
  };
  walk(listing?.data?.children, 0);
  return out;
}

export function mentionsBrand(texts, brand, brandUrl) {
  const needles = [brand, brandUrl].filter(Boolean).map((s) => s.toLowerCase());
  return texts.some((t) =>
    needles.some((n) =>
      String(t ?? "")
        .toLowerCase()
        .includes(n)
    )
  );
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

const INTENT =
  /\b(alternative|alternatives|migrat\w*|shut(?:ting)? down|shutdown|replace\w*|host(?:ing|ed)?|deploy\w*|recommend\w*|looking for|stopped working|no longer works|self[- ]host\w*)\b/gi;
const QUESTION_START = /^(how|what|which|where|is|are|can|does|do|any|anyone|best|should|why)\b/i;

/** Score a thread for "a helpful reply is welcome here". Returns null when it should be skipped. */
export function rankThread(post, { brand, brandUrl, maxAgeHours = 24 * 7 } = {}) {
  const skip = [];
  if (post.locked) skip.push("locked");
  if (post.archived) skip.push("archived");
  if (post.nsfw) skip.push("nsfw");
  if (post.ageHours > maxAgeHours) skip.push("too old");
  if (mentionsBrand([post.title, post.text], brand, brandUrl))
    skip.push("already mentions the brand");
  if (skip.length) return { score: null, reasons: skip };

  let score = 0;
  const reasons = [];
  if (post.ageHours <= 24) ((score += 3), reasons.push("posted < 24 h ago"));
  else if (post.ageHours <= 72) ((score += 2), reasons.push("posted < 3 days ago"));
  else ((score += 1), reasons.push("posted this week"));

  const title = post.title ?? "";
  if (title.includes("?") || QUESTION_START.test(title.trim()))
    ((score += 2), reasons.push("asks a question"));

  const intents = new Set(`${title} ${post.text ?? ""}`.toLowerCase().match(INTENT) ?? []);
  if (intents.size) {
    score += Math.min(3, intents.size);
    reasons.push(`intent: ${[...intents].slice(0, 3).join(", ")}`);
  }

  if (post.numComments === 0) ((score += 1), reasons.push("no answer yet"));
  else if (post.numComments <= 30)
    ((score += 1), reasons.push(`${post.numComments} comments (room to help)`));
  else reasons.push(`${post.numComments} comments (crowded)`);

  if (post.score < 0) ((score -= 1), reasons.push("downvoted"));
  return { score, reasons };
}

// ─── Drafting rules and the draft checker ────────────────────────────────────

export function guidelines(cfg) {
  return [
    `You draft Reddit replies for a human, who reviews and posts them. You never post.`,
    ``,
    `Rules:`,
    `1. Answer the person's actual question first, specifically for their case. If ${cfg.brand} does not genuinely solve it, give a useful answer that does not mention ${cfg.brand}, or say the thread should be skipped.`,
    `2. Mention ${cfg.brand} at most once, with a disclosure ("I'm the founder of ${cfg.brand}" or "I work on ${cfg.brand}"). Never pretend to be a neutral user.`,
    `3. At most one link, and only when it helps (e.g. ${cfg.brandUrl}).`,
    `4. Under ${cfg.maxWords} words, plain and friendly, match the thread's tone and language. No hype words, no ALL CAPS, at most one emoji.`,
    `5. Never reuse the same wording across threads: every reply must be written for that thread.`,
    `6. Respect the subreddit's rules (call get_subreddit_rules). If self-promotion is banned, draft a reply without the product, or skip.`,
    `7. Only state facts from the list below. If unsure, leave it out.`,
    ``,
    ...(cfg.facts.length
      ? [`Facts you may use:`, ...cfg.facts.map((f) => `- ${f}`)]
      : [
          `No product facts are configured (set DRAFTS_FACTS, one per line). Until then, state no fact about ${cfg.brand} beyond its name.`,
        ]),
    ``,
    `Before showing a draft, run check_draft on it and fix every "error".`,
  ].join("\n");
}

const HYPE =
  /\b(best|#1|number one|revolutionary|game[- ]?changer|guaranteed|100%|amazing|incredible|unbeatable|insane)\b/gi;
const DISCLOSURE =
  /\b(i'?m|i am|i work|i built|i made|we built|founder|co-?founder|disclosure|full disclosure|je suis|fondateur|j'ai créé)\b/i;
const URL_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:fr|com|io|dev|ai|app|net|org)(?:\/\S*)?/gi;

function shingles(text) {
  const w = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 2 < w.length; i++) set.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return set;
}

export function similarity(a, b) {
  const A = shingles(a),
    B = shingles(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Lint a draft. `error` = must fix before posting; `warning` = worth a look. */
export function checkDraft(draft, cfg, previous = []) {
  const text = String(draft ?? "").trim();
  const issues = [];
  const add = (level, message) => issues.push({ level, message });
  if (!text)
    return {
      verdict: "fix",
      words: 0,
      issues: [{ level: "error", message: "The draft is empty." }],
    };

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > cfg.maxWords) add("warning", `${words} words: aim for ${cfg.maxWords} or fewer.`);

  const brandHit = mentionsBrand([text], cfg.brand, cfg.brandUrl);
  if (brandHit && !DISCLOSURE.test(text)) {
    add(
      "error",
      `It mentions ${cfg.brand} without a disclosure. Add "I'm the founder of ${cfg.brand}" (or similar).`
    );
  }
  if (brandHit) {
    const first = text.split(/(?<=[.!?])\s+/)[0] ?? "";
    if (mentionsBrand([first], cfg.brand, cfg.brandUrl) && words > 25) {
      add(
        "warning",
        `It opens with ${cfg.brand}. Answer the question first, mention the product after.`
      );
    }
    const mentions = (
      text
        .toLowerCase()
        .match(new RegExp(cfg.brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ??
      []
    ).length;
    if (mentions > 2) add("warning", `${cfg.brand} appears ${mentions} times: once is enough.`);
  }

  const links = text.match(URL_RE) ?? [];
  if (links.length > 1) add("warning", `${links.length} links: keep one at most.`);

  const hype = [...new Set((text.match(HYPE) ?? []).map((h) => h.toLowerCase()))];
  if (hype.length) add("warning", `Hype words read as an ad: ${hype.join(", ")}.`);

  const caps =
    text
      .match(/\b[A-Z]{4,}\b/g)
      ?.filter(
        (w) => !/^(HTTP|HTTPS|JSON|YAML|OAUTH|SOC|ISO|URL|API|NPM|PYPI|MCP|SDK|CLI|VPS)$/.test(w)
      ) ?? [];
  if (caps.length) add("warning", `ALL CAPS words: ${caps.slice(0, 3).join(", ")}.`);

  const emojis = text.match(/\p{Extended_Pictographic}/gu) ?? [];
  if (emojis.length > 1) add("warning", `${emojis.length} emojis: one at most.`);

  for (const p of previous) {
    const sim = similarity(text, p);
    if (sim >= 0.35) {
      add(
        "error",
        `Too close to another draft (${Math.round(sim * 100)}% overlap). Reddit flags repeated text as spam: rewrite it for this thread.`
      );
      break;
    }
  }

  return { verdict: issues.some((i) => i.level === "error") ? "fix" : "ok", words, issues };
}

/** Does a subreddit's rules text restrict self-promotion? (a hint, the human decides) */
export function promoHint(rules) {
  const text = rules
    .map((r) => `${r.short_name ?? ""} ${r.description ?? ""}`)
    .join(" \n ")
    .toLowerCase();
  if (
    /\b(no|don'?t|do not|never)\b[^.\n]{0,40}\b(self[- ]?promo\w*|promotion|advertis\w*|spam|marketing)\b/.test(
      text
    )
  )
    return "restricted";
  if (/\b(self[- ]?promo\w*|promotion|advertis\w*)\b/.test(text)) return "mentioned";
  return "not mentioned";
}
