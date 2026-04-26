import type { RepoMeta } from "./github";

/**
 * Compute a 0-10 trust score combining popularity, recency, maturity and community size.
 * Uses logarithmic scaling so very popular repos don't dwarf everything else.
 */
export function computeTrustScore(r: RepoMeta): number {
  const starsNorm = Math.min(1, Math.log10(Math.max(1, r.stars)) / 5); // 100k stars → 1
  const now = Date.now();
  const pushed = new Date(r.pushedAt).getTime();
  const created = new Date(r.createdAt).getTime();
  const daysSincePush = isFinite(pushed) ? (now - pushed) / 86_400_000 : 365;
  const ageDays = isFinite(created) ? (now - created) / 86_400_000 : 0;

  const recency = Math.max(0, 1 - daysSincePush / 365); // 0 after a year stale
  const maturity = Math.min(1, ageDays / (365 * 3)); // 3y → full maturity
  const community = Math.min(1, Math.log10(Math.max(1, r.contributors)) / 3); // 1000 → 1

  const score = starsNorm * 4 + recency * 3 + maturity * 1.5 + community * 1.5;
  return Math.round(Math.min(10, Math.max(0, score)) * 10) / 10;
}
