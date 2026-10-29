import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import * as path from "path";

vi.mock("os", () => ({ homedir: () => "/fake-home", default: { homedir: () => "/fake-home" } }));

vi.mock("fs", () => {
  const fns = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
  return { ...fns, default: fns };
});

import * as fs from "fs";
import {
  saveTokens,
  loadTokens,
  clearTokens,
  isTokenExpired,
  getValidAccessToken,
  type TokenData,
} from "../utils/auth.js";

const mfs = vi.mocked(fs);
const CONFIG_DIR_PATH = path.join("/fake-home", ".twinmcp");
const CREDENTIALS_PATH = path.join(CONFIG_DIR_PATH, "credentials.json");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("fetch not mocked for this test");
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveTokens", () => {
  test("creates config directory if it does not exist", () => {
    mfs.existsSync.mockReturnValue(false);
    saveTokens({ access_token: "tok", token_type: "bearer" });
    expect(mfs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR_PATH, { recursive: true, mode: 0o700 });
  });

  test("skips directory creation if it already exists", () => {
    mfs.existsSync.mockReturnValue(true);
    saveTokens({ access_token: "tok", token_type: "bearer" });
    expect(mfs.mkdirSync).not.toHaveBeenCalled();
  });

  test("writes credentials file with 0o600 permissions", () => {
    mfs.existsSync.mockReturnValue(true);
    saveTokens({ access_token: "tok", token_type: "bearer" });
    expect(mfs.writeFileSync).toHaveBeenCalledWith(CREDENTIALS_PATH, expect.any(String), {
      mode: 0o600,
    });
  });

  test("computes expires_at from expires_in when expires_at is absent", () => {
    mfs.existsSync.mockReturnValue(true);
    const now = 1000000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    saveTokens({ access_token: "tok", token_type: "bearer", expires_in: 3600 });
    const written = JSON.parse(mfs.writeFileSync.mock.calls[0][1] as string);
    expect(written.expires_at).toBe(now + 3600 * 1000);
  });

  test("preserves existing expires_at if already set", () => {
    mfs.existsSync.mockReturnValue(true);
    saveTokens({ access_token: "tok", token_type: "bearer", expires_at: 999, expires_in: 3600 });
    const written = JSON.parse(mfs.writeFileSync.mock.calls[0][1] as string);
    expect(written.expires_at).toBe(999);
  });
});

describe("loadTokens", () => {
  test("returns null when credentials file does not exist", () => {
    mfs.existsSync.mockReturnValue(false);
    expect(loadTokens()).toBeNull();
  });

  test("returns parsed TokenData when file exists", () => {
    const tokens: TokenData = { access_token: "tok", token_type: "bearer" };
    mfs.existsSync.mockReturnValue(true);
    mfs.readFileSync.mockReturnValue(JSON.stringify(tokens));
    expect(loadTokens()).toEqual(tokens);
  });

  test("returns null on malformed JSON", () => {
    mfs.existsSync.mockReturnValue(true);
    mfs.readFileSync.mockReturnValue("not json");
    expect(loadTokens()).toBeNull();
  });
});

describe("clearTokens", () => {
  test("deletes file and returns true when it exists", () => {
    mfs.existsSync.mockReturnValue(true);
    expect(clearTokens()).toBe(true);
    expect(mfs.unlinkSync).toHaveBeenCalledWith(CREDENTIALS_PATH);
  });

  test("returns false when file does not exist", () => {
    mfs.existsSync.mockReturnValue(false);
    expect(clearTokens()).toBe(false);
    expect(mfs.unlinkSync).not.toHaveBeenCalled();
  });
});

describe("isTokenExpired", () => {
  test("returns false when no expires_at is set", () => {
    expect(isTokenExpired({ access_token: "tok", token_type: "bearer" })).toBe(false);
  });

  test("returns false when well before expiry", () => {
    expect(
      isTokenExpired({
        access_token: "tok",
        token_type: "bearer",
        expires_at: Date.now() + 120_000,
      })
    ).toBe(false);
  });

  test("returns true when past expiry", () => {
    expect(
      isTokenExpired({ access_token: "tok", token_type: "bearer", expires_at: Date.now() - 1000 })
    ).toBe(true);
  });

  test("returns true within 60s buffer window", () => {
    expect(
      isTokenExpired({ access_token: "tok", token_type: "bearer", expires_at: Date.now() + 30_000 })
    ).toBe(true);
  });

  test("returns false at exactly 60s before expiry", () => {
    const now = 1000000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    expect(
      isTokenExpired({ access_token: "tok", token_type: "bearer", expires_at: now + 60_000 })
    ).toBe(false);
  });
});

describe("getValidAccessToken", () => {
  test("returns null when no tokens stored", async () => {
    mfs.existsSync.mockReturnValue(false);
    expect(await getValidAccessToken()).toBeNull();
  });

  test("returns access_token when not expired", async () => {
    const tokens: TokenData = {
      access_token: "valid-tok",
      token_type: "bearer",
      expires_at: Date.now() + 120_000,
    };
    mfs.existsSync.mockReturnValue(true);
    mfs.readFileSync.mockReturnValue(JSON.stringify(tokens));
    expect(await getValidAccessToken()).toBe("valid-tok");
  });

  test("returns null when expired and no refresh_token", async () => {
    const tokens: TokenData = {
      access_token: "expired-tok",
      token_type: "bearer",
      expires_at: Date.now() - 1000,
    };
    mfs.existsSync.mockReturnValue(true);
    mfs.readFileSync.mockReturnValue(JSON.stringify(tokens));
    expect(await getValidAccessToken()).toBeNull();
  });

  test("returns null when expired, without calling any OAuth endpoint", async () => {
    const tokens: TokenData = {
      access_token: "expired-tok",
      token_type: "bearer",
      expires_at: Date.now() - 1000,
      refresh_token: "refresh-tok",
    };

    mfs.existsSync.mockReturnValue(true);
    mfs.readFileSync.mockReturnValue(JSON.stringify(tokens));

    expect(await getValidAccessToken()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("returns a stored API key (no expiry)", async () => {
    mfs.existsSync.mockReturnValue(true);
    mfs.readFileSync.mockReturnValue(
      JSON.stringify({ access_token: "ctx7sk_abc", token_type: "api_key" })
    );
    expect(await getValidAccessToken()).toBe("ctx7sk_abc");
  });
});
