import type { DownloadResponse, LibrarySearchResponse, ContextResponse } from "../types.js";
import { downloadSkillFromGitHub, getSkillFromGitHub } from "./github.js";
import { VERSION } from "../constants.js";

// Every path this module calls must exist under apps/backend/src/app/api
// (src/__tests__/api-paths.test.ts).
let baseUrl = "https://twinmcp.fr";

export function getBaseUrl(): string {
  return baseUrl;
}

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

/**
 * The static find-docs skill (and any skill named by `setup --cli`) comes
 * straight from its GitHub repository: twinmcp.fr serves no skills registry
 * (/api/v2/skills does not exist), so the old registry-first lookup only 404'd.
 */
export async function downloadSkill(project: string, skillName: string): Promise<DownloadResponse> {
  const ghResult = await getSkillFromGitHub(project, skillName);
  if (ghResult.status !== "ok" || !ghResult.skill) {
    return {
      skill: { name: skillName, description: "", url: "", project },
      files: [],
      error:
        ghResult.status === "error"
          ? ghResult.error
          : ghResult.status === "repo_not_found"
            ? `Repository not found: ${project}`
            : `Skill not found: ${skillName}`,
    };
  }

  const { files, error } = await downloadSkillFromGitHub(ghResult.skill);
  if (error) {
    return { skill: ghResult.skill, files: [], error };
  }
  return { skill: ghResult.skill, files };
}

export async function searchLibraries(
  query: string,
  accessToken?: string
): Promise<LibrarySearchResponse> {
  const params = new URLSearchParams({ query });
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}/api/v2/libs/search?${params}`, { headers });
  return (await response.json()) as LibrarySearchResponse;
}

function getAuthHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-TwinMCP-Source": "cli",
    "X-TwinMCP-Client-IDE": "twinmcp-cli",
    "X-TwinMCP-Client-Version": VERSION,
    "X-TwinMCP-Transport": "cli",
  };
  const apiKey = process.env.TWINMCP_API_KEY;
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function resolveLibrary(
  libraryName: string,
  query?: string,
  accessToken?: string
): Promise<LibrarySearchResponse> {
  const params = new URLSearchParams({ libraryName });
  if (query) {
    params.set("query", query);
  }

  const response = await fetch(`${baseUrl}/api/v2/libs/search?${params}`, {
    headers: getAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    return {
      results: [],
      error: errorData.error || `HTTP error ${response.status}`,
      message: errorData.message,
    };
  }

  return (await response.json()) as LibrarySearchResponse;
}

export interface GetContextOptions {
  type?: "json" | "txt";
}

export async function getLibraryContext(
  libraryId: string,
  query: string,
  options?: GetContextOptions,
  accessToken?: string
): Promise<ContextResponse | string> {
  const params = new URLSearchParams({ libraryId, query });
  if (options?.type) {
    params.set("type", options.type);
  }
  const response = await fetch(`${baseUrl}/api/v2/context?${params}`, {
    headers: getAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      redirectUrl?: string;
    };

    if (response.status === 301 && errorData.redirectUrl) {
      return {
        codeSnippets: [],
        infoSnippets: [],
        error: errorData.error || "library_redirected",
        message: errorData.message,
        redirectUrl: errorData.redirectUrl,
      };
    }

    return {
      codeSnippets: [],
      infoSnippets: [],
      error: errorData.error || `HTTP error ${response.status}`,
      message: errorData.message,
    };
  }

  if (options?.type === "txt") {
    return await response.text();
  }

  return (await response.json()) as ContextResponse;
}
