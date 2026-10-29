// Kept for API compatibility: "Stop" is now "Pause" (contract K4). It used to
// delete the box and everything on it; it now pauses it and keeps the data.
// Deleting the runtime is the explicit DELETE /api/v2/servers/:id/runtime.
export { POST } from "../pause/route";

// Segment config must be declared literally (Next.js reads it statically).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
