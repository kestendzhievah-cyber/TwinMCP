import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getReceiver, runJob, type Job } from "@/lib/queue/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("provision-server"), serverId: z.string() }),
  z.object({ type: z.literal("destroy-server"), serverId: z.string() }),
  z.object({ type: z.literal("install-mcp"), userServerId: z.string() }),
]);

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Signature verification — required when QSTASH_CURRENT_SIGNING_KEY is set.
  const receiver = getReceiver();
  if (receiver) {
    const signature = req.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json({ message: "Missing signature" }, { status: 401 });
    }
    try {
      const valid = await receiver.verify({
        signature,
        body,
        url: req.url,
      });
      if (!valid) {
        return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
      }
    } catch (err) {
      console.error("[jobs/run] signature verify failed:", err);
      return NextResponse.json({ message: "Signature verification failed" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Hard fail in production if signature key isn't configured — the endpoint
    // would otherwise allow anyone to trigger provisioning jobs.
    console.error("[jobs/run] refusing to run unsigned in production");
    return NextResponse.json(
      { message: "Job runner is not configured (missing QSTASH_CURRENT_SIGNING_KEY)" },
      { status: 503 }
    );
  }

  let parsed: { success: true; data: Job } | { success: false; error: z.ZodError };
  try {
    parsed = jobSchema.safeParse(JSON.parse(body)) as typeof parsed;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  try {
    await runJob(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[jobs/run] job ${parsed.data.type} failed:`, err);
    // Return 500 so QStash retries up to its configured limit.
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Job failed" },
      { status: 500 }
    );
  }
}
