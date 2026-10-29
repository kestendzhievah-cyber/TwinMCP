import { describe, expect, it } from "vitest";
import {
  collectSecretRefs,
  displayConfigValue,
  hasSecretRef,
  isValidSecretName,
  missingSecretsMessage,
  normalizeSecretName,
  parseSecretRef,
  secretRef,
  substituteSecretRefs,
} from "@/lib/vault/refs";
import { secretUsageFromConfigs, usageLabel } from "@/lib/vault/usage";

describe("secret names", () => {
  it("accepts [A-Z0-9_]{1,64} only", () => {
    expect(isValidSecretName("GITHUB_TOKEN")).toBe(true);
    expect(isValidSecretName("A")).toBe(true);
    expect(isValidSecretName("X".repeat(64))).toBe(true);
    expect(isValidSecretName("X".repeat(65))).toBe(false);
    expect(isValidSecretName("")).toBe(false);
    expect(isValidSecretName("github_token")).toBe(false);
    expect(isValidSecretName("MY-TOKEN")).toBe(false);
    expect(isValidSecretName(42)).toBe(false);
  });

  it("normalizes what a user types", () => {
    expect(normalizeSecretName("  github token ")).toBe("GITHUB_TOKEN");
    expect(normalizeSecretName("my-api-key")).toBe("MY_API_KEY");
    expect(isValidSecretName(normalizeSecretName("é"))).toBe(false);
  });
});

describe("secretRef / parseSecretRef", () => {
  it("round-trips", () => {
    expect(secretRef("NOTION_KEY")).toBe("{{secret:NOTION_KEY}}");
    expect(parseSecretRef(secretRef("NOTION_KEY"))).toBe("NOTION_KEY");
  });

  it("only matches a whole, valid reference", () => {
    expect(parseSecretRef(" {{ secret:A_1 }} ")).toBe("A_1");
    expect(parseSecretRef("Bearer {{secret:A}}")).toBeNull();
    expect(parseSecretRef("{{secret:lower}}")).toBeNull();
    expect(parseSecretRef("ghp_plainvalue")).toBeNull();
    expect(parseSecretRef(null)).toBeNull();
  });

  it("hasSecretRef sees embedded and invalid references", () => {
    expect(hasSecretRef("Bearer {{secret:A}}")).toBe(true);
    expect(hasSecretRef("{{secret:bad-name}}")).toBe(true);
    expect(hasSecretRef("{{other:A}}")).toBe(false);
    // stateless across calls (global regex lastIndex is reset)
    expect(hasSecretRef("{{secret:A}}")).toBe(true);
    expect(hasSecretRef("{{secret:A}}")).toBe(true);
  });
});

describe("collectSecretRefs", () => {
  it("walks nested values, dedups, keeps first-seen order and invalid names", () => {
    const config = {
      A: "{{secret:TOKEN}}",
      B: "x {{secret:OTHER}} y {{secret:TOKEN}}",
      C: 3,
      D: ["{{secret:IN_ARRAY}}", { deep: "{{secret:bad-name}}" }],
      E: null,
    };
    expect(collectSecretRefs(config)).toEqual(["TOKEN", "OTHER", "IN_ARRAY", "bad-name"]);
  });

  it("returns nothing for a config without references", () => {
    expect(collectSecretRefs({ KEY: "value", N: 1, B: true })).toEqual([]);
    expect(collectSecretRefs(undefined)).toEqual([]);
  });
});

describe("substituteSecretRefs", () => {
  const lookup = new Map([
    ["TOKEN", "ghp_123"],
    ["URL", "https://x.test"],
  ]);

  it("replaces whole and embedded references without mutating the input", () => {
    const input = {
      T: "{{secret:TOKEN}}",
      H: "Bearer {{secret:TOKEN}}",
      N: 5,
      L: ["{{secret:URL}}"],
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    const { value, missing, used } = substituteSecretRefs(input, lookup);
    expect(value).toEqual({ T: "ghp_123", H: "Bearer ghp_123", N: 5, L: ["https://x.test"] });
    expect(missing).toEqual([]);
    expect(used.sort()).toEqual(["TOKEN", "URL"]);
    expect(input).toEqual(snapshot);
  });

  it("leaves unknown and invalid references in place and reports them once", () => {
    const { value, missing } = substituteSecretRefs(
      { A: "{{secret:NOPE}}", B: "{{secret:NOPE}}", C: "{{secret:bad}}" },
      lookup
    );
    expect(value).toEqual({ A: "{{secret:NOPE}}", B: "{{secret:NOPE}}", C: "{{secret:bad}}" });
    expect(missing).toEqual(["NOPE", "bad"]);
  });

  it("does not interpret $ patterns in a secret value", () => {
    const { value } = substituteSecretRefs({ A: "{{secret:P}}" }, new Map([["P", "a$&b$1"]]));
    expect(value).toEqual({ A: "a$&b$1" });
  });
});

describe("messages and display", () => {
  it("names the missing secret(s)", () => {
    expect(missingSecretsMessage(["GITHUB_TOKEN"])).toBe("Missing secret GITHUB_TOKEN");
    expect(missingSecretsMessage(["A", "B"])).toBe("Missing secrets A, B");
    expect(missingSecretsMessage([""])).toBe("Missing secret (empty name)");
  });

  it("shows a reference as is but masks a pasted value", () => {
    expect(displayConfigValue("{{secret:A}}", null)).toBe("{{secret:A}}");
    expect(displayConfigValue("ghp_real", null)).toBeNull();
  });
});

describe("secretUsageFromConfigs", () => {
  const meta = (id: string) => ({
    userServerId: id,
    serverId: "srv_1",
    serverName: "Prod",
    serverSlug: "prod",
    mcpSlug: `mcp-${id}`,
    mcpName: `MCP ${id}`,
    enabled: true,
  });

  it("maps each name to the installs and config keys that reference it", () => {
    const usage = secretUsageFromConfigs([
      { ...meta("a"), config: { TOKEN: "{{secret:GH}}", AUTH: "Bearer {{secret:GH}}" } },
      { ...meta("b"), config: { KEY: "{{secret:GH}}", OTHER: "{{secret:NOTION}}" } },
      { ...meta("c"), config: { PLAIN: "x" } },
    ]);
    expect([...usage.keys()].sort()).toEqual(["GH", "NOTION"]);
    expect(usage.get("GH")).toEqual([
      { ...meta("a"), configKeys: ["TOKEN", "AUTH"] },
      { ...meta("b"), configKeys: ["KEY"] },
    ]);
    expect(usage.get("NOTION")?.map((u) => u.userServerId)).toEqual(["b"]);
  });

  it("labels a usage as server · mcp", () => {
    expect(usageLabel({ serverName: "Prod", mcpName: "GitHub" })).toBe("Prod · GitHub");
  });
});
