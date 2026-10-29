import { describe, it, expect } from "vitest";
import { PROXY_ERROR } from "@/lib/errors";
import { TOOL_POLICY_DENIED_CODE } from "@/lib/mcp/aggregate";
import { RPC_CODES } from "@/components/docs/docs-facts";

describe("proxy JSON-RPC error codes", () => {
  it("every PROXY_ERROR code is distinct", () => {
    const codes = Object.values(PROXY_ERROR);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("server-defined codes stay in the JSON-RPC server range", () => {
    const spec = new Set<number>([
      PROXY_ERROR.PARSE_ERROR,
      PROXY_ERROR.INVALID_REQUEST,
      PROXY_ERROR.METHOD_NOT_FOUND,
      PROXY_ERROR.INVALID_PARAMS,
    ]);
    for (const code of Object.values(PROXY_ERROR)) {
      if (spec.has(code)) continue;
      expect(code).toBeLessThanOrEqual(-32000);
      expect(code).toBeGreaterThanOrEqual(-32099);
    }
  });

  it("the tool-policy refusal has its own code, not the 401's", () => {
    expect(TOOL_POLICY_DENIED_CODE).toBe(PROXY_ERROR.TOOL_POLICY_DENIED);
    expect(TOOL_POLICY_DENIED_CODE).not.toBe(PROXY_ERROR.UNAUTHORIZED);
  });

  it("the docs quote the codes the proxy emits", () => {
    expect(RPC_CODES.notReady).toBe(PROXY_ERROR.UNAVAILABLE);
    expect(RPC_CODES.uncertain).toBe(PROXY_ERROR.OUTCOME_UNKNOWN);
    expect(RPC_CODES.wrongServer).toBe(PROXY_ERROR.KEY_RESTRICTED);
  });
});
