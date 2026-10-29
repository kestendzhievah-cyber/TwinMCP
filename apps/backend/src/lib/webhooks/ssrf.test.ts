import { describe, it, expect } from "vitest";
import {
  allowPrivateTargets,
  assertPublicHost,
  isPrivateAddress,
  SsrfBlockedError,
  validateWebhookUrl,
} from "./ssrf";

const PROD = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
const DEV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
const DEV_PRIVATE = { NODE_ENV: "development", WEBHOOKS_ALLOW_PRIVATE: "1" } as NodeJS.ProcessEnv;

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "198.18.0.1",
    "192.0.2.10",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::a9fe:a9fe", // NAT64 of 169.254.169.254
    "2002:c0a8:0101::1", // 6to4 of 192.168.1.1
    "2001:db8::1",
    "[::1]",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "100.128.0.1",
    "192.169.0.1",
    "2606:4700:4700::1111",
    "2a00:1450:4007:80e::200e",
    "::ffff:8.8.8.8",
  ])("allows public %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("validateWebhookUrl", () => {
  it("accepts a public https URL", () => {
    const r = validateWebhookUrl("https://hooks.example.com/twinmcp", PROD);
    expect(r.ok).toBe(true);
  });

  it("requires https in production, allows http elsewhere", () => {
    expect(validateWebhookUrl("http://hooks.example.com/x", PROD).ok).toBe(false);
    expect(validateWebhookUrl("http://hooks.example.com/x", DEV).ok).toBe(true);
    expect(validateWebhookUrl("ftp://hooks.example.com/x", DEV).ok).toBe(false);
  });

  it.each([
    "https://localhost/x",
    "https://api.localhost/x",
    "https://printer.local/x",
    "https://metadata.google.internal/computeMetadata/v1",
    "https://127.0.0.1/x",
    "https://2130706433/x", // 127.0.0.1 in decimal, normalized by URL
    "https://0x7f.1/x",
    "https://[::1]/x",
    "https://[::ffff:169.254.169.254]/x",
    "https://169.254.169.254/latest/meta-data",
    "https://10.1.2.3/x",
    "https://intranet/x",
  ])("rejects internal target %s", (url) => {
    expect(validateWebhookUrl(url, PROD).ok).toBe(false);
  });

  it("rejects credentials, garbage and overlong URLs", () => {
    expect(validateWebhookUrl("https://user:pw@hooks.example.com/", PROD).ok).toBe(false);
    expect(validateWebhookUrl("not a url", PROD).ok).toBe(false);
    expect(validateWebhookUrl(`https://example.com/${"a".repeat(3000)}`, PROD).ok).toBe(false);
  });

  it("allows private targets only with the dev opt-in, never in production", () => {
    expect(validateWebhookUrl("http://localhost:4000/hook", DEV_PRIVATE).ok).toBe(true);
    expect(allowPrivateTargets(DEV_PRIVATE)).toBe(true);
    expect(
      allowPrivateTargets({
        NODE_ENV: "production",
        WEBHOOKS_ALLOW_PRIVATE: "1",
      } as NodeJS.ProcessEnv)
    ).toBe(false);
  });
});

describe("assertPublicHost (after DNS resolution)", () => {
  const resolvesTo =
    (...addresses: string[]) =>
    async () =>
      addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

  it("passes a name resolving only to public addresses", async () => {
    await expect(
      assertPublicHost(new URL("https://hooks.example.com"), resolvesTo("93.184.216.34"), PROD)
    ).resolves.toBeUndefined();
  });

  it("blocks a name with ANY private address (DNS rebinding / mixed records)", async () => {
    await expect(
      assertPublicHost(
        new URL("https://evil.example.com"),
        resolvesTo("93.184.216.34", "127.0.0.1"),
        PROD
      )
    ).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(
      assertPublicHost(new URL("https://evil.example.com"), resolvesTo("fd00::1"), PROD)
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks a name that does not resolve to anything", async () => {
    await expect(
      assertPublicHost(new URL("https://empty.example.com"), resolvesTo(), PROD)
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("checks IP literals without DNS", async () => {
    const neverCalled = async () => {
      throw new Error("DNS should not be queried");
    };
    await expect(
      assertPublicHost(new URL("https://8.8.8.8/x"), neverCalled, PROD)
    ).resolves.toBeUndefined();
    await expect(
      assertPublicHost(new URL("https://[::1]/x"), neverCalled, PROD)
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});
