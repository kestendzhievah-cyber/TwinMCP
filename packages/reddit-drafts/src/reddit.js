// Read-only Reddit client. Two modes:
//   - application-only OAuth (REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET): Reddit's
//     official read-only grant. Use this: Reddit refuses most anonymous requests
//     (HTTP 403), including from home connections as of November 2026;
//   - anonymous public JSON (no credentials): a fallback that may be refused.
// There is deliberately no method that writes (no submit, comment, vote, message).

const UA_DEFAULT = "node:twinmcp-reddit-drafts:0.1.0 (read-only drafts assistant)";

export class RedditError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function createReddit(env = process.env, fetchImpl = globalThis.fetch) {
  const clientId = env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = env.REDDIT_CLIENT_SECRET?.trim();
  const username = env.REDDIT_USERNAME?.trim();
  const userAgent =
    env.REDDIT_USER_AGENT?.trim() ||
    (username ? `node:twinmcp-reddit-drafts:0.1.0 (by /u/${username})` : UA_DEFAULT);
  const oauth = Boolean(clientId && clientSecret);
  let token = null;
  let tokenExpires = 0;

  async function getToken() {
    if (token && Date.now() < tokenExpires - 60_000) return token;
    const res = await fetchImpl("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok)
      throw new RedditError(
        `Reddit OAuth failed (HTTP ${res.status}). Check REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET.`,
        res.status
      );
    const json = await res.json();
    token = json.access_token;
    tokenExpires = Date.now() + (json.expires_in ?? 3600) * 1000;
    return token;
  }

  async function get(path, params = {}) {
    const qs = new URLSearchParams({ raw_json: "1", ...params }).toString();
    const base = oauth ? "https://oauth.reddit.com" : "https://www.reddit.com";
    const url = `${base}${path}${oauth ? "" : ".json"}?${qs}`;
    const headers = { "User-Agent": userAgent, Accept: "application/json" };
    if (oauth) headers.Authorization = `Bearer ${await getToken()}`;
    const res = await fetchImpl(url, { headers });
    if (res.status === 429)
      throw new RedditError(
        "Reddit rate limit reached. Wait a minute and retry with fewer queries.",
        429
      );
    if (res.status === 403 || res.status === 401) {
      throw new RedditError(
        oauth
          ? `Reddit refused the request (HTTP ${res.status}). The subreddit may be private or quarantined.`
          : `Reddit refused the anonymous request (HTTP ${res.status}). Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (a free "script" app at reddit.com/prefs/apps) to use the official read-only API.`,
        res.status
      );
    }
    if (!res.ok)
      throw new RedditError(`Reddit returned HTTP ${res.status} for ${path}.`, res.status);
    return res.json();
  }

  return {
    mode: oauth ? "oauth (application-only, read-only)" : "anonymous public JSON",
    async search({ query, subreddit, sort = "new", time = "week", limit = 15 }) {
      const params = { q: query, sort, t: time, limit: String(limit), type: "link" };
      const path = subreddit ? `/r/${subreddit}/search` : "/search";
      if (subreddit) params.restrict_sr = "1";
      const json = await get(path, params);
      return (json?.data?.children ?? []).filter((c) => c.kind === "t3").map((c) => c.data);
    },
    async thread(id, { limit = 30 } = {}) {
      const json = await get(`/comments/${id}`, { limit: String(limit), depth: "3", sort: "top" });
      if (!Array.isArray(json) || !json[0]?.data?.children?.[0])
        throw new RedditError(`Thread ${id} not found.`, 404);
      return { post: json[0].data.children[0].data, comments: json[1] };
    },
    async rules(subreddit) {
      const json = await get(`/r/${subreddit}/about/rules`);
      return json?.rules ?? [];
    },
  };
}
