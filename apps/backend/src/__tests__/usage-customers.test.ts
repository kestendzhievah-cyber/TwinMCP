import { describe, expect, it } from "vitest";
import {
  CUSTOMER_CSV_HEADER,
  customersCsvFilename,
  customersToCsv,
  keyIdsToResolve,
  parseCustomerUsageRange,
  toCustomerRows,
  type RawCustomerGroup,
} from "../lib/usage/customers";
import { PLAN_CAPABILITIES } from "../lib/plan-features";

const NOW = new Date("2026-10-29T12:00:00.000Z");
const DAY = 86_400_000;
const params = (q: Record<string, string>) => new URLSearchParams(q);

describe("parseCustomerUsageRange", () => {
  it("defaults to the plan's whole activity retention, ending now", () => {
    const r = parseCustomerUsageRange(params({}), "free", NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.retentionDays).toBe(PLAN_CAPABILITIES.free.activityRetentionDays);
    expect(r.from.getTime()).toBe(NOW.getTime() - r.retentionDays * DAY);
    expect(r.to).toEqual(NOW);
    expect(r.clamped).toBe(false);
    expect(r.serverId).toBeNull();
  });

  it("clamps a from older than the retention and says so", () => {
    const r = parseCustomerUsageRange(params({ from: "2026-01-01" }), "free", NOW);
    expect(r.ok && r.clamped).toBe(true);
    if (!r.ok) return;
    expect(r.from.getTime()).toBe(NOW.getTime() - 7 * DAY);
  });

  it("keeps a from inside a Pro retention", () => {
    const r = parseCustomerUsageRange(params({ from: "2026-09-01" }), "pro", NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.clamped).toBe(false);
  });

  it("treats a to date as the whole day, never past now", () => {
    const r = parseCustomerUsageRange(params({ from: "2026-10-01", to: "2026-10-10" }), "pro", NOW);
    expect(r.ok && r.to.toISOString()).toBe("2026-10-11T00:00:00.000Z");
    const future = parseCustomerUsageRange(params({ to: "2027-01-01" }), "pro", NOW);
    expect(future.ok && future.to).toEqual(NOW);
  });

  it("accepts ISO date-times with a zone", () => {
    const r = parseCustomerUsageRange(
      params({ from: "2026-10-28T08:30:00.000Z", to: "2026-10-28T09:00:00+00:00" }),
      "free",
      NOW
    );
    expect(r.ok && r.from.toISOString()).toBe("2026-10-28T08:30:00.000Z");
    expect(r.ok && r.to.toISOString()).toBe("2026-10-28T09:00:00.000Z");
  });

  it("rejects malformed bounds, inverted ranges and bad server ids", () => {
    expect(parseCustomerUsageRange(params({ from: "yesterday" }), "pro", NOW).ok).toBe(false);
    expect(parseCustomerUsageRange(params({ from: "2026-02-30" }), "pro", NOW).ok).toBe(false);
    expect(parseCustomerUsageRange(params({ to: "2026-10-29T10:00:00" }), "pro", NOW).ok).toBe(
      false
    );
    expect(
      parseCustomerUsageRange(params({ from: "2026-10-20", to: "2026-10-10" }), "pro", NOW).ok
    ).toBe(false);
    // Entirely before the retention: nothing left to show.
    expect(parseCustomerUsageRange(params({ to: "2026-01-01" }), "free", NOW).ok).toBe(false);
    expect(parseCustomerUsageRange(params({ serverId: "a b" }), "pro", NOW).ok).toBe(false);
    expect(parseCustomerUsageRange(params({ serverId: "x".repeat(200) }), "pro", NOW).ok).toBe(
      false
    );
  });

  it("passes a well-formed server id through", () => {
    const r = parseCustomerUsageRange(params({ serverId: "srv_abc-123" }), "pro", NOW);
    expect(r.ok && r.serverId).toBe("srv_abc-123");
  });

  it("treats an unknown plan as Free", () => {
    const r = parseCustomerUsageRange(params({}), "enterprise", NOW);
    expect(r.ok && r.retentionDays).toBe(PLAN_CAPABILITIES.free.activityRetentionDays);
  });
});

const groups: RawCustomerGroup[] = [
  {
    externalUserId: "acme",
    apiKeyId: "k1",
    keyCount: 1,
    calls: 10,
    errors: 1,
    lastCallAt: "2026-10-28T10:00:00Z",
  },
  {
    externalUserId: "globex",
    apiKeyId: null,
    keyCount: 2,
    calls: 25,
    errors: 0,
    lastCallAt: new Date("2026-10-27T09:00:00Z"),
  },
  {
    externalUserId: null,
    apiKeyId: "k3",
    keyCount: 1,
    calls: 10,
    errors: 3,
    lastCallAt: "2026-10-29T08:00:00Z",
  },
  {
    externalUserId: null,
    apiKeyId: "oauth-token-id",
    keyCount: 1,
    calls: 2,
    errors: 0,
    lastCallAt: null,
  },
];
const keys = new Map([
  ["k1", { prefix: "ctx7sk_aaaaa", name: "Acme prod" }],
  ["k3", { prefix: "ctx7sk_ccccc", name: null }],
]);

describe("toCustomerRows", () => {
  const rows = toCustomerRows(groups, keys);

  it("sorts by calls, then by the latest call", () => {
    expect(rows.map((r) => r.externalUserId ?? r.apiKeyPrefix ?? "?")).toEqual([
      "globex",
      "ctx7sk_ccccc",
      "acme",
      "?",
    ]);
  });

  it("attaches the key only when the group maps to one known key", () => {
    const acme = rows.find((r) => r.externalUserId === "acme")!;
    expect(acme.apiKeyPrefix).toBe("ctx7sk_aaaaa");
    expect(acme.apiKeyName).toBe("Acme prod");
    expect(rows.find((r) => r.externalUserId === "globex")!.apiKeyPrefix).toBeNull();
    expect(rows[3]!.apiKeyPrefix).toBeNull();
  });

  it("normalizes timestamps to ISO", () => {
    expect(rows.find((r) => r.externalUserId === "acme")!.lastCallAt).toBe(
      "2026-10-28T10:00:00.000Z"
    );
    expect(rows[3]!.lastCallAt).toBeNull();
  });

  it("lists only the key ids it can label", () => {
    expect(keyIdsToResolve(groups).sort()).toEqual(["k1", "k3", "oauth-token-id"]);
  });
});

describe("customersToCsv", () => {
  it("writes a header, escapes cells and neutralizes formulas", () => {
    const csv = customersToCsv([
      {
        externalUserId: '=cmd|"x"',
        apiKeyPrefix: "ctx7sk_aaaaa",
        apiKeyName: "Doe, Jane",
        calls: 3,
        errors: 1,
        lastCallAt: "2026-10-28T10:00:00.000Z",
      },
      {
        externalUserId: null,
        apiKeyPrefix: null,
        apiKeyName: null,
        calls: 1,
        errors: 0,
        lastCallAt: null,
      },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(CUSTOMER_CSV_HEADER.join(","));
    expect(lines[1]).toBe(
      `"'=cmd|""x"""` + ',ctx7sk_aaaaa,"Doe, Jane",3,1,2026-10-28T10:00:00.000Z'
    );
    expect(lines[2]).toBe(",,,1,0,");
    expect(lines[3]).toBe("");
  });

  it("names the file after the window's UTC dates", () => {
    expect(
      customersCsvFilename(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-30T00:00:00Z"))
    ).toBe("twinmcp-customers-2026-10-01_2026-10-29.csv");
  });
});
