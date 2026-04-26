import { describe, it, expect } from "vitest";
import {
  registerClient,
  getClient,
  createAuthCode,
  consumeAuthCode,
  verifyCodeChallenge,
  createRefreshToken,
  consumeRefreshToken,
} from "@/lib/oauth";
import { createHash } from "crypto";

describe("OAuth", () => {
  describe("Dynamic Client Registration", () => {
    it("registers and retrieves a client", () => {
      const c = registerClient("Test App", ["http://localhost/callback"]);
      expect(c.clientId).toMatch(/^twinmcp_/);
      expect(c.clientName).toBe("Test App");
      const found = getClient(c.clientId);
      expect(found).toEqual(c);
    });
  });

  describe("Authorization Code", () => {
    it("creates and consumes a code", () => {
      const code = createAuthCode({
        clientId: "test",
        userId: "user1",
        scopes: ["mcp.read"],
        codeChallenge: "abc",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost",
      });
      expect(code).toBeTruthy();

      const consumed = consumeAuthCode(code);
      expect(consumed).not.toBeNull();
      expect(consumed!.userId).toBe("user1");

      const again = consumeAuthCode(code);
      expect(again).toBeNull();
    });
  });

  describe("PKCE verification", () => {
    it("S256 verifies correctly", () => {
      const verifier = "test-verifier-string";
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      expect(verifyCodeChallenge(verifier, challenge, "S256")).toBe(true);
      expect(verifyCodeChallenge("wrong", challenge, "S256")).toBe(false);
    });

    it("plain method compares directly", () => {
      expect(verifyCodeChallenge("same", "same", "plain")).toBe(true);
      expect(verifyCodeChallenge("a", "b", "plain")).toBe(false);
    });
  });

  describe("Refresh tokens", () => {
    it("creates and consumes a refresh token", () => {
      const token = createRefreshToken("user1", "client1", ["mcp.read"]);
      expect(token).toBeTruthy();

      const consumed = consumeRefreshToken(token);
      expect(consumed).not.toBeNull();
      expect(consumed!.userId).toBe("user1");

      const again = consumeRefreshToken(token);
      expect(again).toBeNull();
    });
  });
});
