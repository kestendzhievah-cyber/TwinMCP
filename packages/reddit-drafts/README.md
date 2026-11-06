# Reddit Drafts MCP

An MCP server that finds Reddit threads where your product **genuinely helps** and helps **you** write honest replies.

**It never posts.** There is no tool that writes to Reddit: no submit, no comment, no vote, no message. You read every draft, edit it and post it yourself. This is deliberate: automated promotional comments get accounts banned and are dishonest.

## Tools

All tools are read-only (`readOnlyHint: true`).

| Tool                  | What it does                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `find_opportunities`  | Runs your keyword searches, drops locked, archived, NSFW, old threads and threads that already mention your brand, then ranks the rest (fresh questions, migration/hosting intent, room to help). |
| `search_threads`      | Plain keyword search, optionally inside given subreddits.                                                                                                                                         |
| `get_thread`          | A post and its top comments, plus `alreadyMentioned` (has someone already named your brand?).                                                                                                     |
| `get_subreddit_rules` | The subreddit's rules and a hint on whether self-promotion is restricted.                                                                                                                         |
| `reply_guidelines`    | The drafting rules (answer first, disclose, one link, one mention, no copy-paste) and the only product facts a draft may state.                                                                   |
| `check_draft`         | Lints a draft: missing disclosure (error), too similar to another draft (error: Reddit flags repeated text), length, links, hype words, ALL CAPS, emojis.                                         |

Prompt: `daily_review` (find the 5 best threads, decide reply / reply without the product / skip, draft one reply per thread, check each one).

## Reddit credentials (needed)

Reddit refuses most anonymous API requests (HTTP 403), so use its official **read-only, application-only** access:

1. Go to <https://www.reddit.com/prefs/apps> and click **create another app**.
2. Pick **script**, give it a name, and use `http://localhost` as the redirect URI.
3. Copy the **client id** (under the app name) and the **secret**.

Reddit may ask you to accept its Data API terms or approve the app. The server only reads public posts, comments and subreddit rules.

## Configuration

| Variable                            | Required     | Meaning                                                                                                                                |
| ----------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `REDDIT_CLIENT_ID`                  | yes          | App client id                                                                                                                          |
| `REDDIT_CLIENT_SECRET`              | yes (secret) | App secret                                                                                                                             |
| `REDDIT_USERNAME`                   | recommended  | Your Reddit username, used in the User-Agent as Reddit asks                                                                            |
| `DRAFTS_KEYWORDS`                   | no           | Comma-separated searches (default: `smithery, mcp hosting, host mcp server, deploy mcp server, remote mcp server, mcp server chatgpt`) |
| `DRAFTS_SUBREDDITS`                 | no           | Comma-separated subreddits to search (default: all of Reddit)                                                                          |
| `DRAFTS_BRAND` / `DRAFTS_BRAND_URL` | no           | Default `TwinMCP` / `twinmcp.fr`                                                                                                       |
| `DRAFTS_FACTS`                      | no           | One product fact per line; replaces the defaults                                                                                       |
| `DRAFTS_MAX_WORDS`                  | no           | Draft length target (default 80)                                                                                                       |

## Run it

**On TwinMCP:** Dashboard → Publish MCP:

- name `Reddit Drafts`
- slug `reddit-drafts`
- runtime `node`
- start command `npx -y @twinmcp/reddit-drafts@0.1.0`
- config fields `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` (secret), `REDDIT_USERNAME`, `DRAFTS_KEYWORDS`, `DRAFTS_SUBREDDITS`

Then install it on a server and connect Claude, ChatGPT or Cursor.

**Locally (Claude Desktop, Cursor…):**

```json
{
  "mcpServers": {
    "reddit-drafts": {
      "command": "npx",
      "args": ["-y", "@twinmcp/reddit-drafts@0.1.0"],
      "env": {
        "REDDIT_CLIENT_ID": "…",
        "REDDIT_CLIENT_SECRET": "…",
        "REDDIT_USERNAME": "your_username"
      }
    }
  }
}
```

Then ask: _"Run the daily_review prompt"_, or _"Find Reddit threads where people need to migrate off Smithery and draft replies. Don't post."_

## Develop

```sh
npm install
npm test
```

MIT licence.
