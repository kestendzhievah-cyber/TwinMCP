import { describe, expect, it } from "vitest";
import { describeToolSchema, searchToolsAnswer } from "@/lib/mcp/router-tools";
import {
  describeSubFields,
  initialFormValues,
  jsonSkeleton,
  schemaToForm,
  schemaTypeLabel,
} from "@/lib/mcp/schema-form";
import {
  envDenyCidrs,
  isAllowedWebhookPort,
  isDeniedAddress,
  isPrivateAddress,
  parseCidr,
  validateWebhookUrl,
} from "@/lib/webhooks/ssrf";
import { keyAllowsServer } from "@/lib/auth/key-scope";
import { REFRESH_REUSE_GRACE_MS, resourceServerSlug, withinRefreshGrace } from "@/lib/oauth";
import { parseTryBody } from "@/app/dashboard/servers/[id]/try/protocol";

// Fixes from the wave C review: router-mode answers, nested-object form
// skeletons, webhook SSRF ports / deny list, OAuth audience + refresh grace,
// and the Tool access dialog's unfiltered list.

describe("router mode answers", () => {
  const tools = [
    { name: "github__create_issue", description: "Create an issue" },
    { name: "fs__read_file", description: "Read a file" },
  ];

  it("returns hits as before", () => {
    const a = searchToolsAnswer(tools, "issue", 10);
    expect(a.tools).toEqual([{ name: "github__create_issue", description: "Create an issue" }]);
    expect(a.hint).toBeUndefined();
  });

  it("explains a search with no hit and lists available names", () => {
    const a = searchToolsAnswer(tools, "kubernetes", 10, [{ mcp: "x", state: "waking" }]);
    expect(a.tools).toEqual([]);
    expect(String(a.hint)).toMatch(/No tool matched/);
    expect(a.availableTools).toEqual(["fs__read_file", "github__create_issue"]);
    expect(a.warnings).toEqual([{ mcp: "x", state: "waking" }]);
  });

  it("says so when the server has no tool at all", () => {
    expect(String(searchToolsAnswer([], "x", 10).hint)).toMatch(/No tool is available/);
  });

  it("get_tool_schema returns the tool verbatim, outputSchema included", () => {
    const out = JSON.parse(
      describeToolSchema({
        name: "m__t",
        inputSchema: { type: "object" },
        outputSchema: { type: "object", properties: { ok: { type: "boolean" } } },
        _meta: { v: 1 },
      })
    );
    expect(out.outputSchema).toEqual({ type: "object", properties: { ok: { type: "boolean" } } });
    expect(out._meta).toEqual({ v: 1 });
    expect(out.description).toBe("");
  });
});

describe("nested object fields (playground)", () => {
  const schema = {
    type: "object",
    properties: {
      parent: {
        type: "object",
        properties: {
          database_id: { type: "string" },
          type: { enum: ["database_id", "page_id"] },
          note: { type: "string" },
        },
        required: ["database_id", "type"],
      },
      labels: {
        type: "array",
        items: { type: "object", properties: { name: { type: "string" } } },
      },
    },
    required: ["parent"],
  };

  it("builds a skeleton with required keys, enum and empty values", () => {
    expect(jsonSkeleton(schema.properties.parent)).toEqual({
      database_id: "",
      type: "database_id",
    });
    expect(jsonSkeleton(schema.properties.labels)).toEqual([{ name: "" }]);
    expect(jsonSkeleton({ type: "integer", minimum: 3 })).toBe(3);
    expect(jsonSkeleton({ type: "object", default: { a: 1 } })).toEqual({ a: 1 });
  });

  it("lists sub-fields, required first, with types and enums", () => {
    const subs = describeSubFields(schema.properties.parent);
    expect(subs.map((s) => s.name)).toEqual(["database_id", "type", "note"]);
    expect(subs[1]).toMatchObject({ required: true, enumValues: ["database_id", "page_id"] });
    expect(schemaTypeLabel({ type: "array", items: { type: "string" } })).toBe("string[]");
    expect(schemaTypeLabel({ type: ["string", "null"] })).toBe("string | null");
  });

  it("pre-fills a required object and leaves an optional one empty", () => {
    const form = schemaToForm(schema);
    const parent = form.fields.find((f) => f.name === "parent")!;
    const labels = form.fields.find((f) => f.name === "labels")!;
    expect(parent.kind).toBe("json");
    expect(parent.subFields?.length).toBe(3);
    expect(labels.subFields?.map((s) => s.name)).toEqual(["name"]);
    const values = initialFormValues(form.fields);
    expect(JSON.parse(values.parent!)).toEqual({ database_id: "", type: "database_id" });
    expect(values.labels).toBe("");
  });
});

describe("webhook SSRF: ports and deny list", () => {
  const prod = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

  it("allows 443 / 8443 in production, plus 80 outside it", () => {
    expect(isAllowedWebhookPort(new URL("https://a.example.com/x"), true)).toBe(true);
    expect(isAllowedWebhookPort(new URL("https://a.example.com:8443/x"), true)).toBe(true);
    expect(isAllowedWebhookPort(new URL("https://a.example.com:5432/x"), true)).toBe(false);
    expect(isAllowedWebhookPort(new URL("http://a.example.com:80/x"), false)).toBe(true);
    expect(validateWebhookUrl("https://hooks.example.com:3000/x", prod)).toMatchObject({
      ok: false,
    });
    expect(validateWebhookUrl("https://hooks.example.com/x", prod).ok).toBe(true);
  });

  it("classifies SIIT and local-use NAT64 as private", () => {
    expect(isPrivateAddress("::ffff:0:10.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:0:8.8.8.8")).toBe(false);
    expect(isPrivateAddress("64:ff9b:1::8.8.8.8")).toBe(true);
  });

  it("matches addresses against CIDRs", () => {
    expect(parseCidr("203.0.113.0/24")).toMatchObject({ v: 4, prefix: 24 });
    expect(parseCidr("2001:db8::/32")).toMatchObject({ v: 6, prefix: 32 });
    expect(parseCidr("nope")).toBeNull();
    expect(parseCidr("1.2.3.4/33")).toBeNull();
    expect(isDeniedAddress("203.0.113.9", ["203.0.113.0/24"])).toBe(true);
    expect(isDeniedAddress("203.0.114.9", ["203.0.113.0/24"])).toBe(false);
    expect(isDeniedAddress("::ffff:203.0.113.9", ["203.0.113.9"])).toBe(true);
    expect(isDeniedAddress("2a01:4f8::1", ["2a01:4f8::/32"])).toBe(true);
    expect(isDeniedAddress("1.2.3.4", ["garbage", "2a01::/16"])).toBe(false);
  });

  it("reads WEBHOOKS_DENY_CIDRS and refuses a denied literal", () => {
    const env = {
      NODE_ENV: "production",
      WEBHOOKS_DENY_CIDRS: "198.51.99.7, 2a01:4f8::/32",
    } as unknown as NodeJS.ProcessEnv;
    expect(envDenyCidrs(env)).toEqual(["198.51.99.7", "2a01:4f8::/32"]);
    expect(validateWebhookUrl("https://198.51.99.7/hook", env).ok).toBe(false);
  });
});

describe("OAuth hardening", () => {
  it("reads the server slug a resource names", () => {
    expect(resourceServerSlug("https://twinmcp.fr/api/mcp/my-server")).toBe("my-server");
    expect(resourceServerSlug("https://twinmcp.fr/api/mcp/my-server/fetch")).toBe("my-server");
    expect(resourceServerSlug("https://twinmcp.fr")).toBeNull();
    expect(resourceServerSlug(null)).toBeNull();
    expect(resourceServerSlug("not a url")).toBeNull();
  });

  it("keeps a token on the server its resource names, even when granted all", () => {
    const token = { scope: "mcp_proxy" as const, serverId: null, resourceServerSlug: "a" };
    expect(keyAllowsServer(token, "srv-a", "a")).toBe(true);
    expect(keyAllowsServer(token, "srv-b", "b")).toBe(false);
    // An API key (no resource) is unaffected.
    expect(keyAllowsServer({ scope: "mcp_proxy", serverId: null }, "srv-b", "b")).toBe(true);
    expect(
      keyAllowsServer({ scope: "full", serverId: null, resourceServerSlug: "a" }, "x", "b")
    ).toBe(true);
  });

  it("treats a refresh retry within the grace window as a retry", () => {
    const now = Date.now();
    expect(withinRefreshGrace(new Date(now - 1_000), now)).toBe(true);
    expect(withinRefreshGrace(new Date(now - REFRESH_REUSE_GRACE_MS - 1), now)).toBe(false);
    expect(withinRefreshGrace(null, now)).toBe(false);
  });
});

describe("Tool access dialog list", () => {
  it("accepts ignorePolicy on tools/list only", () => {
    expect(parseTryBody({ mcpSlug: "fs", method: "tools/list", ignorePolicy: true })).toEqual({
      ok: true,
      body: { mcpSlug: "fs", method: "tools/list", ignorePolicy: true },
    });
    expect(parseTryBody({ mcpSlug: "fs", method: "tools/list" })).toEqual({
      ok: true,
      body: { mcpSlug: "fs", method: "tools/list" },
    });
    const call = parseTryBody({
      mcpSlug: "fs",
      method: "tools/call",
      name: "t",
      ignorePolicy: true,
    });
    expect(call.ok && "ignorePolicy" in call.body).toBe(false);
  });
});
