import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";

const mockGetValidAccessToken = vi.fn();
const mockClearTokens = vi.fn();
const mockSaveTokens = vi.fn();

vi.mock("../utils/auth.js", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
  saveTokens: (...args: unknown[]) => mockSaveTokens(...args),
}));

vi.mock("../utils/tracking.js", () => ({
  trackEvent: vi.fn(),
}));

const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: "",
};
vi.mock("ora", () => ({ default: () => mockSpinner }));

const mockOpen = vi.fn().mockResolvedValue(undefined);
vi.mock("open", () => ({ default: (...args: unknown[]) => mockOpen(...args) }));

const mockPassword = vi.fn();
vi.mock("@inquirer/prompts", () => ({
  password: (...args: unknown[]) => mockPassword(...args),
}));

vi.mock("../utils/api.js", () => ({ getBaseUrl: () => "https://test.twinmcp.fr" }));

import { registerAuthCommands, performLogin, verifyAndSaveKey } from "../commands/auth.js";
import { trackEvent } from "../utils/tracking.js";

const GOOD_KEY = "ctx7sk_live_0123456789abcdef";

let logOutput: string[];
let errorOutput: string[];
let originalExit: typeof process.exit;
let originalIsTTY: boolean | undefined;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  logOutput = [];
  errorOutput = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logOutput.push(args.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errorOutput.push(args.join(" "));
  });
  originalExit = process.exit;
  process.exit = vi.fn() as never;
  process.exitCode = undefined;
  originalIsTTY = process.stdin.isTTY;
  process.stdin.isTTY = true;
  delete process.env.TWINMCP_API_KEY;

  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("fetch not mocked");
    })
  );
});

afterEach(() => {
  process.exit = originalExit;
  process.exitCode = undefined;
  process.stdin.isTTY = originalIsTTY as boolean;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function runCommand(...args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride(); // throw instead of process.exit on commander errors
  registerAuthCommands(program);
  await program.parseAsync(["node", "test", ...args]);
}

describe("login command", () => {
  test("skips login when a valid API key is stored", async () => {
    mockGetValidAccessToken.mockResolvedValue(GOOD_KEY);
    await runCommand("login");
    expect(logOutput.some((l) => l.includes("already logged in"))).toBe(true);
  });

  test("tracks login event", async () => {
    mockGetValidAccessToken.mockResolvedValue(GOOD_KEY);
    await runCommand("login");
    expect(trackEvent).toHaveBeenCalledWith("command", { name: "login" });
  });

  test("--key verifies the key against /api/v2/servers and stores it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await runCommand("login", "--key", GOOD_KEY);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://test.twinmcp.fr/api/v2/servers",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: `Bearer ${GOOD_KEY}` }),
      })
    );
    expect(mockSaveTokens).toHaveBeenCalledWith({ access_token: GOOD_KEY, token_type: "api_key" });
    expect(process.exitCode).toBeUndefined();
  });

  test("--key with a server-bound key explains the scope and exits 1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { message: "nope", code: "key_scope" }))
    );
    await runCommand("login", "--key", GOOD_KEY);
    expect(mockSaveTokens).not.toHaveBeenCalled();
    expect(errorOutput.some((l) => l.includes("mcp_proxy"))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  test("--key rejects a value that is not a ctx7sk_ key without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await runCommand("login", "--key", "sk-something-else");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("sets exit code 1 when the pasted key is refused", async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    mockClearTokens.mockReturnValue(false);
    mockPassword.mockResolvedValue(GOOD_KEY);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { message: "bad" })));

    await runCommand("login", "--no-browser");
    expect(process.exitCode).toBe(1);
  });
});

describe("logout command", () => {
  test("logs success when tokens were cleared", async () => {
    mockClearTokens.mockReturnValue(true);
    await runCommand("logout");
    expect(logOutput.some((l) => l.includes("Logged out successfully"))).toBe(true);
  });

  test("logs 'not logged in' when no tokens existed", async () => {
    mockClearTokens.mockReturnValue(false);
    await runCommand("logout");
    expect(logOutput.some((l) => l.includes("You are not logged in"))).toBe(true);
  });

  test("tracks logout event", async () => {
    mockClearTokens.mockReturnValue(false);
    await runCommand("logout");
    expect(trackEvent).toHaveBeenCalledWith("command", { name: "logout" });
  });
});

describe("whoami command", () => {
  test("shows 'Not logged in' when no key is stored", async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    await runCommand("whoami");
    expect(logOutput.some((l) => l.includes("Not logged in"))).toBe(true);
  });

  test("treats a stored non-key token (old OAuth login) as logged out", async () => {
    mockGetValidAccessToken.mockResolvedValue("some-oauth-access-token");
    await runCommand("whoami");
    expect(logOutput.some((l) => l.includes("Not logged in"))).toBe(true);
  });

  test("shows the masked key and the server count", async () => {
    mockGetValidAccessToken.mockResolvedValue(GOOD_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { items: [{ slug: "a" }, { slug: "b" }] }))
    );

    await runCommand("whoami");
    expect(logOutput.some((l) => l.includes("Logged in"))).toBe(true);
    expect(logOutput.some((l) => l.includes("ctx7sk_live…cdef"))).toBe(true);
    expect(logOutput.some((l) => l.includes("Servers:") && l.includes("2"))).toBe(true);
    expect(logOutput.join("\n")).not.toContain(GOOD_KEY);
  });

  test("prints the API's reason when the key is refused", async () => {
    mockGetValidAccessToken.mockResolvedValue(GOOD_KEY);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));
    await runCommand("whoami");
    expect(logOutput.some((l) => l.includes("rejected the API key"))).toBe(true);
  });

  test("tracks whoami event", async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    await runCommand("whoami");
    expect(trackEvent).toHaveBeenCalledWith("command", { name: "whoami" });
  });
});

describe("performLogin", () => {
  test("returns the pasted key once the API accepts it", async () => {
    mockPassword.mockResolvedValue(`  ${GOOD_KEY}  `);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { items: [] })));

    const result = await performLogin();
    expect(result).toBe(GOOD_KEY);
    expect(mockSaveTokens).toHaveBeenCalled();
  });

  test("opens the dashboard by default", async () => {
    mockPassword.mockResolvedValue(GOOD_KEY);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { items: [] })));

    await performLogin(true);
    expect(mockOpen).toHaveBeenCalledWith("https://test.twinmcp.fr/dashboard");
  });

  test("skips browser open when openBrowser=false", async () => {
    mockPassword.mockResolvedValue(GOOD_KEY);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { items: [] })));

    await performLogin(false);
    expect(mockOpen).not.toHaveBeenCalled();
  });

  test("returns null when the prompt is cancelled", async () => {
    mockPassword.mockRejectedValue(Object.assign(new Error("cancel"), { name: "ExitPromptError" }));
    const result = await performLogin(false);
    expect(result).toBeNull();
    expect(mockSaveTokens).not.toHaveBeenCalled();
  });

  test("returns null without a terminal to prompt in", async () => {
    process.stdin.isTTY = false;
    const result = await performLogin(false);
    expect(result).toBeNull();
    expect(mockPassword).not.toHaveBeenCalled();
    expect(errorOutput.some((l) => l.includes("twinmcp login --key"))).toBe(true);
  });
});

describe("verifyAndSaveKey", () => {
  test("reports an unreachable API without saving", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENOTFOUND")));
    const result = await verifyAndSaveKey(GOOD_KEY);
    expect(result).toBeNull();
    expect(mockSaveTokens).not.toHaveBeenCalled();
    expect(errorOutput.some((l) => l.includes("Could not reach"))).toBe(true);
  });
});
