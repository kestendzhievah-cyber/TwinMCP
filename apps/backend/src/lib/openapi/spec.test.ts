import { describe, it, expect } from "vitest";
import { buildOpenApiSpec } from "./spec";

describe("buildOpenApiSpec", () => {
  const spec = buildOpenApiSpec("https://example.com");

  it("emits OpenAPI 3.1", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  it("documents at least 15 paths", () => {
    expect(Object.keys(spec.paths ?? {}).length).toBeGreaterThanOrEqual(15);
  });

  it("declares both security schemes", () => {
    const schemes = spec.components?.securitySchemes ?? {};
    expect(schemes.bearerAuth).toBeDefined();
    expect(schemes.cookieAuth).toBeDefined();
  });

  it("has the MCP proxy route documented", () => {
    expect(spec.paths?.["/api/mcp/{serverSlug}/{mcpSlug}"]).toBeDefined();
  });

  it("has the servers lifecycle routes documented", () => {
    expect(spec.paths?.["/api/v2/servers/{id}/start"]).toBeDefined();
    expect(spec.paths?.["/api/v2/servers/{id}/stop"]).toBeDefined();
    expect(spec.paths?.["/api/v2/servers/{id}/restart"]).toBeDefined();
    expect(spec.paths?.["/api/v2/servers/{id}/health"]).toBeDefined();
    expect(spec.paths?.["/api/v2/servers/{id}/logs"]).toBeDefined();
  });

  it("uses the request origin as the server URL", () => {
    expect(spec.servers?.[0]?.url).toBe("https://example.com");
  });

  it("declares core component schemas", () => {
    const schemas = spec.components?.schemas ?? {};
    expect(schemas.Server).toBeDefined();
    expect(schemas.McpServer).toBeDefined();
    expect(schemas.UserServer).toBeDefined();
    expect(schemas.LogLine).toBeDefined();
  });

  it("documents the real server hostType enum (from the DB schema)", () => {
    const server = spec.components?.schemas?.Server as {
      properties?: Record<string, { enum?: string[] }>;
    };
    expect(server.properties?.hostType?.enum).toEqual([
      "upstash_box",
      "external_url",
      "local_agent",
    ]);
  });

  it("documents API key scopes, server binding and expiry", () => {
    const schemas = spec.components?.schemas ?? {};
    expect((schemas.ApiKeyScope as { enum?: string[] }).enum).toEqual(["full", "mcp_proxy"]);
    const key = schemas.ApiKey as { properties?: Record<string, unknown> };
    expect(Object.keys(key.properties ?? {})).toEqual(
      expect.arrayContaining(["scope", "serverId", "expiresAt", "lastUsedAt"])
    );
    const create = spec.paths?.["/api/v2/auth/keys"]?.post as {
      requestBody?: { content?: Record<string, { schema?: { properties?: object } }> };
    };
    const body = create.requestBody?.content?.["application/json"]?.schema?.properties ?? {};
    expect(Object.keys(body)).toEqual(expect.arrayContaining(["name", "scope", "serverId"]));
    const rotate = JSON.stringify(spec.paths?.["/api/v2/auth/keys/{id}/rotate"]);
    expect(rotate).toContain("oldKeyExpiresAt");
    expect(rotate).toContain("24 h");
  });
});
