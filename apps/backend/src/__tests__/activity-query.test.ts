import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DEFAULT_LIMIT,
  ACTIVITY_MAX_LIMIT,
  clampLimit,
  decodeCursor,
  encodeCursor,
  hasActiveFilters,
  paginate,
  parseActivityQuery,
} from "@/lib/activity/query";
import { MAX_TEXT_LENGTH, isForeignKeyViolation, toToolCallRow } from "@/lib/activity/record";

const ID = "3f2b6c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";
const TS = "2026-10-28T12:34:56.123456Z";

describe("activity cursor", () => {
  it("round-trips with microsecond precision", () => {
    const c = encodeCursor({ t: TS, i: ID });
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(c)).toEqual({ t: TS, i: ID });
  });

  it("rejects malformed or tampered cursors", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("not base64!")).toBeNull();
    expect(decodeCursor(Buffer.from("{oops", "utf8").toString("base64url"))).toBeNull();
    const bad = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");
    expect(decodeCursor(bad({ t: TS, i: "1; DROP TABLE x" }))).toBeNull();
    expect(decodeCursor(bad({ t: "yesterday", i: ID }))).toBeNull();
    expect(decodeCursor(bad({ t: "2026-13-45T99:99:99Z", i: ID }))).toBeNull();
    expect(decodeCursor(bad([TS, ID]))).toBeNull();
    expect(decodeCursor("a".repeat(500))).toBeNull();
  });
});

describe("clampLimit", () => {
  it("defaults, clamps to 1..100 and ignores junk", () => {
    expect(clampLimit(undefined)).toBe(ACTIVITY_DEFAULT_LIMIT);
    expect(clampLimit("abc")).toBe(ACTIVITY_DEFAULT_LIMIT);
    expect(clampLimit("0")).toBe(1);
    expect(clampLimit("-3")).toBe(1);
    expect(clampLimit("25")).toBe(25);
    expect(clampLimit("1000")).toBe(ACTIVITY_MAX_LIMIT);
    expect(clampLimit(12.7)).toBe(12);
  });
});

describe("parseActivityQuery", () => {
  it("parses every filter from URLSearchParams", () => {
    const cursor = encodeCursor({ t: TS, i: ID });
    const r = parseActivityQuery(
      new URLSearchParams({
        status: "error",
        mcp: "github",
        tool: " create_issue ",
        apiKey: "key-1",
        limit: "20",
        cursor,
      })
    );
    expect(r).toEqual({
      ok: true,
      query: {
        filters: { status: "error", mcp: "github", tool: "create_issue", apiKeyId: "key-1" },
        limit: 20,
        cursor: { t: TS, i: ID },
      },
    });
  });

  it("treats empty and 'all' as no filter (record form, as Next searchParams)", () => {
    const r = parseActivityQuery({ status: "all", mcp: "", tool: "  ", apiKey: ["all"] });
    expect(r).toEqual({
      ok: true,
      query: { filters: {}, limit: ACTIVITY_DEFAULT_LIMIT, cursor: null },
    });
  });

  it("rejects an unknown status and a bad cursor", () => {
    expect(parseActivityQuery(new URLSearchParams({ status: "weird" })).ok).toBe(false);
    expect(parseActivityQuery(new URLSearchParams({ cursor: "zzz" })).ok).toBe(false);
  });

  it("caps filter text length", () => {
    const r = parseActivityQuery({ tool: "x".repeat(1000) });
    expect(r.ok && r.query.filters.tool?.length).toBe(200);
  });

  it("hasActiveFilters", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ tool: "a" })).toBe(true);
    expect(hasActiveFilters({ status: "denied" })).toBe(true);
  });
});

describe("paginate", () => {
  const rows = [1, 2, 3].map((n) => ({ id: `id-${n}`, cursorTs: `2026-10-28T00:00:0${n}Z` }));

  it("returns a cursor from the last row of the page when more rows exist", () => {
    const { page, nextCursor } = paginate(rows, 2);
    expect(page.map((r) => r.id)).toEqual(["id-1", "id-2"]);
    expect(nextCursor).not.toBeNull();
    const decoded = JSON.parse(Buffer.from(nextCursor!, "base64url").toString("utf8"));
    expect(decoded).toEqual({ t: "2026-10-28T00:00:02Z", i: "id-2" });
  });

  it("returns no cursor on the last page", () => {
    expect(paginate(rows, 3).nextCursor).toBeNull();
    expect(paginate([], 3)).toEqual({ page: [], nextCursor: null });
  });
});

describe("toToolCallRow (record normalization)", () => {
  const base = {
    userId: "u1",
    serverId: "s1",
    mcpSlug: "github",
    toolName: "create_issue",
    status: "ok" as const,
    requestId: "req_1",
  };

  it("keeps metadata only and fills optional fields with null", () => {
    const at = new Date("2026-10-28T10:00:00.000Z");
    expect(toToolCallRow(base, at)).toEqual({
      userId: "u1",
      serverId: "s1",
      userServerId: null,
      mcpSlug: "github",
      toolName: "create_issue",
      status: "ok",
      errorCode: null,
      latencyMs: null,
      requestId: "req_1",
      apiKeyId: null,
      externalUserId: null,
      createdAt: at,
    });
  });

  it("drops records missing a required field", () => {
    expect(toToolCallRow({ ...base, userId: "" })).toBeNull();
    expect(toToolCallRow({ ...base, serverId: "  " })).toBeNull();
    expect(toToolCallRow({ ...base, mcpSlug: "" })).toBeNull();
    expect(toToolCallRow({ ...base, requestId: "" })).toBeNull();
  });

  it("stamps the call time, not the flush time", () => {
    const before = Date.now();
    const row = toToolCallRow(base);
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect((row?.createdAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("recognises a foreign-key violation however the driver wraps it", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
    expect(isForeignKeyViolation(new Error("x", { cause: { code: "23503" } }))).toBe(true);
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
  });

  it("coerces an unknown status to error and clamps numbers", () => {
    const row = toToolCallRow({
      ...base,
      status: "boom" as never,
      errorCode: -32001.4,
      latencyMs: -5,
    });
    expect(row?.status).toBe("error");
    expect(row?.errorCode).toBe(-32001);
    expect(row?.latencyMs).toBe(0);
    expect(toToolCallRow({ ...base, latencyMs: 1e12 })?.latencyMs).toBe(2_147_483_647);
    expect(toToolCallRow({ ...base, latencyMs: Number.NaN })?.latencyMs).toBeNull();
    expect(toToolCallRow({ ...base, latencyMs: 12.6 })?.latencyMs).toBe(13);
  });

  it("truncates oversized text", () => {
    const row = toToolCallRow({ ...base, toolName: "t".repeat(5000) });
    expect(row?.toolName).toHaveLength(MAX_TEXT_LENGTH);
  });

  it("has no column for arguments or results", () => {
    const row = toToolCallRow({ ...base, arguments: { secret: 1 } } as never);
    expect(row && Object.keys(row)).not.toContain("arguments");
    expect(row && Object.keys(row)).not.toContain("result");
  });
});
