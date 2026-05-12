// IndexNow verification file. The key must match what we submit to the
// IndexNow API so search engines (Bing, Yandex, Seznam, Naver) trust
// our submission. Spec: https://www.indexnow.org/

export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return new Response("indexnow not configured", { status: 404 });
  }
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
