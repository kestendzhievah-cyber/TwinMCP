import { describe, it, expect } from "vitest";
import { classifyFetchError, looksAsleep, shouldRetry, type ForwardOutcome } from "@/lib/mcp/retry";

const toolCall = { billable: true };
const overhead = { billable: false };
const status = (s: number): ForwardOutcome => ({ kind: "response", status: s });

describe("shouldRetry — tool calls (side effects possible)", () => {
  it("never resends after our own timeout: the tool may still be running", () => {
    expect(shouldRetry(toolCall, { kind: "timeout" })).toBe(false);
  });

  it("never resends after a 504: the gateway gave up, the tool may have finished", () => {
    expect(shouldRetry(toolCall, status(504))).toBe(false);
  });

  it("never resends after a socket error once the request was on the wire", () => {
    expect(shouldRetry(toolCall, { kind: "network_error" })).toBe(false);
  });

  it("resends when the connection never opened", () => {
    expect(shouldRetry(toolCall, { kind: "connect_error" })).toBe(true);
  });

  it("resends on a 502 / 503 from a paused or installing box", () => {
    expect(shouldRetry(toolCall, status(502))).toBe(true);
    expect(shouldRetry(toolCall, status(503))).toBe(true);
  });

  it("does not resend a real answer, success or error", () => {
    for (const s of [200, 202, 400, 401, 404, 429, 500]) {
      expect(shouldRetry(toolCall, status(s))).toBe(false);
    }
  });
});

describe("shouldRetry — protocol overhead (no side effects)", () => {
  it("resends whenever the box looks asleep", () => {
    expect(shouldRetry(overhead, { kind: "timeout" })).toBe(true);
    expect(shouldRetry(overhead, { kind: "network_error" })).toBe(true);
    expect(shouldRetry(overhead, { kind: "connect_error" })).toBe(true);
    expect(shouldRetry(overhead, status(502))).toBe(true);
    expect(shouldRetry(overhead, status(503))).toBe(true);
    expect(shouldRetry(overhead, status(504))).toBe(true);
  });

  it("does not resend a real answer", () => {
    expect(shouldRetry(overhead, status(200))).toBe(false);
    expect(shouldRetry(overhead, status(500))).toBe(false);
    expect(looksAsleep(status(200))).toBe(false);
  });
});

describe("classifyFetchError", () => {
  it("maps an abort to a timeout", () => {
    const abort = new Error("This operation was aborted");
    abort.name = "AbortError";
    expect(classifyFetchError(abort)).toEqual({ kind: "timeout" });
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    expect(classifyFetchError(timeout)).toEqual({ kind: "timeout" });
  });

  it("maps undici connect failures (code on the cause) to connect_error", () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"]) {
      const err = new TypeError("fetch failed", { cause: { code } });
      expect(classifyFetchError(err)).toEqual({ kind: "connect_error" });
    }
  });

  it("reads the code inside a happy-eyeballs AggregateError", () => {
    const err = new TypeError("fetch failed", {
      cause: { errors: [{ code: "ECONNREFUSED" }, { code: "ECONNREFUSED" }] },
    });
    expect(classifyFetchError(err)).toEqual({ kind: "connect_error" });
  });

  it("treats a reset or an unknown failure as possibly sent", () => {
    expect(
      classifyFetchError(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }))
    ).toEqual({ kind: "network_error" });
    expect(classifyFetchError(new TypeError("fetch failed"))).toEqual({ kind: "network_error" });
    expect(classifyFetchError(null)).toEqual({ kind: "network_error" });
  });
});
