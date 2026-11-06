---
"@twinmcp/reddit-drafts": minor
---

New package: `@twinmcp/reddit-drafts`, an MCP server that finds Reddit threads where a product genuinely helps and drafts honest replies for a human to review and post. Read-only by design (no tool posts, votes or messages): `find_opportunities`, `search_threads`, `get_thread`, `get_subreddit_rules`, `reply_guidelines` and `check_draft` (disclosure, answer-first, repetition and length checks), plus a `daily_review` prompt. Uses Reddit's official application-only OAuth (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`).
