import { describe, it, expect } from "vitest";
import {
  generateWebhookSecret,
  secretKeyBytes,
  signWebhook,
  verifyWebhook,
  webhookHeaders,
} from "./sign";

// The reference vector published with the Standard Webhooks specification
// (also used by Svix's libraries).
const VECTOR = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  msgId: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: 1614265330,
  body: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};

describe("webhook signing (Standard Webhooks)", () => {
  it("matches the specification's test vector", () => {
    expect(signWebhook(VECTOR.secret, VECTOR.msgId, VECTOR.timestamp, VECTOR.body)).toBe(
      VECTOR.signature
    );
  });

  it("accepts a bare base64 secret as the same key", () => {
    expect(
      signWebhook(VECTOR.secret.slice("whsec_".length), VECTOR.msgId, VECTOR.timestamp, VECTOR.body)
    ).toBe(VECTOR.signature);
  });

  it("builds the three headers for an attempt", () => {
    const h = webhookHeaders(
      VECTOR.secret,
      VECTOR.msgId,
      VECTOR.body,
      new Date(VECTOR.timestamp * 1000 + 999)
    );
    expect(h).toEqual({
      "webhook-id": VECTOR.msgId,
      "webhook-timestamp": String(VECTOR.timestamp),
      "webhook-signature": VECTOR.signature,
    });
  });

  it("verifies its own signature and rejects tampering, other keys and stale timestamps", () => {
    const headers = {
      id: VECTOR.msgId,
      timestamp: String(VECTOR.timestamp),
      signature: VECTOR.signature,
    };
    expect(verifyWebhook(VECTOR.secret, headers, VECTOR.body, VECTOR.timestamp + 10)).toBe(true);
    // Several signatures, space-separated (secret rotation): any match passes.
    expect(
      verifyWebhook(
        VECTOR.secret,
        { ...headers, signature: `v1,AAAA ${VECTOR.signature}` },
        VECTOR.body,
        VECTOR.timestamp
      )
    ).toBe(true);
    expect(verifyWebhook(VECTOR.secret, headers, '{"test": 1}', VECTOR.timestamp)).toBe(false);
    expect(verifyWebhook(generateWebhookSecret(), headers, VECTOR.body, VECTOR.timestamp)).toBe(
      false
    );
    expect(verifyWebhook(VECTOR.secret, headers, VECTOR.body, VECTOR.timestamp + 301)).toBe(false);
    expect(
      verifyWebhook(
        VECTOR.secret,
        { ...headers, signature: "v2,abc" },
        VECTOR.body,
        VECTOR.timestamp
      )
    ).toBe(false);
  });

  it("generates whsec_ secrets with 32 random bytes", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).toMatch(/^whsec_[A-Za-z0-9+/]+=*$/);
    expect(a).not.toBe(b);
    expect(secretKeyBytes(a)).toHaveLength(32);
  });

  it("refuses an empty secret", () => {
    expect(() => secretKeyBytes("whsec_")).toThrow();
  });
});
