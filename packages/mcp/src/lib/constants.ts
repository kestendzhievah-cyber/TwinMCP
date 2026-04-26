import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

export const SERVER_VERSION: string = pkg.version;

const TWINMCP_BASE_URL = "https://twinmcp.com";
const MCP_RESOURCE_URL = "https://mcp.twinmcp.com";

export const CLERK_DOMAIN = "clerk.twinmcp.com";
export const TWINMCP_API_BASE_URL = process.env.TWINMCP_API_URL || `${TWINMCP_BASE_URL}/api`;
export const RESOURCE_URL = process.env.RESOURCE_URL || MCP_RESOURCE_URL;
export const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || TWINMCP_BASE_URL;
