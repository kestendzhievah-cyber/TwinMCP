import { describe, it, expect } from "vitest";
import { jsonError, unauthorized, rateLimited, badRequest, notFound } from "@/lib/errors";

describe("Error responses", () => {
  it("jsonError returns correct status and message", () => {
    const res = jsonError(418, "teapot");
    expect(res.status).toBe(418);
  });

  it("unauthorized returns 401", () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
  });

  it("rateLimited returns 429 with upgrade link for keyed users", () => {
    const res = rateLimited(true);
    expect(res.status).toBe(429);
  });

  it("rateLimited returns 429 with create-key link for anon", () => {
    const res = rateLimited(false);
    expect(res.status).toBe(429);
  });

  it("badRequest returns 400", () => {
    const res = badRequest("oops");
    expect(res.status).toBe(400);
  });

  it("notFound returns 404", () => {
    const res = notFound();
    expect(res.status).toBe(404);
  });
});
