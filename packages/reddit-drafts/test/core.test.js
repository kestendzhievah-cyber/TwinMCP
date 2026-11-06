import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkDraft,
  cleanSubreddit,
  config,
  flattenComments,
  guidelines,
  normalizePost,
  parseThreadRef,
  promoHint,
  rankThread,
  similarity,
} from "../src/core.js";

const cfg = config({});

test("parseThreadRef reads URLs, short links, fullnames and ids", () => {
  assert.equal(
    parseThreadRef("https://www.reddit.com/r/mcp/comments/1abcde/smithery_down/"),
    "1abcde"
  );
  assert.equal(parseThreadRef("https://redd.it/1xyz9q"), "1xyz9q");
  assert.equal(parseThreadRef("t3_1qwert"), "1qwert");
  assert.equal(parseThreadRef("1qwert"), "1qwert");
  assert.equal(parseThreadRef("not a thread at all"), null);
});

test("cleanSubreddit accepts r/name and rejects junk", () => {
  assert.equal(cleanSubreddit("r/ClaudeAI"), "ClaudeAI");
  assert.equal(cleanSubreddit("/r/mcp"), "mcp");
  assert.equal(cleanSubreddit("bad name!"), null);
});

const now = Date.UTC(2026, 10, 3, 12);
const raw = (over = {}) => ({
  id: "abc123",
  title: "Smithery shut down, what's the best alternative to host my MCP server?",
  subreddit: "mcp",
  author: "dev42",
  permalink: "/r/mcp/comments/abc123/x/",
  score: 5,
  num_comments: 3,
  created_utc: now / 1000 - 5 * 3600,
  selftext: "My hosted server stopped working. Looking for something to deploy it.",
  ...over,
});

test("rankThread rewards fresh questions with intent, skips the ones to avoid", () => {
  const r = rankThread(normalizePost(raw(), now), cfg);
  assert.ok(r.score >= 7, `score ${r.score}`);
  assert.ok(r.reasons.some((x) => x.startsWith("intent:")));
  for (const [over, reason] of [
    [{ locked: true }, "locked"],
    [{ archived: true }, "archived"],
    [{ over_18: true }, "nsfw"],
    [{ created_utc: now / 1000 - 10 * 86400 }, "too old"],
    [{ selftext: "Tried TwinMCP already" }, "already mentions the brand"],
  ]) {
    const s = rankThread(normalizePost(raw(over), now), cfg);
    assert.equal(s.score, null);
    assert.ok(s.reasons.includes(reason), reason);
  }
});

test("flattenComments keeps depth ≤ 2 and the limit", () => {
  const c = (body, replies) => ({
    kind: "t1",
    data: { author: "a", score: 1, body, replies: replies ? { data: { children: replies } } : "" },
  });
  const listing = {
    data: { children: [c("top", [c("child", [c("grand", [c("too deep")])])]), c("second")] },
  };
  const flat = flattenComments(listing, 10);
  assert.deepEqual(
    flat.map((x) => [x.text, x.depth]),
    [
      ["top", 0],
      ["child", 1],
      ["grand", 2],
      ["second", 0],
    ]
  );
  assert.equal(flattenComments(listing, 2).length, 2);
});

test("checkDraft requires a disclosure when the brand is mentioned", () => {
  const bad = checkDraft("Just use TwinMCP, it hosts any npm MCP server: twinmcp.fr", cfg);
  assert.equal(bad.verdict, "fix");
  assert.ok(bad.issues.some((i) => i.level === "error" && /disclosure/.test(i.message)));
  const good = checkDraft(
    "If it's an npm package, any host that runs stdio servers over HTTP will do; check it supports secrets per server. I'm the founder of TwinMCP, which does that: twinmcp.fr/migrate",
    cfg
  );
  assert.equal(good.verdict, "ok", JSON.stringify(good.issues));
});

test("checkDraft flags hype, links, caps, emojis, length and repeats", () => {
  const r = checkDraft(
    "I'm the founder of TwinMCP, the BEST and most amazing host 🚀🔥 https://a.com https://b.com",
    cfg
  );
  const msgs = r.issues.map((i) => i.message).join(" | ");
  assert.match(msgs, /Hype words/);
  assert.match(msgs, /2 links/);
  assert.match(msgs, /ALL CAPS/);
  assert.match(msgs, /emojis/);
  const long = checkDraft(Array.from({ length: 120 }, () => "word").join(" "), cfg);
  assert.match(long.issues[0].message, /120 words/);
  const a =
    "You can move it in a few minutes if the server is published on npm, paste the start command and add your API key as a secret.";
  const rep = checkDraft(a + " Hope that helps.", cfg, [a]);
  assert.equal(rep.verdict, "fix");
  assert.ok(similarity(a, a) === 1 && similarity(a, "totally different words here now") < 0.1);
});

test("promoHint spots restricted self-promotion", () => {
  assert.equal(
    promoHint([{ short_name: "No self-promotion", description: "Do not advertise your product." }]),
    "restricted"
  );
  assert.equal(
    promoHint([
      { short_name: "Self-promotion Saturdays", description: "Promotion allowed on Saturdays." },
    ]),
    "mentioned"
  );
  assert.equal(promoHint([{ short_name: "Be kind" }]), "not mentioned");
});

test("guidelines include the rules and the facts, and config is overridable", () => {
  const text = guidelines(cfg);
  assert.match(text, /You never post/);
  assert.match(text, /I'm the founder of TwinMCP/);
  assert.match(text, /€10 of free credit/);
  const c2 = config({
    DRAFTS_BRAND: "Acme",
    DRAFTS_KEYWORDS: "a b, c d",
    DRAFTS_FACTS: "Fact one\nFact two",
    DRAFTS_MAX_WORDS: "60",
  });
  assert.equal(c2.brand, "Acme");
  assert.deepEqual(c2.keywords, ["a b", "c d"]);
  assert.deepEqual(c2.facts, ["Fact one", "Fact two"]);
  assert.equal(c2.maxWords, 60);
  const other = config({ DRAFTS_BRAND: "Acme" });
  assert.deepEqual(other.facts, []);
  assert.match(guidelines(other), /No product facts are configured/);
  assert.doesNotMatch(guidelines(other), /€10/);
});
