import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createServer, type Server, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, postWebhook } from "./transport";
import { guardedLookup, SsrfBlockedError } from "./ssrf";
import { generateWebhookSecret, verifyWebhook, webhookHeaders } from "./sign";

// A real local HTTP server. Private targets are opted in for these tests only
// (WEBHOOKS_ALLOW_PRIVATE, never honoured in production).

type Hit = { path: string; headers: IncomingMessage["headers"]; body: string };
let server: Server;
let base: string;
const hits: Hit[] = [];

beforeAll(async () => {
  process.env.CONFIG_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString("utf8")));
    req.on("end", () => {
      hits.push({ path: req.url ?? "", headers: req.headers, body });
      if (req.url === "/ok") {
        res.writeHead(204).end();
      } else if (req.url === "/redirect") {
        res.writeHead(302, { location: `${base}/ok` }).end();
      } else if (req.url === "/slow") {
        setTimeout(() => res.writeHead(200).end(), 2_000);
      } else {
        res.writeHead(500).end("boom");
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

afterEach(() => {
  hits.length = 0;
  delete process.env.WEBHOOKS_ALLOW_PRIVATE;
});

describe("postWebhook", () => {
  it("POSTs the signed JSON body and resolves with the status", async () => {
    process.env.WEBHOOKS_ALLOW_PRIVATE = "1";
    const secret = generateWebhookSecret();
    const body = JSON.stringify({ id: "evt_1", type: "test", timestamp: "t", data: {} });
    const headers = webhookHeaders(secret, "msg_1", body);
    await expect(postWebhook(`${base}/ok`, body, headers)).resolves.toEqual({ status: 204 });
    const hit = hits[0]!;
    expect(hit.body).toBe(body);
    expect(hit.headers["content-type"]).toBe("application/json");
    expect(
      verifyWebhook(
        secret,
        {
          id: String(hit.headers["webhook-id"]),
          timestamp: String(hit.headers["webhook-timestamp"]),
          signature: String(hit.headers["webhook-signature"]),
        },
        hit.body
      )
    ).toBe(true);
  });

  it("does not follow redirects", async () => {
    process.env.WEBHOOKS_ALLOW_PRIVATE = "1";
    await expect(postWebhook(`${base}/redirect`, "{}", {})).resolves.toEqual({ status: 302 });
    expect(hits.map((h) => h.path)).toEqual(["/redirect"]);
  });

  it("reports non-2xx statuses", async () => {
    process.env.WEBHOOKS_ALLOW_PRIVATE = "1";
    await expect(postWebhook(`${base}/fail`, "{}", {})).resolves.toEqual({ status: 500 });
  });

  it("times out", async () => {
    process.env.WEBHOOKS_ALLOW_PRIVATE = "1";
    await expect(postWebhook(`${base}/slow`, "{}", {}, 200)).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("refuses a private target without the opt-in, before connecting", async () => {
    await expect(postWebhook(`${base}/ok`, "{}", {})).rejects.toThrow(/public/);
    expect(hits).toHaveLength(0);
  });
});

describe("guardedLookup", () => {
  it("refuses a host name that resolves to a loopback address", async () => {
    const err = await new Promise<unknown>((resolve) =>
      guardedLookup("localhost", { all: false }, (e) => resolve(e))
    );
    expect(err).toBeInstanceOf(SsrfBlockedError);
  });
});

describe("secret storage", () => {
  it("round-trips through AES-256-GCM and never stores the plaintext", () => {
    const secret = generateWebhookSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret.slice(6));
    expect(decryptSecret(stored)).toBe(secret);
  });
});
