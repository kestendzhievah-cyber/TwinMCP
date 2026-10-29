// The client IP for rate limits on public routes.
//
// Production sits behind Traefik (Dokploy), which sets X-Real-Ip to the TCP
// peer and APPENDS that peer to any X-Forwarded-For the client sent. So the
// left-most X-Forwarded-For entry is whatever the client typed (a free key for
// every request); only the right-most entry, or X-Real-Ip, comes from our
// proxy. Pure helper + a Request wrapper.

/** X-Real-Ip when set, else the right-most X-Forwarded-For hop. */
export function pickClientIp(
  realIp: string | null | undefined,
  forwardedFor: string | null | undefined
): string | null {
  const real = realIp?.trim();
  if (real) return real;
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.at(-1) ?? null;
}

export function trustedClientIp(req: Request): string | null {
  return pickClientIp(req.headers.get("x-real-ip"), req.headers.get("x-forwarded-for"));
}
