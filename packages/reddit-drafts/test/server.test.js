// End-to-end over MCP: a real client talks to the server through an in-memory
// transport, with Reddit replaced by a fake fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";

const nowSec = Date.now() / 1000;
const post = (id, title, over = {}) => ({
  kind: "t3",
  data: {
    id,
    title,
    subreddit: "mcp",
    author: "u",
    permalink: `/r/mcp/comments/${id}/x/`,
    score: 3,
    num_comments: 2,
    created_utc: nowSec - 3600,
    selftext: "",
    ...over,
  },
});

function fakeFetch(calls) {
  return async (url) => {
    calls.push(String(url));
    const u = new URL(url);
    const body = u.pathname.includes("/search")
      ? {
          data: {
            children: [
              post("aaa111", "Smithery shut down, how do I host my MCP server?"),
              post("bbb222", "Old locked thread", { locked: true }),
              post("ccc333", "Anyone tried TwinMCP?"),
            ],
          },
        }
      : u.pathname.includes("/about/rules")
        ? { rules: [{ short_name: "No self-promotion", description: "Do not advertise." }] }
        : [
            {
              data: {
                children: [post("aaa111", "Smithery shut down, how do I host my MCP server?")],
              },
            },
            {
              data: {
                children: [
                  { kind: "t1", data: { author: "x", score: 2, body: "Following", replies: "" } },
                ],
              },
            },
          ];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

async function connect(env = {}) {
  const calls = [];
  const server = buildServer({ env, fetchImpl: fakeFetch(calls) });
  const client = new Client({ name: "test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, calls };
}
const parse = (res) => JSON.parse(res.content[0].text);

test("exposes six read-only tools and no tool that posts", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    "check_draft",
    "find_opportunities",
    "get_subreddit_rules",
    "get_thread",
    "reply_guidelines",
    "search_threads",
  ]);
  for (const t of tools) {
    assert.equal(t.annotations?.readOnlyHint, true, t.name);
    assert.doesNotMatch(t.name, /post|submit|comment|reply_to|vote|send/);
  }
  const { prompts } = await client.listPrompts();
  assert.deepEqual(
    prompts.map((p) => p.name),
    ["daily_review"]
  );
});

test("find_opportunities ranks, skips and dedupes", async () => {
  const { client, calls } = await connect({ DRAFTS_KEYWORDS: "smithery" });
  const out = parse(
    await client.callTool({ name: "find_opportunities", arguments: { days: 7, limit: 5 } })
  );
  assert.deepEqual(
    out.opportunities.map((o) => o.id),
    ["aaa111"]
  );
  assert.equal(out.skipped.locked, 1);
  assert.equal(out.skipped["already mentions the brand"], 1);
  assert.ok(calls.every((c) => c.startsWith("https://www.reddit.com/search.json")));
});

test("get_thread, get_subreddit_rules and check_draft", async () => {
  const { client } = await connect();
  const t = parse(
    await client.callTool({
      name: "get_thread",
      arguments: { thread: "https://www.reddit.com/r/mcp/comments/aaa111/x/" },
    })
  );
  assert.equal(t.id, "aaa111");
  assert.equal(t.comments.length, 1);
  assert.equal(t.alreadyMentioned, false);
  const r = parse(
    await client.callTool({ name: "get_subreddit_rules", arguments: { subreddit: "r/mcp" } })
  );
  assert.equal(r.selfPromotion, "restricted");
  const d = parse(
    await client.callTool({ name: "check_draft", arguments: { draft: "Use TwinMCP." } })
  );
  assert.equal(d.verdict, "fix");
  const bad = await client.callTool({ name: "get_thread", arguments: { thread: "nope nope" } });
  assert.equal(bad.isError, true);
});

test("uses the official OAuth API when credentials are set", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("access_token")) {
      assert.match(init.headers.Authorization, /^Basic /);
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
        status: 200,
      });
    }
    return fakeFetch([])(url);
  };
  const server = buildServer({
    env: { REDDIT_CLIENT_ID: "id", REDDIT_CLIENT_SECRET: "secret", REDDIT_USERNAME: "me" },
    fetchImpl,
  });
  const client = new Client({ name: "t", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const out = parse(
    await client.callTool({ name: "search_threads", arguments: { query: "smithery" } })
  );
  assert.match(out.mode, /oauth/);
  assert.ok(calls.some((c) => c.startsWith("https://oauth.reddit.com/search?")));
});
