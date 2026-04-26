import { describe, it, expect } from "vitest";
import { computeTrustScore } from "../trust-score";
import type { RepoMeta } from "../github";

function makeMeta(overrides: Partial<RepoMeta> = {}): RepoMeta {
  return {
    owner: "test",
    repo: "test",
    defaultBranch: "main",
    description: "",
    stars: 100,
    forks: 10,
    openIssues: 5,
    contributors: 20,
    pushedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 365 * 86_400_000).toISOString(),
    homepage: null,
    topics: [],
    ...overrides,
  };
}

describe("computeTrustScore", () => {
  it("returns a number between 0 and 10", () => {
    const score = computeTrustScore(makeMeta());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(10);
  });

  it("popular repos score higher", () => {
    const low = computeTrustScore(makeMeta({ stars: 10 }));
    const high = computeTrustScore(makeMeta({ stars: 50000 }));
    expect(high).toBeGreaterThan(low);
  });

  it("stale repos score lower", () => {
    const fresh = computeTrustScore(makeMeta({ pushedAt: new Date().toISOString() }));
    const stale = computeTrustScore(
      makeMeta({ pushedAt: new Date(Date.now() - 400 * 86_400_000).toISOString() })
    );
    expect(fresh).toBeGreaterThan(stale);
  });

  it("mature repos score higher than brand new", () => {
    const mature = computeTrustScore(
      makeMeta({ createdAt: new Date(Date.now() - 1500 * 86_400_000).toISOString() })
    );
    const fresh = computeTrustScore(
      makeMeta({ createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString() })
    );
    expect(mature).toBeGreaterThan(fresh);
  });
});
