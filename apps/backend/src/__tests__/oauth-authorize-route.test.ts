import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Open-redirect guard (RFC 9700 §4.11.2): registration is open, so the
// authorization endpoint must never bounce an error to a redirect URI before
// the user has decided. Every error lands on the consent page instead.

const CLIENT = {
  id: "00000000-0000-4000-8000-000000000001",
  clientId: "tmcp_client_test",
  clientName: "Evil app",
  redirectUris: ["https://evil.example/x"],
  clientUri: null,
  createdAt: new Date(),
  lastUsedAt: null,
};

function chain(result: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit", "innerJoin", "leftJoin", "orderBy"]) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve().then(result).then(res, rej);
  return q;
}

vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => chain(() => [CLIENT]),
    insert: () => ({ values: async () => undefined }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  }),
}));

const { requireSessionUser } = vi.hoisted(() => ({ requireSessionUser: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSessionUser }));

import { GET, POST } from "@/app/oauth/authorize/route";

const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

function authorizeUrl(extra: Record<string, string>) {
  const u = new URL("https://twinmcp.fr/oauth/authorize");
  for (const [k, v] of Object.entries({
    client_id: CLIENT.clientId,
    redirect_uri: "https://evil.example/x",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "s",
    ...extra,
  })) {
    u.searchParams.set(k, v);
  }
  return u;
}

describe("GET /oauth/authorize", () => {
  beforeEach(() => {
    delete process.env.OAUTH_DISABLED;
    requireSessionUser.mockReset();
  });

  it("shows an invalid request (response_type=token) on the consent page, never redirects to the client", async () => {
    const res = await GET(new NextRequest(authorizeUrl({ response_type: "token" })));
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^\/oauth\/consent\?/);
    expect(requireSessionUser).not.toHaveBeenCalled();
  });

  it("still sends a valid request to sign-in when signed out", async () => {
    requireSessionUser.mockResolvedValue(null);
    const res = await GET(new NextRequest(authorizeUrl({ response_type: "code" })));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/^\/sign-in\?returnTo=/);
  });
});

describe("POST /oauth/authorize", () => {
  it("shows an invalid request instead of redirecting before the decision", async () => {
    requireSessionUser.mockResolvedValue({ userId: "u1" });
    const csrf = "a".repeat(43);
    const form = new FormData();
    for (const [k, v] of authorizeUrl({ response_type: "token" }).searchParams) form.set(k, v);
    form.set("csrf", csrf);
    form.set("decision", "allow");
    const req = new NextRequest("https://twinmcp.fr/oauth/authorize", {
      method: "POST",
      body: form,
      headers: { cookie: `tmcp_oauth_csrf=${csrf}`, "sec-fetch-site": "same-origin" },
    });
    const res = await POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location") ?? "").toMatch(/^\/oauth\/consent\?/);
  });
});
