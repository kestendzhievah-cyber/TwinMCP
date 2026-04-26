import { NextResponse } from "next/server";

export function jsonError(status: number, message: string, extra: object = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export const unauthorized = (
  msg = "Invalid API key. Please check your API key. API keys should start with 'ctx7sk' prefix."
) => jsonError(401, msg);

export const rateLimited = (apiKey: boolean) =>
  jsonError(
    429,
    apiKey
      ? "Rate limited or quota exceeded. Upgrade your plan at https://twinmcp.com/plans for higher limits."
      : "Rate limited or quota exceeded. Create a free API key at https://twinmcp.com/dashboard for higher limits."
  );

export const badRequest = (msg: string) => jsonError(400, msg);
export const notFound = (msg = "Not found") => jsonError(404, msg);
export const serverError = (msg = "Internal server error") => jsonError(500, msg);
