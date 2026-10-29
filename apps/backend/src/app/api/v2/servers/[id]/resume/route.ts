// Resume = Start: a paused server is woken in place (data kept), a server
// without a runtime is provisioned. One handler, two names (contract K4).
export { POST } from "../start/route";

// Segment config must be declared literally (Next.js reads it statically).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
