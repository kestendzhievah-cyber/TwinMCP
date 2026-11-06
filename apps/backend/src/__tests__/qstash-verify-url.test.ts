import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { Receiver } from "@upstash/qstash";
import { jobVerifyUrl } from "@/lib/queue/qstash";

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

// A QStash-shaped signature (HS256 JWT whose `sub` is the published URL).
function sign(key: string, url: string, body: string): string {
  const b64u = (s: string) => Buffer.from(s).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64u(
    JSON.stringify({
      iss: "Upstash",
      sub: url,
      exp: now + 300,
      nbf: now - 5,
      iat: now,
      jti: "test",
      body: createHash("sha256").update(body).digest("base64url"),
    })
  );
  const sig = createHmac("sha256", key).update(`${head}.${payload}`).digest("base64url");
  return `${head}.${payload}.${sig}`;
}

describe("jobVerifyUrl", () => {
  it("uses APP_URL, the URL enqueue() publishes to, not the proxied req.url", () => {
    expect(
      jobVerifyUrl("http://0.0.0.0:3000/api/jobs/run", headers({}), "https://twinmcp.fr/")
    ).toBe("https://twinmcp.fr/api/jobs/run");
  });

  it("falls back to the forwarded host and proto, then to req.url", () => {
    expect(
      jobVerifyUrl(
        "http://0.0.0.0:3000/api/jobs/run",
        headers({ "x-forwarded-host": "twinmcp.fr", "x-forwarded-proto": "https" }),
        undefined
      )
    ).toBe("https://twinmcp.fr/api/jobs/run");
    expect(jobVerifyUrl("http://a/api/jobs/run", headers({}), undefined)).toBe(
      "http://a/api/jobs/run"
    );
  });

  it("accepts a signature made for the public URL behind a proxy (2026-11-06 incident)", async () => {
    const key = "sig_test";
    const body = '{"type":"install-mcp","userServerId":"x"}';
    const signature = sign(key, "https://twinmcp.fr/api/jobs/run", body);
    const receiver = new Receiver({ currentSigningKey: key, nextSigningKey: key });
    const internal = "http://0.0.0.0:3000/api/jobs/run";

    await expect(receiver.verify({ signature, body, url: internal })).rejects.toThrow(
      /invalid subject/
    );
    await expect(
      receiver.verify({
        signature,
        body,
        url: jobVerifyUrl(internal, headers({}), "https://twinmcp.fr"),
      })
    ).resolves.toBe(true);
  });
});
