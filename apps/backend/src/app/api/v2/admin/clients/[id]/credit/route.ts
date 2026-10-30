import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { badRequest, notFound, serverError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { refuseApiKeySession } from "@/lib/session";
import { trustedClientIp } from "@/lib/net/client-ip";
import { credit, debit, decodeLedgerCursor, getWallet, listLedger } from "@/lib/wallet/ledger";
import { afterBalanceChange } from "@/lib/wallet/after-debit";
import { eurToMicros } from "@/lib/wallet/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin view and adjustment of a client's prepaid wallet (B2B console).
//
//   GET  → { wallet, ledger: { entries, nextCursor } }   (?cursor= for older rows)
//   POST { amountEur, bucket, reason, requestId, expiresInDays? }
//        amountEur > 0 grants credit (ledger kind admin_grant), < 0 removes it
//        (kind adjustment, may take the balance below zero like any debit).
//        `requestId` (a UUID the form generates once) is the idempotency key,
//        so a double click or a retry never grants twice.
//
// requireAdmin-gated; every change is a ledger row carrying the reason and the
// acting admin, plus an audit_logs row under the client's trail.

/** Largest single grant or removal, in euros: a typo guard, not a policy. */
const MAX_ADJUST_EUR = 1000;

const postSchema = z
  .object({
    amountEur: z
      .number()
      .finite()
      .refine((n) => n !== 0, "Amount must not be zero")
      .refine((n) => Math.abs(n) <= MAX_ADJUST_EUR, `At most €${MAX_ADJUST_EUR} at once`),
    bucket: z.enum(["paid", "promo"]),
    reason: z.string().trim().min(3).max(200),
    requestId: z.string().uuid(),
    /** Promo grants: days until it expires (required for a positive promo grant). */
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .strict()
  .refine((b) => !(b.bucket === "promo" && b.amountEur > 0 && !b.expiresInDays), {
    message: "Promo grants need expiresInDays (free credit always expires)",
  });

async function clientExists(id: string): Promise<boolean> {
  const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return Boolean(row);
}

function walletJson(w: Awaited<ReturnType<typeof getWallet>>) {
  return {
    paidMicros: w.paidMicros,
    promoMicros: w.promoMicros,
    promoExpiresAt: w.promoExpiresAt?.toISOString() ?? null,
    promoExpired: w.promoExpired,
    totalMicros: w.totalMicros,
    funded: w.funded,
    fundedAt: w.fundedAt?.toISOString() ?? null,
    zeroBalanceAt: w.zeroBalanceAt?.toISOString() ?? null,
    autoRecharge: w.autoRecharge,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  try {
    if (!(await clientExists(id))) return notFound("Client introuvable");
    const cursorParam = req.nextUrl.searchParams.get("cursor");
    const cursor = cursorParam ? decodeLedgerCursor(cursorParam) : null;
    const [wallet, ledger] = await Promise.all([
      getWallet(id),
      listLedger(id, { cursor, limit: 50 }),
    ]);
    return NextResponse.json(
      {
        wallet: walletJson(wallet),
        ledger: {
          entries: ledger.entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
          nextCursor: ledger.nextCursor,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[admin/credit] read failed", err);
    return serverError("Impossible de lire le portefeuille.");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;
  // Minting credit needs a signed-in admin, never a (possibly leaked) API key.
  const keyRefusal = refuseApiKeySession(admin);
  if (keyRefusal) return keyRefusal;

  const { id: clientId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { amountEur, bucket, reason, requestId, expiresInDays } = parsed.data;
  const amountMicros = eurToMicros(Math.abs(amountEur));
  if (amountMicros <= 0) return badRequest("Amount too small");

  try {
    if (!(await clientExists(clientId))) return notFound("Client introuvable");

    const idempotencyKey = `admin:${requestId}`;
    const note = reason;
    const units = { adminId: admin.userId, adminEmail: admin.email ?? null };
    let applied: boolean;
    let totalMicros: number;

    if (amountEur > 0) {
      const expiresAt =
        bucket === "promo" && expiresInDays
          ? new Date(Date.now() + expiresInDays * 86_400_000)
          : null;
      const res = await credit({
        userId: clientId,
        amountMicros,
        bucket,
        kind: "admin_grant",
        idempotencyKey,
        note,
        units,
        ...(expiresAt ? { expiresAt } : {}),
      });
      applied = res.applied;
      totalMicros = res.totalMicros;
    } else {
      const res = await debit({
        userId: clientId,
        amountMicros,
        kind: "adjustment",
        idempotencyKey,
        note,
        units,
        bucket,
      });
      applied = res.applied;
      totalMicros = res.totalMicros;
      // Low/zero follow-ups (auto-recharge, notices), like any debit.
      if (res.applied) afterBalanceChange(clientId, { ...res, kind: "adjustment" });
    }

    if (applied) {
      // Same table as lib/audit (its action union has no wallet actions, like
      // lib/wallet/topup.ts auditWallet). Best effort, never blocks.
      void getDb()
        .insert(auditLogs)
        .values({
          id: randomUUID(),
          userId: clientId,
          action: amountEur > 0 ? "admin.wallet.grant" : "admin.wallet.adjust",
          targetType: "wallet",
          targetId: idempotencyKey,
          ip: trustedClientIp(req),
          metadata: {
            amountMicros: amountEur > 0 ? amountMicros : -amountMicros,
            bucket,
            reason,
            actorAdminId: admin.userId,
            ...(expiresInDays ? { expiresInDays } : {}),
          },
        })
        .catch((err: unknown) => console.error("[admin/credit] audit failed", err));
    }

    const wallet = await getWallet(clientId);
    return NextResponse.json({ applied, totalMicros, wallet: walletJson(wallet) });
  } catch (err) {
    console.error("[admin/credit] adjust failed", err);
    return serverError("Échec de l'ajustement du crédit.");
  }
}
