// reddit-drafts-mcp: finds Reddit threads where your product genuinely helps and
// helps YOU write honest replies. It never posts: there is no tool that writes to
// Reddit, on purpose. The human reads, edits and posts every reply themselves.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  checkDraft,
  cleanSubreddit,
  config,
  flattenComments,
  guidelines,
  mentionsBrand,
  normalizePost,
  parseThreadRef,
  promoHint,
  rankThread,
} from "./core.js";
import { createReddit, RedditError } from "./reddit.js";

const VERSION = "0.1.0";
const json = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const fail = (message) => ({ content: [{ type: "text", text: message }], isError: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const READ_REDDIT = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
const LOCAL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function buildServer({ env = process.env, fetchImpl } = {}) {
  const cfg = config(env);
  const reddit = createReddit(env, fetchImpl);
  const server = new McpServer({ name: "reddit-drafts", version: VERSION });

  const guard = (fn) => async (args) => {
    try {
      return await fn(args);
    } catch (e) {
      return fail(e instanceof RedditError ? e.message : `Unexpected error: ${e?.message ?? e}`);
    }
  };

  server.registerTool(
    "search_threads",
    {
      title: "Search Reddit threads",
      description: "Search Reddit posts by keyword, optionally inside given subreddits. Read-only.",
      inputSchema: {
        query: z.string().min(2).max(200).describe('Search terms, e.g. "smithery alternative"'),
        subreddits: z
          .array(z.string())
          .max(10)
          .optional()
          .describe("Limit to these subreddits (without r/)"),
        time: z.enum(["day", "week", "month", "year"]).default("week"),
        sort: z.enum(["new", "relevance", "comments", "top"]).default("new"),
        limit: z.number().int().min(1).max(50).default(15),
      },
      annotations: READ_REDDIT,
    },
    guard(async ({ query, subreddits, time, sort, limit }) => {
      const subs = (subreddits ?? []).map(cleanSubreddit).filter(Boolean);
      const now = Date.now();
      const results = [];
      for (const sub of subs.length ? subs : [undefined]) {
        const posts = await reddit.search({ query, subreddit: sub, sort, time, limit });
        results.push(...posts.map((p) => normalizePost(p, now)));
        if (subs.length > 1) await sleep(700);
      }
      return json({ mode: reddit.mode, count: results.length, threads: results });
    })
  );

  server.registerTool(
    "find_opportunities",
    {
      title: "Find threads worth a reply",
      description:
        "Run the configured keyword searches, drop locked/archived/old threads and threads that already mention the brand, and rank the rest by how welcome a helpful reply would be. Read-only.",
      inputSchema: {
        keywords: z
          .array(z.string().min(2))
          .max(12)
          .optional()
          .describe("Override the configured keywords"),
        subreddits: z
          .array(z.string())
          .max(10)
          .optional()
          .describe("Override the configured subreddits"),
        days: z.number().int().min(1).max(30).default(7),
        limit: z.number().int().min(1).max(30).default(10),
      },
      annotations: READ_REDDIT,
    },
    guard(async ({ keywords, subreddits, days, limit }) => {
      const kws = keywords?.length ? keywords : cfg.keywords;
      const subs = (subreddits?.length ? subreddits : cfg.subreddits)
        .map(cleanSubreddit)
        .filter(Boolean);
      const time = days <= 1 ? "day" : days <= 7 ? "week" : "month";
      const seen = new Map();
      const skipped = {};
      const now = Date.now();
      for (const kw of kws) {
        for (const sub of subs.length ? subs : [undefined]) {
          const posts = await reddit.search({
            query: kw,
            subreddit: sub,
            sort: "new",
            time,
            limit: 25,
          });
          for (const raw of posts) {
            if (seen.has(raw.id)) {
              seen.get(raw.id).matched.add(kw);
              continue;
            }
            const post = normalizePost(raw, now);
            const rank = rankThread(post, {
              brand: cfg.brand,
              brandUrl: cfg.brandUrl,
              maxAgeHours: days * 24,
            });
            if (rank.score === null) {
              for (const r of rank.reasons) skipped[r] = (skipped[r] ?? 0) + 1;
              seen.set(raw.id, { skip: true, matched: new Set([kw]) });
              continue;
            }
            seen.set(raw.id, { post, rank, matched: new Set([kw]) });
          }
          await sleep(700); // stay well under Reddit's rate limit
        }
      }
      const ranked = [...seen.values()]
        .filter((v) => !v.skip)
        .sort((a, b) => b.rank.score - a.rank.score || a.post.ageHours - b.post.ageHours)
        .slice(0, limit)
        .map((v) => ({
          ...v.post,
          text: v.post.text.slice(0, 400),
          relevance: v.rank.score,
          why: v.rank.reasons,
          matched: [...v.matched],
        }));
      return json({
        mode: reddit.mode,
        searched: { keywords: kws, subreddits: subs.length ? subs : "all of Reddit", days },
        opportunities: ranked,
        skipped,
        next: "Open the best ones with get_thread, check get_subreddit_rules, draft a reply per thread, then run check_draft.",
      });
    })
  );

  server.registerTool(
    "get_thread",
    {
      title: "Read a thread",
      description:
        "Read a Reddit post and its top comments, and flag whether the brand was already mentioned. Read-only.",
      inputSchema: {
        thread: z.string().describe("Thread URL, redd.it link, t3_ fullname or id"),
        comments: z.number().int().min(0).max(50).default(20),
      },
      annotations: READ_REDDIT,
    },
    guard(async ({ thread, comments }) => {
      const id = parseThreadRef(thread);
      if (!id) return fail(`Not a Reddit thread reference: ${thread}`);
      const { post, comments: listing } = await reddit.thread(id, {
        limit: Math.max(comments, 10),
      });
      const p = normalizePost(post);
      const cs = flattenComments(listing, comments);
      return json({
        ...p,
        alreadyMentioned: mentionsBrand(
          [p.title, p.text, ...cs.map((c) => c.text)],
          cfg.brand,
          cfg.brandUrl
        ),
        comments: cs,
      });
    })
  );

  server.registerTool(
    "get_subreddit_rules",
    {
      title: "Read a subreddit's rules",
      description:
        "Fetch a subreddit's rules and flag whether self-promotion looks restricted. Read-only.",
      inputSchema: { subreddit: z.string().describe("Subreddit name, without r/") },
      annotations: READ_REDDIT,
    },
    guard(async ({ subreddit }) => {
      const sub = cleanSubreddit(subreddit);
      if (!sub) return fail(`Not a subreddit name: ${subreddit}`);
      const rules = await reddit.rules(sub);
      return json({
        subreddit: sub,
        selfPromotion: promoHint(rules),
        rules: rules.map((r) => ({
          title: r.short_name,
          text: String(r.description ?? "").slice(0, 500),
        })),
        note: "selfPromotion is a keyword hint. Read the rules: when in doubt, reply without the product, or skip.",
      });
    })
  );

  server.registerTool(
    "reply_guidelines",
    {
      title: "Reply guidelines and product facts",
      description:
        "The rules every draft must follow and the only product facts a draft may state. Call this before drafting.",
      inputSchema: {},
      annotations: LOCAL,
    },
    async () => ({ content: [{ type: "text", text: guidelines(cfg) }] })
  );

  server.registerTool(
    "check_draft",
    {
      title: "Check a draft reply",
      description:
        "Lint a draft before the human posts it: disclosure when the brand is mentioned, answer-first, length, links, hype words, and similarity to the other drafts (repeated text is flagged as spam by Reddit).",
      inputSchema: {
        draft: z.string().max(5000),
        previous_drafts: z
          .array(z.string().max(5000))
          .max(30)
          .optional()
          .describe("The other drafts of this session"),
      },
      annotations: LOCAL,
    },
    async ({ draft, previous_drafts }) => json(checkDraft(draft, cfg, previous_drafts ?? []))
  );

  server.registerPrompt(
    "daily_review",
    {
      title: "Daily Reddit review",
      description:
        "Find this week's threads where a reply would genuinely help, and draft one reply per thread for me to review.",
      argsSchema: {
        focus: z.string().optional().describe('Optional topic, e.g. "Smithery migration"'),
      },
    },
    ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Run my Reddit review${focus ? ` about "${focus}"` : ""}.`,
              "1. Call reply_guidelines and follow it strictly.",
              "2. Call find_opportunities. Keep the 5 most relevant threads.",
              "3. For each: get_thread and get_subreddit_rules, then decide: reply with the product, reply without it, or skip (say why).",
              "4. Draft a reply written for that thread only, run check_draft (pass the other drafts as previous_drafts) and fix every error.",
              "5. Show me a table: thread link · what they need · decision · draft. Do not post anything: I post myself.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  return server;
}

export async function main() {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}
