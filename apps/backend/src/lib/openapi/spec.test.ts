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
});
