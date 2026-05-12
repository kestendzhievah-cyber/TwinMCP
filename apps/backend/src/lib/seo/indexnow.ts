// IndexNow client. Notifies Bing, Yandex, Seznam, and Naver instantly when
// a URL is added or changed. Free, no rate limit beyond reasonable use.
//
// Usage:
//   import { submitUrls } from "@/lib/seo/indexnow";
//   await submitUrls(["https://twinmcp.dev/blog/new-post"]);
//
// Wire this into the publication flow when you start adding posts via a
// CMS or API. For the current registry-driven flow, call it manually from
// a deploy hook after merging a post.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

export interface SubmitResult {
  ok: boolean;
  status: number;
  body?: string;
}

export async function submitUrls(urls: string[]): Promise<SubmitResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { ok: false, status: 0, body: "INDEXNOW_KEY not set" };
  }
  if (urls.length === 0) {
    return { ok: true, status: 200, body: "no urls to submit" };
  }

  const host = new URL(SITE_URL).host;
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${SITE_URL}/indexnow.txt`,
      urlList: urls,
    }),
  });

  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}
