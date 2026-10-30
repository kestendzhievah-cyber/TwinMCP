import { describe, it, expect } from "vitest";
import { schedulerDecision, skippedJobs } from "./enabled";

const prod = { NODE_ENV: "production", DATABASE_URL: "postgres://x" };
const serverArgv = ["/usr/local/bin/node", "/app/apps/backend/server.js"];

describe("schedulerDecision", () => {
  it("is off by default, even with NODE_ENV=production (a local next start)", () => {
    expect(schedulerDecision(prod, serverArgv, "nodejs").enabled).toBe(false);
  });

  it('INTERNAL_SCHEDULER="1" (set in the Docker image) turns it on', () => {
    for (const v of ["1", "true", "on", " YES "]) {
      expect(schedulerDecision({ ...prod, INTERNAL_SCHEDULER: v }, serverArgv, "nodejs")).toEqual({
        enabled: true,
        reason: "INTERNAL_SCHEDULER enables it",
      });
    }
  });

  it('INTERNAL_SCHEDULER="0" turns it off', () => {
    for (const v of ["0", "false", "off", " OFF "]) {
      expect(
        schedulerDecision({ ...prod, INTERNAL_SCHEDULER: v }, serverArgv, "nodejs").enabled
      ).toBe(false);
    }
  });

  it("is off on the edge runtime or an unknown runtime", () => {
    expect(schedulerDecision(prod, serverArgv, "edge").enabled).toBe(false);
    expect(schedulerDecision(prod, serverArgv, undefined).enabled).toBe(false);
  });

  it("is off during next build", () => {
    expect(
      schedulerDecision({ ...prod, NEXT_PHASE: "phase-production-build" }, serverArgv, "nodejs")
        .enabled
    ).toBe(false);
    expect(
      schedulerDecision(
        prod,
        ["/usr/bin/node", "/app/node_modules/next/dist/bin/next", "build"],
        "nodejs"
      ).enabled
    ).toBe(false);
  });

  it("is off in tests, even when forced on", () => {
    expect(
      schedulerDecision({ ...prod, VITEST: "true", INTERNAL_SCHEDULER: "1" }, serverArgv, "nodejs")
        .enabled
    ).toBe(false);
    expect(
      schedulerDecision({ NODE_ENV: "test", DATABASE_URL: "postgres://x" }, serverArgv, "nodejs")
        .enabled
    ).toBe(false);
  });

  it("is off without a database", () => {
    expect(schedulerDecision({ NODE_ENV: "production" }, serverArgv, "nodejs").enabled).toBe(false);
  });

  it("is off in development unless INTERNAL_SCHEDULER=1", () => {
    const dev = { NODE_ENV: "development", DATABASE_URL: "postgres://x" };
    expect(schedulerDecision(dev, serverArgv, "nodejs").enabled).toBe(false);
    expect(
      schedulerDecision({ ...dev, INTERNAL_SCHEDULER: "1" }, serverArgv, "nodejs").enabled
    ).toBe(true);
  });

  it("does not mistake `next start` for a build", () => {
    expect(
      schedulerDecision(
        { ...prod, INTERNAL_SCHEDULER: "1" },
        ["/usr/bin/node", "/app/node_modules/.bin/next", "start"],
        "nodejs"
      ).enabled
    ).toBe(true);
  });
});

describe("skippedJobs", () => {
  it("parses a comma-separated list", () => {
    expect([...skippedJobs({ INTERNAL_SCHEDULER_SKIP: " digest, churn ,," })]).toEqual([
      "digest",
      "churn",
    ]);
    expect(skippedJobs({}).size).toBe(0);
  });
});
